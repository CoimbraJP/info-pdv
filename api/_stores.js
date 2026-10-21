/**
 * Lojas atendidas por este servidor e o banco MongoDB de cada uma.
 * Só ids desta lista são aceitos (o cliente não escolhe nome de banco livre).
 */
export const STORE_DBS = {
  infocentro: process.env.MONGODB_DB || 'infopdv',
  eaglegames: process.env.MONGODB_DB_EAGLE || 'eaglegames',
};

/** Loja da requisição (header X-Store). Sem header = Info Centro (clientes antigos). */
export function storeFromRequest(req) {
  const id = String(req.headers['x-store'] || 'infocentro').toLowerCase();
  return STORE_DBS[id] ? { id, db: STORE_DBS[id] } : null;
}
