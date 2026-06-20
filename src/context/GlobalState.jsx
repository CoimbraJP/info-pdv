import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  KEYS, STORE, dbGet, dbSet, migrateFromLocalStorage, diffStamp, mergeRemote,
} from '../utils/db';
import { pushPull, isOnline } from '../utils/sync';

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

const defaultOS = [
  { id: '1001', client: 'João Silva', device: 'Notebook Dell Inspiron', status: 'Em análise', date: new Date().toISOString(), problem: 'Computador não liga após queda de energia.', services: [], total: 0, serviceValue: 0 },
  { id: '1002', client: 'Maria Oliveira', device: 'PC Gamer Custom', status: 'Aguardando Aprovação / Peças', date: new Date(Date.now() - 86400000).toISOString(), problem: 'Sistema travando durante jogos.', services: [], total: 0, serviceValue: 0 },
];

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
  const [settings, setSettingsState] = useState(defaultSettings);

  const [syncStatus, setSyncStatus] = useState(isOnline() ? 'idle' : 'offline');
  const [lastSyncAt, setLastSyncAt] = useState(0);

  /* refs = espelho síncrono do estado, para escrita/diff sem depender do ciclo do React */
  const productsRef = useRef([]);
  const osRef = useRef([]);
  const salesRef = useRef([]);
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
    setSales((prev) => [...prev, { id: Date.now(), ...saleData, date: new Date().toISOString() }]);
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
      const [p, o, s, st, tomb, meta] = await Promise.all([
        dbGet(KEYS.products), dbGet(KEYS.os), dbGet(KEYS.sales),
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

      const initSettings = st == null ? { ...defaultSettings, id: 'singleton', updatedAt: Date.now() } : st;
      settingsRef.current = initSettings;
      setSettingsState(initSettings);
      if (st == null) dbSet(KEYS.settings, initSettings);

      tombsRef.current = tomb || [];
      metaRef.current = meta || { lastSyncAt: 0 };
      setLastSyncAt(meta?.lastSyncAt || 0);

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
      settings, setSettings,
      sales, setSales,
      addSale,
      // sincronização (uso opcional pela UI)
      syncStatus, lastSyncAt, syncNow: runSync,
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) throw new Error('useGlobalState must be used within GlobalProvider');
  return ctx;
};
