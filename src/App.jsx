import { useState } from 'react';
import Sidebar from './components/Sidebar';
import PDV from './modules/PDV';
import OS from './modules/OS';
import Dashboard from './modules/Dashboard';
import Config from './modules/Config';
import Estoque from './modules/Estoque';
import Etiquetas from './modules/Etiquetas';
import Vendas from './modules/Vendas';
import { GlobalProvider, useGlobalState } from './context/GlobalState';
import { StoreProvider } from './context/StoreContext';
import { canAccessModule } from './utils/auth';
import UpdateBanner from './components/UpdateBanner';
import './App.css';
import './modules/PrintOS.css';

/**
 * Casca do app (dentro do Provider, para poder ler o papel atual).
 * Tela administrativa nunca renderiza no modo Vendedor — mesmo que o
 * estado aponte para ela (ex.: acabou de sair do modo ADM).
 */
function AppShell() {
  const { isAdmin } = useGlobalState();
  const [activeModule, setActiveModule] = useState('pdv');
  // Atalho "Abrir OS" do PDV: abre a tela de OS já no formulário de nova OS
  const [osStartTab, setOsStartTab] = useState(null);
  const openNewOS = () => { setOsStartTab('new'); setActiveModule('os'); };
  const current = canAccessModule(activeModule, isAdmin) ? activeModule : 'pdv';

  const renderModule = () => {
    switch (current) {
      case 'pdv':       return <PDV onOpenOS={openNewOS} />;
      case 'os':        return <OS startTab={osStartTab} onStartTabUsed={() => setOsStartTab(null)} />;
      case 'dashboard': return <Dashboard />;
      case 'estoque':   return <Estoque />;
      case 'etiquetas': return <Etiquetas />;
      case 'vendas':    return <Vendas />;
      case 'config':    return <Config />;
      default:          return <PDV />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeModule={current} setActiveModule={setActiveModule} />
      <main className="main-content">
        {renderModule()}
      </main>
    </div>
  );
}

function App() {
  return (
    <>
      <UpdateBanner />
      <StoreProvider>
        <GlobalProvider>
          <AppShell />
        </GlobalProvider>
      </StoreProvider>
    </>
  );
}

export default App;
