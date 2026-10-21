import { createContext, useContext, useEffect, useState } from 'react';
import { getStore } from '../constants/stores';
import { setActiveLocalDb } from '../utils/db';
import { loadCachedSystem, refreshSystem, saveSystem } from '../utils/system';
import StoreGate from '../components/StoreGate';

/**
 * Loja ativa + configuração global (códigos e senhas ADM de todas as lojas).
 *
 * Sem loja escolhida, mostra a tela de código. A escolha vale para a aba
 * (sessionStorage): um F5 no meio da venda não pede o código de novo, mas
 * fechar e abrir o sistema pede.
 */
const StoreContext = createContext(null);
const SESSION_KEY = 'infopdv-store';

const restoreStore = () => {
  try {
    const s = getStore(sessionStorage.getItem(SESSION_KEY));
    if (s) setActiveLocalDb(s.localDb); // antes de qualquer leitura local
    return s ? s.id : null;
  } catch {
    return null;
  }
};

export const StoreProvider = ({ children }) => {
  const [system, setSystem] = useState(loadCachedSystem);
  const [storeId, setStoreId] = useState(restoreStore);
  const store = getStore(storeId);

  // Atualiza códigos/senhas com o servidor ao abrir (sem rede usa o cache)
  useEffect(() => { refreshSystem().then(setSystem); }, []);

  const enterStore = (s) => {
    setActiveLocalDb(s.localDb);
    try { sessionStorage.setItem(SESSION_KEY, s.id); } catch { /* ignora */ }
    setStoreId(s.id);
  };

  /** Trocar de loja: recarrega o app limpo na tela de código. */
  const leaveStore = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignora */ }
    window.location.reload();
  };

  /** Altera a configuração global (recebe uma cópia, devolve a nova). */
  const updateSystem = async (mutate) => {
    const draft = JSON.parse(JSON.stringify(system));
    const res = await saveSystem(mutate(draft) || draft);
    setSystem(res.system);
    return res;
  };

  if (!store) return <StoreGate system={system} onEnter={enterStore} />;

  return (
    <StoreContext.Provider value={{ store, system, updateSystem, leaveStore }}>
      {children}
    </StoreContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- padrão Provider+hook
export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
