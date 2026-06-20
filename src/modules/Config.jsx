import React, { useState, useRef } from 'react';
import { Settings, Printer, Eye, Store, Check, Database, Download, Upload, RefreshCw } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';

const THERMAL_MODELS = [
  {
    id: 'thermal-1',
    name: 'Padrão Simples',
    desc: 'Logo + dados + itens + total',
  },
  {
    id: 'thermal-2',
    name: 'Compacto',
    desc: 'Sem separadores, máx. papel',
  },
  {
    id: 'thermal-3',
    name: 'Detalhado',
    desc: 'Com unitário, qtd e subtotal',
  },
];

/* Miniatura visual de bobina térmica 58mm */
const ThermalPreview = ({ active }) => (
  <div style={{
    width: '44px',
    height: '60px',
    background: '#fff',
    borderRadius: '3px',
    padding: '4px 3px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
    opacity: active ? 1 : 0.55,
    transition: 'opacity 0.2s',
    flexShrink: 0,
  }}>
    {/* logo simulado */}
    <div style={{ height: '4px', background: '#555', borderRadius: '1px', width: '70%', margin: '0 auto' }} />
    <div style={{ height: '2px', background: '#bbb', borderRadius: '1px', width: '50%', margin: '0 auto' }} />
    {/* separator */}
    <div style={{ borderTop: '1px dashed #999', width: '100%', margin: '1px 0' }} />
    {/* items */}
    <div style={{ height: '2px', background: '#ccc', borderRadius: '1px', width: '100%' }} />
    <div style={{ height: '2px', background: '#ccc', borderRadius: '1px', width: '85%' }} />
    <div style={{ height: '2px', background: '#ccc', borderRadius: '1px', width: '100%' }} />
    {/* separator */}
    <div style={{ borderTop: '1px dashed #999', width: '100%', margin: '1px 0' }} />
    {/* total */}
    <div style={{ height: '3px', background: '#333', borderRadius: '1px', width: '60%', marginLeft: 'auto' }} />
    {/* footer */}
    <div style={{ marginTop: 'auto', height: '2px', background: '#bbb', borderRadius: '1px', width: '50%', margin: '0 auto' }} />
  </div>
);

const styles = `
.config-wrap { display: flex; flex-direction: column; gap: var(--s-6); }

.config-card-header {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding-bottom: var(--s-4);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: var(--s-5);
}
.config-card-header h3 { font-size: 1rem; font-weight: 700; }

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-4);
}
@media (max-width: 720px) { .settings-grid { grid-template-columns: 1fr; } }

.thermal-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-4);
}

.thermal-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-4) var(--s-3);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-hover);
  cursor: pointer;
  transition: all var(--t-fast);
  user-select: none;
  text-align: center;
}
.thermal-card:hover {
  border-color: var(--border-strong);
  background: var(--surface-active);
}
.thermal-card.selected {
  border-color: var(--primary-color);
  background: var(--primary-subtle);
  box-shadow: 0 0 16px var(--primary-glow);
}
.thermal-card-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
}
.thermal-card.selected .thermal-card-name { color: var(--primary-color); }
.thermal-card-desc {
  font-size: 0.72rem;
  color: var(--text-dim);
  line-height: 1.3;
}

.info-tip {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4);
  background: var(--primary-subtle);
  border: 1px solid rgba(255,215,0,0.2);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
}
`;

const Config = () => {
  const {
    settings, setSettings,
    products, setProducts,
    osList, setOsList,
    sales, setSales,
    syncNow,
  } = useGlobalState();
  const [saved, setSaved] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const fileInputRef = useRef(null);
  const [storeForm, setStoreForm] = useState({
    storeName: settings?.storeName || 'Info Centro',
    storePhone: settings?.storePhone || '(12) 99999-9999',
    storeAddress: settings?.storeAddress || 'SJC — São Paulo',
  });

  const currentTemplate = settings?.osPrintTemplate || 'thermal-1';

  const flashBackup = (msg) => {
    setBackupMsg(msg);
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const handleExport = () => {
    const payload = {
      app: 'INFO CENTRO',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { products, serviceOrders: osList, sales, settings },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `infocentro-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashBackup({ type: 'ok', text: 'Backup exportado com sucesso.' });
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const d = parsed.data || parsed;
        if (!d || (!Array.isArray(d.products) && !Array.isArray(d.sales) && !Array.isArray(d.serviceOrders))) {
          throw new Error('Arquivo inválido');
        }
        const ok = window.confirm(
          'Importar este backup vai SUBSTITUIR os dados atuais (produtos, vendas, ordens de serviço e configurações). Deseja continuar?'
        );
        if (!ok) return;

        if (Array.isArray(d.products)) setProducts(d.products);
        if (Array.isArray(d.serviceOrders)) setOsList(d.serviceOrders);
        if (Array.isArray(d.sales)) setSales(d.sales);
        if (d.settings) setSettings(d.settings);

        flashBackup({ type: 'ok', text: 'Backup importado. Os dados foram restaurados.' });
        syncNow?.();
      } catch (err) {
        flashBackup({ type: 'err', text: `Falha ao importar: ${err.message}` });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleTemplateChange = (id) => {
    setSettings({ ...settings, osPrintTemplate: id });
  };

  const handleSaveStore = (e) => {
    e.preventDefault();
    setSettings({ ...settings, ...storeForm });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="os-container">
      <style>{styles}</style>

      <div className="module-header">
        <h2 className="module-title flex items-center gap-2">
          <Settings size={22} className="text-primary" />
          Configurações do Sistema
        </h2>
        <button className="btn btn-surface" onClick={() => window.print()}>
          <Eye size={18} />
          Testar Impressão
        </button>
      </div>

      <div className="module-body">
        <div className="config-wrap">

          {/* ── Dados da Loja ── */}
          <div className="card">
            <div className="config-card-header">
              <Store size={20} className="text-primary" />
              <h3>Dados da Loja</h3>
            </div>
            <form onSubmit={handleSaveStore}>
              <div className="settings-grid mb-6">
                <div className="form-group">
                  <label>Nome da Loja</label>
                  <input
                    type="text" className="input"
                    value={storeForm.storeName}
                    onChange={e => setStoreForm({ ...storeForm, storeName: e.target.value })}
                    placeholder="Info Centro"
                  />
                </div>
                <div className="form-group">
                  <label>Telefone</label>
                  <input
                    type="text" className="input"
                    value={storeForm.storePhone}
                    onChange={e => setStoreForm({ ...storeForm, storePhone: e.target.value })}
                    placeholder="(12) 99999-9999"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Endereço (exibido no cupom)</label>
                  <input
                    type="text" className="input"
                    value={storeForm.storeAddress}
                    onChange={e => setStoreForm({ ...storeForm, storeAddress: e.target.value })}
                    placeholder="Rua Exemplo, 123 — SJC/SP"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  {saved ? <><Check size={16} /> Salvo!</> : 'Salvar Dados'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Impressora Térmica 58mm ── */}
          <div className="card">
            <div className="config-card-header">
              <Printer size={20} className="text-primary" />
              <h3>Modelo de Impressão — Térmica 58mm</h3>
            </div>

            <div className="thermal-grid mb-6">
              {THERMAL_MODELS.map(model => (
                <div
                  key={model.id}
                  className={`thermal-card ${currentTemplate === model.id ? 'selected' : ''}`}
                  onClick={() => handleTemplateChange(model.id)}
                  role="radio"
                  aria-checked={currentTemplate === model.id}
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleTemplateChange(model.id)}
                >
                  <ThermalPreview active={currentTemplate === model.id} />
                  <span className="thermal-card-name">{model.name}</span>
                  <span className="thermal-card-desc">{model.desc}</span>
                </div>
              ))}
            </div>

            <div className="info-tip">
              <Printer size={16} className="text-primary" />
              <span>
                Papel configurado: <strong>58 × 210 mm</strong> — Modelo ativo:{' '}
                <strong className="text-primary">
                  {THERMAL_MODELS.find(m => m.id === currentTemplate)?.name || currentTemplate}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Backup & Dados ── */}
          <div className="card">
            <div className="config-card-header">
              <Database size={20} className="text-primary" />
              <h3>Backup &amp; Dados</h3>
            </div>

            <p className="text-sm text-muted mb-4">
              Exporte todos os dados (produtos, vendas, ordens de serviço e configurações) para um arquivo
              JSON, ou restaure a partir de um backup. Os dados também são sincronizados automaticamente
              com o banco na nuvem quando há internet.
            </p>

            <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleExport}>
                <Download size={16} />
                Exportar Backup (JSON)
              </button>
              <button className="btn btn-surface" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                Importar / Restaurar
              </button>
              <button className="btn btn-surface" onClick={() => syncNow?.()}>
                <RefreshCw size={16} />
                Sincronizar agora
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>

            <div className="flex gap-4 text-sm text-muted" style={{ flexWrap: 'wrap' }}>
              <span>Produtos: <strong className="text-main">{products.length}</strong></span>
              <span>Vendas: <strong className="text-main">{sales.length}</strong></span>
              <span>Ordens de Serviço: <strong className="text-main">{osList.length}</strong></span>
            </div>

            {backupMsg && (
              <div
                className="info-tip"
                style={{
                  marginTop: 'var(--s-4)',
                  borderColor: backupMsg.type === 'err' ? 'rgba(239,68,68,0.3)' : undefined,
                }}
              >
                <Database size={16} className={backupMsg.type === 'err' ? 'text-danger' : 'text-primary'} />
                <span>{backupMsg.text}</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Print preview (hidden on screen) */}
      <div className="print-only">
        <div className="print-header">
          <span className="print-logo">{storeForm.storeName}</span>
          <p>{storeForm.storeAddress}</p>
          <p>Tel: {storeForm.storePhone}</p>
        </div>
        <div className="print-section">
          <span className="print-section-title">Teste de Impressão</span>
          <p>Modelo: {THERMAL_MODELS.find(m => m.id === currentTemplate)?.name}</p>
          <p>Papel: 58 × 210 mm</p>
          <p>Sistema: Info Centro</p>
        </div>
        <div className="print-footer">
          <p>Impressora configurada!</p>
          <p>infocentro.com.br</p>
        </div>
      </div>
    </div>
  );
};

export default Config;
