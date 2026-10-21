import { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  KEYS, STORE, dbGet, dbSet, migrateFromLocalStorage, diffStamp, mergeRemote,
} from '../utils/db';
import { pushPull, isOnline } from '../utils/sync';
import { buildBackupPayload, downloadBackup } from '../utils/backup';
import { ROLE, hashPassword, MIN_PASSWORD_LENGTH } from '../utils/auth';

/** Intervalo do backup automático em arquivo (1×/dia na primeira abertura). */
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Trava por carregamento de página: o StrictMode (dev) monta o app 2×,
 * o que disparava o backup em duplicidade antes do meta ser gravado.
 */
let autoBackupTriggered = false;

const GlobalStateContext = createContext();

/* ── Dados iniciais (apenas no primeiro uso) ── */
const defaultProducts = [
  { id: 1, name: 'Memória RAM DDR4 8GB Kingston', price: 150.00, cost: 95.00, barcode: '12345', stock: 10 },
  { id: 2, name: 'SSD M.2 NVMe 500GB WD Blue', price: 280.00, cost: 200.00, barcode: '67890', stock: 5 },
  { id: 3, name: 'Teclado Mecânico Redragon', price: 199.90, cost: 130.00, barcode: '11111', stock: 8 },
  { id: 4, name: 'Mouse Gamer Logitech G203', price: 120.00, cost: 78.00, barcode: '22222', stock: 15 },
  { id: 5, name: 'Cabo HDMI 2.0 2 metros', price: 35.00, cost: 12.00, barcode: '33333', stock: 45 },
  { id: 6, name: 'Cabo de Força Tripolar', price: 15.00, cost: 5.00, barcode: '44444', stock: 30 },
  { id: 7, name: 'Cabo USB-C 1 metro', price: 25.00, cost: 9.00, barcode: '55555', stock: 20 },
  { id: 8, name: 'Fonte ATX 500W', price: 250.00, cost: 180.00, barcode: '66666', stock: 2 },
  { id: 9, name: 'Pasta Térmica Implastec', price: 15.00, cost: 6.00, barcode: '77777', stock: 0 },
];

const defaultOS = []; // sem OS de exemplo — dados de teste entram via importação de backup

const defaultEtiquetas = []; // etiquetas de notebooks — carregam via importação JSON

const defaultSettings = {
  osPrintTemplate: 'thermal-1',
  storeName: 'Info Centro',
  storePhone: '(12) 99999-9999',
  storeAddress: 'SJC — São Paulo',
};

export const GlobalProvider = ({ children }) => {
  const [products, setProductsState] = useState([]);
  const [osList, setOsListState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [etiquetas, setEtiquetasState] = useState([]);
  const [settings, setSettingsState] = useState(defaultSettings);

  // Papel atual: NÃO é persistido — toda abertura do app começa como Vendedor.
  const [role, setRole] = useState(ROLE.VENDEDOR);

  const [syncStatus, setSyncStatus] = useState(isOnline() ? 'idle' : 'offline');
  const [lastSyncAt, setLastSyncAt] = useState(0);

  /* refs = espelho síncrono do estado, para escrita/diff sem depender do ciclo do React */
  const productsRef = useRef([]);
  const osRef = useRef([]);
  const salesRef = useRef([]);
  const etiquetasRef = useRef([]);
  const settingsRef = useRef(defaultSettings);
  const tombsRef = useRef([]);
  const metaRef = useRef({ lastSyncAt: 0 });
  const syncTimer = useRef(null);

  /* ── Tombstones (registros excluídos, para propagar a exclusão) ── */
  const addTombstones = (store, ids) => {
    const now = Date.now();
    const next = [...(tombsRef.current || []), ...ids.map((id) => ({ store, id: String(id), deletedAt: now }))];
    tombsRef.current = next;
    dbSet(KEYS.tombstones, next);
  };

  /* ── Sincronização agendada (debounce) ── */
  const runSyncRef = useRef(() => {});
  const scheduleSync = () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => runSyncRef.current(), 2500);
  };

  /* ── Escrita de coleções (carimba updatedAt + gera tombstones) ── */
  const writeCollection = (key, store, ref, setState, updater) => {
    const prev = ref.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const { stamped, removed } = diffStamp(prev, next);
    ref.current = stamped;
    setState(stamped);
    dbSet(key, stamped);
    if (removed.length) addTombstones(store, removed);
    scheduleSync();
    return stamped;
  };

  const setProducts = (updater) => writeCollection(KEYS.products, STORE.products, productsRef, setProductsState, updater);
  const setOsList = (updater) => writeCollection(KEYS.os, STORE.os, osRef, setOsListState, updater);
  const setSales = (updater) => writeCollection(KEYS.sales, STORE.sales, salesRef, setSalesState, updater);
  const setEtiquetas = (updater) => {
    const prev = etiquetasRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    etiquetasRef.current = next;
    setEtiquetasState(next);
    dbSet('etiquetas', next);
    scheduleSync();
  };

  const setSettings = (updater) => {
    const prev = settingsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const stamped = { ...next, id: 'singleton', updatedAt: Date.now() };
    settingsRef.current = stamped;
    setSettingsState(stamped);
    dbSet(KEYS.settings, stamped);
    scheduleSync();
  };

  /* ── Operações de negócio ── */
  const addSale = (saleData) => {
    // UUID: Date.now() podia colidir entre dois terminais e o merge por id
    // do sync descartaria uma das vendas silenciosamente.
    setSales((prev) => [...prev, { id: crypto.randomUUID(), ...saleData, date: new Date().toISOString() }]);
    // Baixa de estoque dos itens que não são avulsos
    setProducts((prevProducts) => {
      const updated = [...prevProducts];
      saleData.items.forEach((item) => {
        if (!item.isAvulso) {
          const idx = updated.findIndex((p) => p.id === item.id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], stock: Math.max(0, updated[idx].stock - item.quantity) };
          }
        }
      });
      return updated;
    });
  };

  const addOS = (osData) => {
    setOsList((prev) => [
      { id: String(Date.now()), ...osData, date: new Date().toISOString(), services: [], total: 0, serviceValue: 0 },
      ...prev,
    ]);
  };

  const updateOS = (id, patch) => {
    setOsList((prev) => prev.map((os) => (os.id === id ? { ...os, ...patch } : os)));
  };

  const deleteOS = (id) => {
    setOsList((prev) => prev.filter((os) => os.id !== id));
  };

  /* ── Acesso Vendedor × Administrador ── */
  const isAdmin = role === ROLE.ADMIN;
  const hasAdminPassword = Boolean(settings?.adminPinHash);

  /** Tenta entrar no modo ADM. Retorna true se a senha confere. */
  const unlockAdmin = async (password) => {
    const stored = settingsRef.current?.adminPinHash;
    if (!stored) return false;
    const ok = (await hashPassword(password)) === stored;
    if (ok) setRole(ROLE.ADMIN);
    return ok;
  };

  /** Primeiro acesso: cria a senha do ADM e já entra no modo ADM. */
  const createAdminPassword = async (password) => {
    if ((password || '').length < MIN_PASSWORD_LENGTH) {
      return { ok: false, error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    }
    if (settingsRef.current?.adminPinHash) {
      return { ok: false, error: 'Já existe uma senha de administrador.' };
    }
    const hash = await hashPassword(password);
    setSettings((prev) => ({ ...prev, adminPinHash: hash }));
    setRole(ROLE.ADMIN);
    return { ok: true };
  };

  /** Troca a senha (exige a atual). Só é chamada de dentro do modo ADM. */
  const changeAdminPassword = async (current, next) => {
    const stored = settingsRef.current?.adminPinHash;
    if (stored && (await hashPassword(current)) !== stored) {
      return { ok: false, error: 'Senha atual incorreta.' };
    }
    if ((next || '').length < MIN_PASSWORD_LENGTH) {
      return { ok: false, error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
    }
    const hash = await hashPassword(next);
    setSettings((prev) => ({ ...prev, adminPinHash: hash }));
    return { ok: true };
  };

  /** Volta para o modo Vendedor (não pede senha). */
  const lockAdmin = () => setRole(ROLE.VENDEDOR);

  /* ── Sincronização (push/pull last-write-wins) ── */
  const applyCollection = (key, ref, setState, value) => {
    ref.current = value;
    setState(value);
    dbSet(key, value);
  };

  const runSync = useCallback(async () => {
    if (!isOnline()) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      const since = metaRef.current.lastSyncAt || 0;
      const changed = (arr) => (arr || []).filter((r) => (r.updatedAt || 0) > since);

      const payload = {
        lastSyncAt: since,
        products: changed(productsRef.current),
        sales: changed(salesRef.current),
        serviceOrders: changed(osRef.current),
        settings: (settingsRef.current?.updatedAt || 0) > since ? settingsRef.current : null,
        tombstones: (tombsRef.current || []).filter((t) => (t.deletedAt || 0) > since),
      };

      const resp = await pushPull(payload);
      const serverTime = resp.serverTime || Date.now();

      // Agrupa tombstones remotos por coleção
      const removed = { products: [], sales: [], serviceOrders: [] };
      for (const t of resp.tombstones || []) {
        if (removed[t.store]) removed[t.store].push(String(t.id));
      }

      applyCollection(KEYS.products, productsRef, setProductsState, mergeRemote(productsRef.current, resp.products || [], removed.products));
      applyCollection(KEYS.sales, salesRef, setSalesState, mergeRemote(salesRef.current, resp.sales || [], removed.sales));
      applyCollection(KEYS.os, osRef, setOsListState, mergeRemote(osRef.current, resp.serviceOrders || [], removed.serviceOrders));

      if (resp.settings && (resp.settings.updatedAt || 0) > (settingsRef.current?.updatedAt || 0)) {
        settingsRef.current = resp.settings;
        setSettingsState(resp.settings);
        dbSet(KEYS.settings, resp.settings);
      }

      // Limpa tombstones já confirmados pelo servidor
      const remainingTombs = (tombsRef.current || []).filter((t) => (t.deletedAt || 0) > serverTime);
      tombsRef.current = remainingTombs;
      dbSet(KEYS.tombstones, remainingTombs);

      const newMeta = { ...metaRef.current, lastSyncAt: serverTime };
      metaRef.current = newMeta;
      setLastSyncAt(serverTime);
      dbSet(KEYS.meta, newMeta);

      setSyncStatus('synced');
    } catch (err) {
      console.warn('[sync] falhou:', err.message);
      setSyncStatus(isOnline() ? 'error' : 'offline');
    }
  }, []);

  // mantém a referência usada pelo debounce sempre atualizada
  useEffect(() => { runSyncRef.current = runSync; }, [runSync]);

  /* ── Carga inicial ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      await migrateFromLocalStorage();
      const [p, o, s, e, st, tomb, meta] = await Promise.all([
        dbGet(KEYS.products), dbGet(KEYS.os), dbGet(KEYS.sales), dbGet('etiquetas', []),
        dbGet(KEYS.settings), dbGet(KEYS.tombstones, []), dbGet(KEYS.meta, { lastSyncAt: 0 }),
      ]);
      if (!mounted) return;

      const initCollection = (key, ref, setState, stored, fallback) => {
        if (stored == null) {
          const { stamped } = diffStamp([], fallback);
          ref.current = stamped;
          setState(stamped);
          dbSet(key, stamped);
        } else {
          ref.current = stored;
          setState(stored);
        }
      };

      initCollection(KEYS.products, productsRef, setProductsState, p, defaultProducts);
      initCollection(KEYS.os, osRef, setOsListState, o, defaultOS);
      initCollection(KEYS.sales, salesRef, setSalesState, s, []);
      if (e == null) {
        etiquetasRef.current = defaultEtiquetas;
        setEtiquetasState(defaultEtiquetas);
        dbSet('etiquetas', defaultEtiquetas);
      } else {
        etiquetasRef.current = e;
        setEtiquetasState(e);
      }

      const initSettings = st == null ? { ...defaultSettings, id: 'singleton', updatedAt: Date.now() } : st;
      settingsRef.current = initSettings;
      setSettingsState(initSettings);
      if (st == null) dbSet(KEYS.settings, initSettings);

      tombsRef.current = tomb || [];
      metaRef.current = meta || { lastSyncAt: 0 };
      setLastSyncAt(meta?.lastSyncAt || 0);

      // ── Backup automático diário em arquivo ──
      // O sync não protege contra deleção propagada; o arquivo local sim.
      const lastBackupAt = metaRef.current.lastBackupAt || 0;
      const hasData = (salesRef.current?.length || 0) + (osRef.current?.length || 0) > 0;
      if (!autoBackupTriggered && hasData && Date.now() - lastBackupAt > AUTO_BACKUP_INTERVAL_MS) {
        autoBackupTriggered = true;
        // Grava o meta ANTES do download (e espera confirmar) para que uma
        // remontagem/reabertura não dispare backups repetidos no mesmo dia.
        metaRef.current = { ...metaRef.current, lastBackupAt: Date.now() };
        await dbSet(KEYS.meta, metaRef.current);
        try {
          downloadBackup(buildBackupPayload({
            products: productsRef.current,
            osList: osRef.current,
            sales: salesRef.current,
            settings: settingsRef.current,
          }), { auto: true });
        } catch (err) {
          console.warn('[backup] backup automático falhou:', err);
        }
      }

      runSync();
    })();
    return () => { mounted = false; };
  }, [runSync]);

  /* ── Sincronização periódica + eventos de rede ── */
  useEffect(() => {
    const id = setInterval(() => runSync(), 45000);
    const onOnline = () => runSync();
    const onOffline = () => setSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [runSync]);

  return (
    <GlobalStateContext.Provider value={{
      products, setProducts,
      osList, setOsList, addOS, updateOS, deleteOS,
      etiquetas, setEtiquetas,
      settings, setSettings,
      sales, setSales,
      addSale,
      // acesso
      role, isAdmin, hasAdminPassword,
      unlockAdmin, createAdminPassword, changeAdminPassword, lockAdmin,
      // sincronização (uso opcional pela UI)
      syncStatus, lastSyncAt, syncNow: runSync,
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- padrão Provider+hook no mesmo arquivo; sem impacto em produção
export const useGlobalState = () => {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) throw new Error('useGlobalState must be used within GlobalProvider');
  return ctx;
};
