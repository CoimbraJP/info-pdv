/**
 * Configuração global das lojas: código de entrada e senha ADM de cada uma
 * (somente hashes). Fica no servidor (/api/system) e em cache local para a
 * tela de código funcionar offline.
 */
import { STORES } from '../constants/stores';
import { hashPassword } from './auth';

const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
const SYSTEM_URL = `${API_BASE}/api/system`;
const TOKEN = import.meta.env?.VITE_SYNC_TOKEN || '';
const CACHE_KEY = 'infopdv-system';
const PENDING_KEY = 'infopdv-system-pending';

const emptySystem = () => ({
  updatedAt: 0,
  stores: Object.fromEntries(STORES.map((s) => [s.id, { codeHash: null, adminPinHash: null }])),
});

const normalize = (sys) => {
  const base = emptySystem();
  if (!sys) return base;
  for (const s of STORES) base.stores[s.id] = { ...base.stores[s.id], ...(sys.stores?.[s.id] || {}) };
  base.updatedAt = sys.updatedAt || 0;
  return base;
};

export function loadCachedSystem() {
  try { return normalize(JSON.parse(localStorage.getItem(CACHE_KEY))); } catch { return emptySystem(); }
}

function cache(sys) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(sys)); } catch { /* ignora */ }
}

const headers = () => ({
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
});

async function push(sys) {
  const res = await fetch(SYSTEM_URL, { method: 'POST', headers: headers(), body: JSON.stringify(sys) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normalize(await res.json());
}

/**
 * Busca a versão do servidor (e envia alteração local pendente, se houver).
 * Vence o updatedAt mais recente. Sem rede: devolve o cache.
 */
export async function refreshSystem() {
  let local = loadCachedSystem();
  try {
    if (localStorage.getItem(PENDING_KEY)) {
      local = await push(local);
      localStorage.removeItem(PENDING_KEY);
    }
    const res = await fetch(SYSTEM_URL, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = normalize(await res.json());
    const winner = remote.updatedAt >= local.updatedAt ? remote : local;
    cache(winner);
    return winner;
  } catch {
    return local;
  }
}

/** Salva localmente na hora e tenta enviar; se falhar, envia no próximo refresh. */
export async function saveSystem(next) {
  const stamped = normalize({ ...next, updatedAt: Date.now() });
  cache(stamped);
  try {
    const saved = await push(stamped);
    cache(saved);
    localStorage.removeItem(PENDING_KEY);
    return { system: saved, synced: true };
  } catch {
    try { localStorage.setItem(PENDING_KEY, '1'); } catch { /* ignora */ }
    return { system: stamped, synced: false };
  }
}

/** Hash efetivo do código de entrada (código trocado ou o padrão da loja). */
export async function storeCodeHash(store, system) {
  return system.stores[store.id]?.codeHash || hashPassword(store.defaultCode);
}

/** Código digitado → loja (ou null). */
export async function storeForCode(code, system) {
  const h = await hashPassword(String(code).trim());
  for (const store of STORES) {
    if ((await storeCodeHash(store, system)) === h) return store;
  }
  return null;
}
