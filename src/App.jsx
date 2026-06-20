import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import PDV from './modules/PDV';
import OS from './modules/OS';
import Dashboard from './modules/Dashboard';
import Config from './modules/Config';
import Estoque from './modules/Estoque';
import Vendas from './modules/Vendas';
import { GlobalProvider } from './context/GlobalState';
import './App.css';
import './modules/PrintOS.css';

function App() {
  const [activeModule, setActiveModule] = useState('pdv');

  const renderModule = () => {
    switch (activeModule) {
      case 'pdv':       return <PDV />;
      case 'os':        return <OS />;
      case 'dashboard': return <Dashboard />;
      case 'estoque':   return <Estoque />;
      case 'vendas':    return <Vendas />;
      case 'config':    return <Config />;
      default:          return <PDV />;
    }
  };

  return (
    <GlobalProvider>
      <div className="app-layout">
        <Sidebar activeModule={activeModule} setActiveModule={setActiveModule} />
        <main className="main-content">
          {renderModule()}
        </main>
      </div>
    </GlobalProvider>
  );
}

export default App;
