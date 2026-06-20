/**
 * Cliente de sincronização com o backend (/api/sync).
 *
 * Estratégia: offline-first com last-write-wins por `updatedAt`.
 *  - envia os registros locais alterados desde a última sincronização + tombstones;
 *  - recebe de volta o que mudou no servidor desde então;
 *  - o servidor (MongoDB Atlas) é a fonte compartilhada; o IndexedDB é a fonte
 *    de verdade local, garantindo que o PDV funcione mesmo sem internet.
 */

// Base da API. Em produção (Vercel) o front e a /api ficam no mesmo domínio,
// então o padrão é caminho relativo. Pode ser sobrescrito por VITE_API_URL.
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export const SYNC_URL = `${API_BASE}/api/sync`;

/**
 * Faz uma rodada de push/pull.
 * @param {object} payload { lastSyncAt, products, sales, serviceOrders, settings, tombstones }
 * @returns {Promise<object>} { serverTime, products, sales, serviceOrders, settings, tombstones }
 */
export async function pushPull(payload, { signal } = {}) {
  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sync HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
