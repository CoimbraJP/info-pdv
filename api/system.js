/**
 * /api/system — configuração global das lojas (fica no banco da Info Centro).
 *
 * Guarda SOMENTE hashes: código de entrada de cada loja e senha ADM de cada
 * loja. GET devolve o documento; POST grava (last-write-wins por updatedAt).
 * Mesmo token do /api/sync.
 *
 * Formato: { updatedAt, stores: { infocentro: { codeHash, adminPinHash }, eaglegames: {...} } }
 */
import { connectDB } from './_db.js';
import { System } from './_models.js';
import { STORE_DBS } from './_stores.js';

const DOC_ID = 'stores';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

const isHash = (v) => v == null || (typeof v === 'string' && /^[a-f0-9]{64}$/.test(v));

export default async function handler(req, res) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) return res.status(503).json({ error: 'Servidor não configurado' });
  if (req.headers.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    await connectDB();
    const existing = await System.findOne({ id: DOC_ID }).lean();

    if (req.method === 'GET') {
      return res.status(200).json(existing ? existing.data : null);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const updatedAt = Number(body.updatedAt) || Date.now();
      const stores = {};
      // aceita só lojas conhecidas e só valores no formato de hash
      for (const id of Object.keys(STORE_DBS)) {
        const s = body.stores?.[id] || {};
        if (!isHash(s.codeHash) || !isHash(s.adminPinHash)) {
          return res.status(400).json({ error: `Dados inválidos para a loja ${id}` });
        }
        stores[id] = { codeHash: s.codeHash || null, adminPinHash: s.adminPinHash || null };
      }
      if (existing && (existing.updatedAt || 0) > updatedAt) {
        return res.status(200).json(existing.data); // servidor tem versão mais nova
      }
      const data = { updatedAt, stores };
      await System.updateOne(
        { id: DOC_ID },
        { $set: { id: DOC_ID, updatedAt, deleted: false, data } },
        { upsert: true }
      );
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/system] erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
