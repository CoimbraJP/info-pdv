import { useState, useRef } from 'react';
import { Settings, Printer, Eye, Store, Check, Database, Download, Upload, RefreshCw, ShieldCheck, Sun, Moon, Palette, KeyRound, ImagePlus, Trash2 } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { buildBackupPayload, downloadBackup } from '../utils/backup';
import { ReceiptHeader } from '../components/ReceiptBrand';
import { STORES, storeBrand } from '../constants/stores';

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
.logo-row { display: flex; align-items: center; gap: var(--s-4); }
.logo-preview {
  width: 72px; height: 72px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
  background: var(--surface-hover); overflow: hidden;
  font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: var(--primary-color);
}
.logo-preview img { width: 100%; height: 100%; object-fit: contain; }
.cred-table { display: flex; flex-direction: column; gap: var(--s-3); }
.cred-row {
  display: grid; grid-template-columns: minmax(150px, 1fr) 1.3fr 1.3fr; gap: var(--s-3); align-items: center;
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
}
.cred-store { display: flex; flex-direction: column; gap: 2px; }
.cred-field { display: flex; gap: var(--s-2); }
.cred-field .input { min-width: 0; }
@media (max-width: 900px) { .cred-row { grid-template-columns: 1fr; } }
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

/** Reduz o logo para no máx. 256px (PNG, mantém transparência) — cabe no sync. */
const compressLogo = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'));
    img.onload = () => {
      const scale = Math.min(1, 256 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const Config = () => {
  const {
    settings, setSettings,
    products, setProducts,
    osList, setOsList,
    sales, setSales,
    syncNow,
    changeAdminPassword,
    store, system, setStoreCredentials,
  } = useGlobalState();
  const brand = storeBrand(store, settings);
  const logoInputRef = useRef(null);
  const [logoMsg, setLogoMsg] = useState('');
  // Painel master: valores digitados por loja ({ [id]: { code, admin } })
  const [credForm, setCredForm] = useState({});
  const [credMsg, setCredMsg] = useState(null);
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [passMsg, setPassMsg] = useState(null);
  const [saved, setSaved] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const fileInputRef = useRef(null);
  const [storeForm, setStoreForm] = useState({
    storeName: settings?.storeName || store.name,
    storeSlogan: settings?.storeSlogan || '',
    storePhone: settings?.storePhone || '',
    storeAddress: settings?.storeAddress || '',
    storeSite: brand.site || '',
  });

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressLogo(file);
      setSettings({ ...settings, logoDataUrl: dataUrl });
      setLogoMsg('Logo atualizado.');
    } catch (err) {
      setLogoMsg(err.message);
    }
    setTimeout(() => setLogoMsg(''), 3000);
  };

  const handleRemoveLogo = () => {
    setSettings({ ...settings, logoDataUrl: null });
  };

  const handleSaveCredential = async (storeId, field) => {
    const value = credForm[storeId]?.[field];
    if (!value) return;
    const res = await setStoreCredentials(storeId, field === 'code' ? { code: value } : { adminPassword: value });
    const name = STORES.find(s => s.id === storeId)?.name;
    if (res.ok) {
      setCredForm(prev => ({ ...prev, [storeId]: { ...prev[storeId], [field]: '' } }));
      setCredMsg({
        type: 'ok',
        text: `${field === 'code' ? 'Código de entrada' : 'Senha ADM'} da ${name} alterado${res.synced ? '.' : ' (sem internet agora — envia ao reconectar).'}`,
      });
    } else {
      setCredMsg({ type: 'err', text: res.error });
    }
    setTimeout(() => setCredMsg(null), 6000);
  };

  const currentTemplate = settings?.osPrintTemplate || 'thermal-1';

  const flashBackup = (msg) => {
    setBackupMsg(msg);
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const handleExport = () => {
    downloadBackup(buildBackupPayload({ products, osList, sales, settings, storeId: store.id }));
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
        // Restaurar backup não muda a senha do ADM: um backup antigo (sem hash)
        // apagaria a senha e liberaria o "criar senha" para qualquer pessoa.
        if (d.settings) setSettings({ ...d.settings, adminPinHash: settings?.adminPinHash || d.settings.adminPinHash });
        // As senhas ficam na configuração global das lojas: restaurar backup não as altera.

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passForm.next !== passForm.confirm) {
      setPassMsg({ type: 'err', text: 'A nova senha e a confirmação não conferem.' });
      return;
    }
    const res = await changeAdminPassword(passForm.current, passForm.next);
    if (res.ok) {
      setPassForm({ current: '', next: '', confirm: '' });
      setPassMsg({ type: 'ok', text: 'Senha alterada. Vale para todos os terminais após sincronizar.' });
    } else {
      setPassMsg({ type: 'err', text: res.error });
    }
    setTimeout(() => setPassMsg(null), 5000);
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
        <h2 className="module-title">
          <Settings size={20} className="text-primary" />
          Configurações
        </h2>
        <button className="btn-outline btn-outline-sm" onClick={() => window.print()}>
          <Eye size={16} /> Testar Impressão
        </button>
      </div>

      <div className="module-body">
        <div className="config-wrap">

          {/* ── Aparência ── */}
          <section className="panel">
            <header className="panel-head">
              <h3 className="panel-title"><Palette size={17} /> Aparência</h3>
              <div className="seg-control" role="group" aria-label="Tema">
                <button
                  type="button"
                  className={`seg-item ${settings?.theme !== 'light' ? 'is-active' : ''}`}
                  onClick={() => setSettings({ ...settings, theme: 'dark' })}
                >
                  <Moon size={14} /> Escuro
                </button>
                <button
                  type="button"
                  className={`seg-item ${settings?.theme === 'light' ? 'is-active' : ''}`}
                  onClick={() => setSettings({ ...settings, theme: 'light' })}
                >
                  <Sun size={14} /> Claro
                </button>
              </div>
            </header>
            <p className="text-sm text-muted">
              Vale para todos os terminais da loja (sincroniza junto com as configurações).
            </p>
          </section>

          {/* ── Dados da Loja ── */}
          <section className="panel">
            <header className="panel-head">
              <h3 className="panel-title"><Store size={17} /> Dados da Loja</h3>
            </header>
            <div className="logo-row mb-5">
              <div className="logo-preview">
                {brand.logo
                  ? <img src={brand.logo} alt="Logo da loja" />
                  : <span>{brand.name.charAt(0)}</span>}
              </div>
              <div>
                <p className="font-medium">Logo da loja</p>
                <p className="text-sm text-muted mb-2">Aparece no menu e no topo dos cupons e da OS. PNG quadrado de preferência.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-outline btn-outline-sm" onClick={() => logoInputRef.current?.click()}>
                    <ImagePlus size={15} /> {settings?.logoDataUrl ? 'Trocar logo' : 'Enviar logo'}
                  </button>
                  {settings?.logoDataUrl && (
                    <button type="button" className="btn-outline btn-outline-sm" onClick={handleRemoveLogo}>
                      <Trash2 size={15} /> Remover
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFile} style={{ display: 'none' }} />
                </div>
                {logoMsg && <p className="text-sm text-muted mt-2">{logoMsg}</p>}
              </div>
            </div>

            <form onSubmit={handleSaveStore}>
              <div className="settings-grid mb-6">
                <div className="form-group">
                  <label>Nome da Loja</label>
                  <input
                    type="text" className="input"
                    value={storeForm.storeName}
                    onChange={e => setStoreForm({ ...storeForm, storeName: e.target.value })}
                    placeholder={store.name}
                  />
                </div>
                <div className="form-group">
                  <label>Slogan (opcional, sai no cupom)</label>
                  <input
                    type="text" className="input"
                    value={storeForm.storeSlogan}
                    onChange={e => setStoreForm({ ...storeForm, storeSlogan: e.target.value })}
                    placeholder="Assistência Técnica e Vendas"
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
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Site (rodapé do cupom — deixe vazio para não imprimir)</label>
                  <input
                    type="text" className="input"
                    value={storeForm.storeSite}
                    onChange={e => setStoreForm({ ...storeForm, storeSite: e.target.value })}
                    placeholder="minhaloja.com.br"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  {saved ? <><Check size={16} /> Salvo!</> : 'Salvar Dados'}
                </button>
              </div>
            </form>
          </section>

          {/* ── Impressora Térmica 58mm ── */}
          <section className="panel">
            <header className="panel-head">
              <h3 className="panel-title"><Printer size={17} /> Impressão — Térmica 58mm</h3>
            </header>

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
          </section>

          {/* ── Backup & Dados ── */}
          <section className="panel">
            <header className="panel-head">
              <h3 className="panel-title"><Database size={17} /> Backup &amp; Dados</h3>
            </header>

            <p className="text-sm text-muted mb-4">
              Exporte todos os dados (produtos, vendas, ordens de serviço e configurações) para um arquivo
              JSON, ou restaure a partir de um backup. Além do sync com a nuvem, o sistema baixa
              automaticamente <strong>um backup por dia</strong> na primeira abertura — guarde esses
              arquivos fora deste computador (Drive, pendrive). O sync não substitui backup: uma
              exclusão indevida se propaga para a nuvem; o arquivo é a cópia segura.
            </p>

            <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleExport}>
                <Download size={16} />
                Exportar Backup (JSON)
              </button>
              <button className="btn-outline btn-outline-sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                Importar / Restaurar
              </button>
              <button className="btn-outline btn-outline-sm" onClick={() => syncNow?.()}>
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
          </section>

          {/* ── Acesso do Administrador ── */}
          <section className="panel">
            <header className="panel-head">
              <h3 className="panel-title"><ShieldCheck size={17} /> Senha do Administrador</h3>
            </header>
            <p className="text-sm text-muted mb-4">
              O sistema sempre abre no modo Vendedor (PDV, Ordens de Serviço e Estoque sem custos).
              Esta senha libera o modo ADM ao clicar no perfil no rodapé do menu.
            </p>
            <form onSubmit={handleChangePassword}>
              <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
                <div className="form-group flex-1" style={{ minWidth: '160px' }}>
                  <label>Senha atual</label>
                  <input
                    type="password" className="input" autoComplete="current-password" required
                    value={passForm.current}
                    onChange={e => setPassForm({ ...passForm, current: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1" style={{ minWidth: '160px' }}>
                  <label>Nova senha</label>
                  <input
                    type="password" className="input" autoComplete="new-password" required
                    value={passForm.next}
                    onChange={e => setPassForm({ ...passForm, next: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1" style={{ minWidth: '160px' }}>
                  <label>Confirmar nova senha</label>
                  <input
                    type="password" className="input" autoComplete="new-password" required
                    value={passForm.confirm}
                    onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className={`text-sm ${passMsg?.type === 'err' ? 'text-danger' : 'text-success'}`}>
                  {passMsg?.text || ''}
                </span>
                <button type="submit" className="btn btn-primary">Alterar senha</button>
              </div>
            </form>
          </section>

          {/* ── Senhas do sistema (master — só Info Centro) ── */}
          {store.master && (
            <section className="panel">
              <header className="panel-head">
                <h3 className="panel-title"><KeyRound size={17} /> Senhas do sistema</h3>
                <span className="badge badge-primary">Master</span>
              </header>
              <p className="text-sm text-muted mb-4">
                Código de entrada abre a loja no modo Vendedor. Senha ADM libera custos, relatórios e configurações daquela loja.
                Aqui você define sem precisar da senha atual. Só aparece na Info Centro.
              </p>
              <div className="cred-table">
                {STORES.map(s => {
                  const sys = system.stores[s.id] || {};
                  const f = credForm[s.id] || {};
                  const setF = (k, v) => setCredForm(prev => ({ ...prev, [s.id]: { ...prev[s.id], [k]: v } }));
                  return (
                    <div key={s.id} className="cred-row">
                      <div className="cred-store">
                        <strong>{s.name}</strong>
                        <span className="text-xs text-dim">
                          Código: {sys.codeHash ? 'personalizado' : `padrão (${s.defaultCode})`} ·
                          ADM: {sys.adminPinHash || (s.master && settings?.adminPinHash) ? 'definida' : 'não definida'}
                        </span>
                      </div>
                      <div className="cred-field">
                        <input
                          type="password" inputMode="numeric" className="input" autoComplete="new-password"
                          placeholder="Novo código (só números)"
                          value={f.code || ''}
                          onChange={e => setF('code', e.target.value.replace(/\D/g, ''))}
                          onKeyDown={e => e.key === 'Enter' && handleSaveCredential(s.id, 'code')}
                        />
                        <button type="button" className="btn-outline btn-outline-sm" disabled={!f.code} onClick={() => handleSaveCredential(s.id, 'code')}>
                          Salvar código
                        </button>
                      </div>
                      <div className="cred-field">
                        <input
                          type="password" className="input" autoComplete="new-password"
                          placeholder="Nova senha ADM"
                          value={f.admin || ''}
                          onChange={e => setF('admin', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveCredential(s.id, 'admin')}
                        />
                        <button type="button" className="btn-outline btn-outline-sm" disabled={!f.admin} onClick={() => handleSaveCredential(s.id, 'admin')}>
                          Salvar senha
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {credMsg && (
                <p className={`text-sm mt-3 ${credMsg.type === 'err' ? 'text-danger' : 'text-success'}`}>{credMsg.text}</p>
              )}
            </section>
          )}

        </div>
      </div>

      {/* Print preview (hidden on screen) */}
      <div className="print-only">
        <ReceiptHeader override={storeForm} />
        <div className="print-section">
          <span className="print-section-title">Teste de Impressão</span>
          <p>Modelo: {THERMAL_MODELS.find(m => m.id === currentTemplate)?.name}</p>
          <p>Papel: 58 × 210 mm</p>
          <p>Loja: {storeForm.storeName}</p>
        </div>
        <div className="print-footer">
          <p>Impressora configurada!</p>
          {storeForm.storeSite && <p>{storeForm.storeSite}</p>}
        </div>
      </div>
    </div>
  );
};

export default Config;
