/**
 * GET /api/crm-sync — endpoint de LEITURA para o CRM (integração externa).
 *
 * Regras:
 *  - somente leitura (find; nunca update/delete);
 *  - somente a collection `serviceorders`;
 *  - token próprio (CRM_READ_TOKEN) — NÃO reutiliza o SYNC_TOKEN interno do PDV,
 *    para poder revogar o acesso do CRM sem derrubar os terminais do PDV.
 *
 * Query params opcionais:
 *  - ?since=<epoch ms>      → só registros com updatedAt > since (sync incremental)
 *  - ?includeDeleted=1      → inclui tombstones (deleted: true); padrão é omitir
 *
 * Resposta: array de documentos no formato { id, updatedAt, deleted, data }.
 */
import { connectDB } from './_db.js';
import { ServiceOrder } from './_models.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Fail-closed: sem token configurado no servidor, ninguém entra.
  const expected = process.env.CRM_READ_TOKEN;
  if (!expected) {
    console.error('[api/crm-sync] CRM_READ_TOKEN não configurado — recusando requisição.');
    return res.status(503).json({ error: 'Integração não configurada no servidor' });
  }
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== expected) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    await connectDB();

    const since = Number(req.query?.since) || 0;
    const includeDeleted = req.query?.includeDeleted === '1';

    const query = {};
    if (since > 0) query.updatedAt = { $gt: since };
    if (!includeDeleted) query.deleted = { $ne: true };

    const ordens = await ServiceOrder.find(query)
      .select('id updatedAt deleted data -_id')
      .sort({ updatedAt: 1 })
      .lean();

    return res.status(200).json(ordens);
  } catch (err) {
    console.error('[api/crm-sync] erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
