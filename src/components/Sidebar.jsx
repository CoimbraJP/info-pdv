import React from 'react';
import {
  ShoppingCart,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Package,
  Receipt,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import './Sidebar.css';

const SYNC_UI = {
  idle:    { Icon: Cloud,     label: 'Online',          cls: 'sync-ok' },
  synced:  { Icon: Cloud,     label: 'Sincronizado',    cls: 'sync-ok' },
  syncing: { Icon: RefreshCw, label: 'Sincronizando…',  cls: 'sync-busy' },
  offline: { Icon: CloudOff,  label: 'Offline (local)', cls: 'sync-off' },
  error:   { Icon: CloudOff,  label: 'Sem conexão',     cls: 'sync-err' },
};

const SyncStatus = () => {
  const { syncStatus, syncNow } = useGlobalState();
  const ui = SYNC_UI[syncStatus] || SYNC_UI.idle;
  const { Icon } = ui;
  return (
    <button
      type="button"
      className={`sync-status ${ui.cls}`}
      onClick={() => syncNow()}
      title="Clique para sincronizar agora"
    >
      <Icon size={15} className={syncStatus === 'syncing' ? 'sync-spin' : ''} aria-hidden="true" />
      <span>{ui.label}</span>
    </button>
  );
};

const menuItems = [
  { id: 'pdv',       icon: <ShoppingCart size={20} />,    label: 'Vendas (PDV)' },
  { id: 'vendas',    icon: <Receipt size={20} />,          label: 'Histórico de Vendas' },
  { id: 'os',        icon: <ClipboardList size={20} />,    label: 'Ordens de Serviço' },
  { id: 'dashboard', icon: <LayoutDashboard size={20} />,  label: 'Dashboard' },
  { id: 'estoque',   icon: <Package size={20} />,          label: 'Estoque' },
  { id: 'config',    icon: <Settings size={20} />,         label: 'Configurações' },
];

const Sidebar = ({ activeModule, setActiveModule }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo-square.png" alt="Info Centro" className="logo-img" />
        <h1 className="logo-text">INFO <span className="text-primary">CENTRO</span></h1>
      </div>

      <nav className="sidebar-nav" role="navigation" aria-label="Menu principal">
        {menuItems.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`nav-item ${activeModule === item.id ? 'active' : ''}`}
            onClick={() => setActiveModule(item.id)}
            aria-current={activeModule === item.id ? 'page' : undefined}
            title={item.label}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <SyncStatus />
        <div className="user-profile">
          <div className="avatar" aria-hidden="true">A</div>
          <div className="user-info">
            <span className="user-name">Administrador</span>
            <span className="user-role">Loja Principal</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
