/**
 * Camada de persistência local (offline-first) sobre IndexedDB via localforage.
 *
 * Substitui o uso direto de localStorage:
 *  - capacidade muito maior (sem o limite de ~5 MB)
 *  - base pronta para sincronizar com o MongoDB Atlas
 *
 * Cada coleção é guardada como um array sob uma chave. Cada registro carrega
 * `updatedAt` (epoch ms) para o sincronizador resolver conflitos (last-write-wins).
 * Exclusões geram "tombstones" para que também sejam propagadas na sincronização.
 */
import localforage from 'localforage';

localforage.config({
  name: 'infocentro',
  storeName: 'infocentro_store',
  description: 'INFO CENTRO — dados locais do PDV',
});

export const KEYS = {
  products: 'infocentro_products',
  os: 'infocentro_os',
  sales: 'infocentro_sales',
  settings: 'infocentro_settings',
  tombstones: 'infocentro_tombstones',
  meta: 'infocentro_meta',
};

/** Nome lógico de cada coleção usado no sincronizador/tombstones. */
export const STORE = {
  products: 'products',
  os: 'serviceOrders',
  sales: 'sales',
  settings: 'settings',
};

export async function dbGet(key, fallback = null) {
  try {
    const value = await localforage.getItem(key);
    return value == null ? fallback : value;
  } catch (err) {
    console.error('[db] getItem falhou:', key, err);
    return fallback;
  }
}

export async function dbSet(key, value) {
  try {
    await localforage.setItem(key, value);
  } catch (err) {
    console.error('[db] setItem falhou:', key, err);
  }
  return value;
}

/**
 * Migração única dos dados antigos guardados em localStorage para o IndexedDB.
 * Roda apenas uma vez; preserva o que o usuário já tinha cadastrado.
 */
export async function migrateFromLocalStorage() {
  try {
    const done = await localforage.getItem('infocentro_migrated_v1');
    if (done) return;

    for (const key of [KEYS.products, KEYS.os, KEYS.sales, KEYS.settings]) {
      const existing = await localforage.getItem(key);
      if (existing == null && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            await localforage.setItem(key, JSON.parse(raw));
          } catch {
            /* valor inválido — ignora */
          }
        }
      }
    }
    await localforage.setItem('infocentro_migrated_v1', true);
  } catch (err) {
    console.error('[db] migração falhou:', err);
  }
}

const stripMeta = (record) => {
  const clone = { ...record };
  delete clone.updatedAt;
  return clone;
};

/**
 * Compara o array anterior com o novo e:
 *  - carimba `updatedAt` em registros novos ou alterados;
 *  - devolve a lista de ids removidos (para gerar tombstones).
 *
 * Mantém `updatedAt` inalterado quando o registro não mudou, evitando
 * marcar tudo como "sujo" a cada render.
 */
export function diffStamp(prev = [], next = [], now = Date.now()) {
  const prevById = new Map((prev || []).map((r) => [String(r.id), r]));

  const stamped = (next || []).map((record) => {
    const old = prevById.get(String(record.id));
    if (!old) {
      return { ...record, updatedAt: record.updatedAt || now };
    }
    const changed = JSON.stringify(stripMeta(old)) !== JSON.stringify(stripMeta(record));
    if (changed) {
      return { ...record, updatedAt: now };
    }
    return { ...record, updatedAt: record.updatedAt || old.updatedAt || now };
  });

  const nextIds = new Set((next || []).map((r) => String(r.id)));
  const removed = (prev || [])
    .filter((r) => !nextIds.has(String(r.id)))
    .map((r) => String(r.id));

  return { stamped, removed };
}

/**
 * Mescla registros remotos no array local usando last-write-wins por updatedAt,
 * e remove os ids presentes em `removedIds`. Não recarimba updatedAt.
 */
export function mergeRemote(local = [], remote = [], removedIds = []) {
  const byId = new Map((local || []).map((r) => [String(r.id), r]));

  for (const incoming of remote || []) {
    const id = String(incoming.id);
    const current = byId.get(id);
    if (!current || (incoming.updatedAt || 0) >= (current.updatedAt || 0)) {
      byId.set(id, incoming);
    }
  }

  for (const id of removedIds || []) {
    byId.delete(String(id));
  }

  return Array.from(byId.values());
}
