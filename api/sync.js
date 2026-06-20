/**
 * POST /api/sync — sincronização offline-first (push/pull, last-write-wins).
 *
 * Recebe do cliente os registros alterados desde a última sync + tombstones,
 * grava no MongoDB Atlas respeitando o updatedAt mais recente, e devolve tudo
 * que mudou no servidor desde então.
 */
import { connectDB } from './_db.js';
import { Product, Sale, ServiceOrder, Settings, MODELS } from './_models.js';

const STORES = {
  products: Product,
  sales: Sale,
  serviceOrders: ServiceOrder,
};

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

async function upsertAll(Model, records, serverTime) {
  for (const r of records || []) {
    if (r == null || r.id == null) continue;
    const id = String(r.id);
    const updatedAt = r.updatedAt || serverTime;
    const existing = await Model.findOne({ id }).lean();
    if (!existing || updatedAt >= (existing.updatedAt || 0)) {
      await Model.updateOne(
        { id },
        { $set: { id, updatedAt, deleted: false, data: r } },
        { upsert: true }
      );
    }
  }
}

async function applyTombstones(tombstones, serverTime) {
  for (const t of tombstones || []) {
    const Model = MODELS[t.store];
    if (!Model || t.id == null) continue;
    const id = String(t.id);
    const deletedAt = t.deletedAt || serverTime;
    const existing = await Model.findOne({ id }).lean();
    if (!existing || deletedAt >= (existing.updatedAt || 0)) {
      await Model.updateOne(
        { id },
        { $set: { id, updatedAt: deletedAt, deleted: true } },
        { upsert: true }
      );
    }
  }
}

export default async function handler(req, res) {
  // CORS (uso local / dev em outra porta)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const body = await readBody(req);
    const {
      lastSyncAt = 0,
      products = [],
      sales = [],
      serviceOrders = [],
      settings = null,
      tombstones = [],
    } = body;

    const serverTime = Date.now();

    // ── PUSH: grava o que veio do cliente ──
    await upsertAll(Product, products, serverTime);
    await upsertAll(Sale, sales, serverTime);
    await upsertAll(ServiceOrder, serviceOrders, serverTime);
    if (settings) {
      const updatedAt = settings.updatedAt || serverTime;
      const existing = await Settings.findOne({ id: 'singleton' }).lean();
      if (!existing || updatedAt >= (existing.updatedAt || 0)) {
        await Settings.updateOne(
          { id: 'singleton' },
          { $set: { id: 'singleton', updatedAt, deleted: false, data: settings } },
          { upsert: true }
        );
      }
    }
    await applyTombstones(tombstones, serverTime);

    // ── PULL: devolve o que mudou no servidor desde lastSyncAt ──
    const out = { serverTime, tombstones: [] };

    for (const [store, Model] of Object.entries(STORES)) {
      const docs = await Model.find({ updatedAt: { $gt: lastSyncAt }, deleted: { $ne: true } }).lean();
      out[store] = docs.map((d) => d.data);

      const removed = await Model.find({ updatedAt: { $gt: lastSyncAt }, deleted: true }).lean();
      for (const d of removed) out.tombstones.push({ store, id: d.id });
    }

    const settingsDoc = await Settings.findOne({
      id: 'singleton',
      updatedAt: { $gt: lastSyncAt },
      deleted: { $ne: true },
    }).lean();
    out.settings = settingsDoc ? settingsDoc.data : null;

    return res.status(200).json(out);
  } catch (err) {
    console.error('[api/sync] erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
