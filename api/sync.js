/**
 * POST /api/sync — sincronização offline-first (push/pull, last-write-wins).
 *
 * Recebe do cliente os registros alterados desde a última sync + tombstones,
 * grava no MongoDB Atlas respeitando o updatedAt mais recente, e devolve tudo
 * que mudou no servidor desde então.
 */
import { connectDB } from './_db.js';
import { modelsFor } from './_models.js';
import { storeFromRequest } from './_stores.js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  // fallback: lê o stream manualmente
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

/**
 * Janela de sobreposição do pull: devolvemos o cursor um pouco "para trás"
 * para não perder gravações de outro terminal que terminaram enquanto esta
 * requisição lia o banco. Reenviar registros já recebidos é inofensivo
 * (o cliente mescla por id + updatedAt).
 */
const OVERLAP_MS = 2 * 60 * 1000;

/**
 * Grava em lote (2 idas ao banco por coleção, qualquer quantidade): lê o
 * updatedAt atual dos ids recebidos e regrava só os que são iguais ou mais
 * novos (last-write-wins). Antes era 1 consulta + 1 gravação POR registro,
 * o que estourava o tempo limite da Vercel em importações grandes.
 */
async function upsertAll(Model, records, serverTime) {
  const list = (records || []).filter((r) => r != null && r.id != null);
  if (!list.length) return;
  const ids = list.map((r) => String(r.id));
  const existing = await Model.find({ id: { $in: ids } }, { id: 1, updatedAt: 1, _id: 0 }).lean();
  const current = new Map(existing.map((d) => [d.id, d.updatedAt || 0]));

  const ops = [];
  for (const r of list) {
    const id = String(r.id);
    const updatedAt = Number(r.updatedAt) || serverTime;
    if (current.has(id) && updatedAt < current.get(id)) continue; // servidor tem versão mais nova
    ops.push({
      updateOne: {
        filter: { id },
        update: { $set: { id, updatedAt, syncedAt: serverTime, deleted: false, data: r } },
        upsert: true,
      },
    });
  }
  if (ops.length) await Model.bulkWrite(ops, { ordered: false });
}

async function applyTombstones(MODELS, tombstones, serverTime) {
  const byModel = new Map();
  for (const t of tombstones || []) {
    const Model = MODELS[t.store];
    if (!Model || t.id == null) continue;
    if (!byModel.has(Model)) byModel.set(Model, []);
    byModel.get(Model).push(t);
  }
  for (const [Model, list] of byModel) {
    const existing = await Model.find({ id: { $in: list.map((t) => String(t.id)) } }, { id: 1, updatedAt: 1, _id: 0 }).lean();
    const current = new Map(existing.map((d) => [d.id, d.updatedAt || 0]));
    const ops = [];
    for (const t of list) {
      const id = String(t.id);
      const deletedAt = Number(t.deletedAt) || serverTime;
      if (current.has(id) && deletedAt < current.get(id)) continue;
      ops.push({
        updateOne: {
          filter: { id },
          update: { $set: { id, updatedAt: deletedAt, syncedAt: serverTime, deleted: true } },
          upsert: true,
        },
      });
    }
    if (ops.length) await Model.bulkWrite(ops, { ordered: false });
  }
}

/** Mudou desde o cursor (registros antigos, sem syncedAt, usam o updatedAt). */
const changedSince = (cursor) => ({
  $or: [
    { syncedAt: { $gt: cursor } },
    { syncedAt: { $exists: false }, updatedAt: { $gt: cursor } },
  ],
});

export default async function handler(req, res) {
  // CORS: em produção (Vercel) front e API estão no mesmo domínio e não é
  // necessário liberar nada. Para dev em outra porta, defina ALLOWED_ORIGIN.
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Store');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticação: token obrigatório. Sem SYNC_TOKEN configurado, a API
  // recusa tudo (fail-closed) em vez de ficar aberta ao público.
  const expected = process.env.SYNC_TOKEN;
  if (!expected) {
    console.error('[api/sync] SYNC_TOKEN não configurado — recusando requisição.');
    return res.status(503).json({ error: 'Sync não configurado no servidor' });
  }
  if (req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const store = storeFromRequest(req);
  if (!store) return res.status(400).json({ error: 'Loja desconhecida' });

  try {
    await connectDB();
    // Cada loja grava e lê no próprio banco
    const { Product, Sale, ServiceOrder, Settings, Etiqueta, MODELS } = modelsFor(store.db);
    const STORES = { products: Product, sales: Sale, serviceOrders: ServiceOrder, etiquetas: Etiqueta };

    const body = await readBody(req);
    const {
      lastSyncAt = 0,
      products = [],
      sales = [],
      serviceOrders = [],
      etiquetas = [],
      settings = null,
      tombstones = [],
    } = body;

    const serverTime = Date.now();

    // ── PUSH: grava o que veio do cliente ──
    await upsertAll(Product, products, serverTime);
    await upsertAll(Sale, sales, serverTime);
    await upsertAll(ServiceOrder, serviceOrders, serverTime);
    await upsertAll(Etiqueta, etiquetas, serverTime);
    if (settings) {
      const updatedAt = settings.updatedAt || serverTime;
      const existing = await Settings.findOne({ id: 'singleton' }).lean();
      if (!existing || updatedAt >= (existing.updatedAt || 0)) {
        await Settings.updateOne(
          { id: 'singleton' },
          { $set: { id: 'singleton', updatedAt, syncedAt: serverTime, deleted: false, data: settings } },
          { upsert: true }
        );
      }
    }
    await applyTombstones(MODELS, tombstones, serverTime);

    // ── PULL: devolve o que mudou no servidor desde lastSyncAt ──
    // syncCursor: o cliente novo guarda este valor (hora do servidor, com
    // folga); clientes antigos continuam usando serverTime.
    const out = { serverTime, syncCursor: serverTime - OVERLAP_MS, tombstones: [] };
    const cursor = Number(lastSyncAt) || 0;

    for (const [storeName, Model] of Object.entries(STORES)) {
      const docs = await Model.find({ ...changedSince(cursor), deleted: { $ne: true } }).lean();
      out[storeName] = docs.map((d) => d.data);

      const removed = await Model.find({ ...changedSince(cursor), deleted: true }, { id: 1, _id: 0 }).lean();
      for (const d of removed) out.tombstones.push({ store: storeName, id: d.id });
    }

    const settingsDoc = await Settings.findOne({
      id: 'singleton',
      ...changedSince(cursor),
      deleted: { $ne: true },
    }).lean();
    out.settings = settingsDoc ? settingsDoc.data : null;

    return res.status(200).json(out);
  } catch (err) {
    console.error('[api/sync] erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
