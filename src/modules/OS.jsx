import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Wrench, User, FileText, CheckCircle, Clock, Printer, LayoutGrid, List, Trash2, X, ChevronDown, ChevronRight, Pencil, Save, Laptop } from 'lucide-react';
import { formatCurrency, formatDate, parseDate } from '../utils/formatters';
import { useGlobalState } from '../context/GlobalState';
import { OS_STATUS, OS_STATUS_WORK, OS_STATUS_META, normalizeStatus } from '../constants/osStatus';
import './OS.css';

const EMPTY_ADDRESS = { cep: '', street: '', number: '', neighborhood: '', city: '', state: '' };

/** Endereço em duas linhas: "Rua, nº - Bairro" / "Cidade - UF, CEP". */
const addressLines = (addr) => {
  if (!addr) return [];
  const l1 = [[addr.street, addr.number].filter(Boolean).join(', '), addr.neighborhood]
    .filter(Boolean).join(' - ');
  const l2 = [[addr.city, addr.state].filter(Boolean).join(' - '), addr.cep]
    .filter(Boolean).join(', ');
  return [l1, l2].filter(Boolean);
};

/** Extrai o S/N de `deviceFull` ("Tipo Marca - S/N: XXX"). */
const deviceSerial = (os) => {
  const m = String(os?.deviceFull || '').match(/S\/N:\s*(.+)$/i);
  const sn = m?.[1]?.trim();
  return sn && sn.toLowerCase() !== 'n/a' ? `S/N ${sn}` : '';
};

/**
 * Badge de status: substitui o <select> por um controle próprio.
 * Só alterna entre os status de trabalho — "Encerrado" vem do botão Encerrar.
 */
const StatusPill = ({ status, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const meta = OS_STATUS_META[status] || OS_STATUS_META[OS_STATUS.ANALISE];
  const locked = status === OS_STATUS.ENCERRADO;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="status-pill-wrap" ref={ref}>
      <button
        type="button"
        className={`status-pill ${open ? 'is-open' : ''}`}
        style={{ '--pill-color': meta.color, '--pill-bg': meta.bg }}
        onClick={() => !locked && setOpen(o => !o)}
        disabled={locked}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={locked ? 'OS encerrada' : 'Alterar situação'}
      >
        <span className="status-dot" aria-hidden="true" />
        <span className="status-pill-label">{meta.label}</span>
        {!locked && <ChevronDown size={13} className="status-pill-caret" aria-hidden="true" />}
      </button>

      {open && (
        <ul className="status-menu" role="listbox">
          {OS_STATUS_WORK.map((s) => {
            const m = OS_STATUS_META[s];
            return (
              <li key={s}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s === status}
                  className={`status-menu-item ${s === status ? 'is-active' : ''}`}
                  style={{ '--pill-color': m.color }}
                  onClick={() => { onChange(s); setOpen(false); }}
                >
                  <span className="status-dot" aria-hidden="true" />
                  {m.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const OS = () => {
  const { osList, setOsList, settings } = useGlobalState();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOS, setEditingOS] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceItems, setServiceItems] = useState([]);
  const [newItem, setNewItem] = useState({ description: '', price: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [accessories, setAccessories] = useState('');
  const [clientHistory, setClientHistory] = useState([]); // OS anteriores do CPF digitado
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientCPF: '',
    clientBirthDate: '',
    deviceType: 'Notebook',
    deviceBrand: '',
    deviceSN: '',
    devicePassword: '',
    defect: ''
  });
  const numberInputRef = useRef(null);

  /**
   * Próximo número de OS: sequência baseada no maior ID numérico existente.
   * (O esquema antigo — últimos 4 dígitos do timestamp — repetia a cada 10s
   * e o sync mescla por ID, então uma OS podia sobrescrever outra.)
   */
  const nextOsId = () => {
    const max = osList.reduce((m, os) => {
      const n = parseInt(os.id, 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 1000);
    return String(max + 1);
  };

  const handleSave = (e) => {
    e.preventDefault();

    const newOs = {
      id: nextOsId(),
      client: formData.clientName,
      device: `${formData.deviceType} ${formData.deviceBrand}`,
      status: OS_STATUS.ANALISE, // padrão
      date: new Date().toISOString(), // sempre ISO; formatar só na exibição
      clientPhone: formData.clientPhone,
      clientCPF: formData.clientCPF,
      clientBirthDate: formData.clientBirthDate,
      clientAddress: { ...address }, // agora persiste (antes era coletado e descartado)
      deviceFull: `${formData.deviceType} ${formData.deviceBrand} - S/N: ${formData.deviceSN}`,
      devicePassword: formData.devicePassword,
      defect: formData.defect,
      accessories: accessories,
      services: [],
      serviceValue: 0,
      readyDate: ''
    };

    setOsList([...osList, newOs]);
    setTimeout(() => {
      window.print();
      setActiveTab('list');
      setFormData({
        clientName: '', clientPhone: '', clientCPF: '', clientBirthDate: '',
        deviceType: 'Notebook', deviceBrand: '', deviceSN: '',
        devicePassword: '', defect: ''
      });
      setAddress(EMPTY_ADDRESS);
      setAccessories('');
      setClientHistory([]);
    }, 100);
  };
  
  const [isDeviceExpanded, setIsDeviceExpanded] = useState(false);
  const [isServicesExpanded, setIsServicesExpanded] = useState(true);

  const handleEdit = (os) => {
    setIsDeviceExpanded(false);
    // Carrega o registro REAL, sem fallbacks inventados (o código anterior
    // injetava CPF/telefone/serviços fictícios que eram gravados por cima
    // dos dados verdadeiros ao salvar).
    setEditingOS({
      ...os,
      entryDate: os.date || '',
      readyDate: os.readyDate || '',
      serviceValue: os.serviceValue || 0,
      deviceFull: os.deviceFull || os.device || '',
      status: normalizeStatus(os.status),
      clientBirthDate: os.clientBirthDate || '',
      clientAddress: { ...EMPTY_ADDRESS, ...(os.clientAddress || {}) },
    });
    setServiceItems(Array.isArray(os.services) ? os.services : []);
  };

  const closeEdit = () => {
    setEditingOS(null);
  };

  /** "Cliente desde": data da primeira OS daquele CPF. */
  const clientSince = (cpf) => {
    const clean = (cpf || '').replace(/\D/g, '');
    if (!clean) return '—';
    const dates = osList
      .filter(os => (os.clientCPF || '').replace(/\D/g, '') === clean)
      .map(os => parseDate(os.date))
      .filter(Boolean)
      .sort((a, b) => a - b);
    return dates.length ? formatDate(dates[0]) : '—';
  };

  // O modal de edição de cliente será implementado depois.
  const handleEditClient = () => {};

  // Persiste também a LISTA de serviços (antes só o total era salvo e o
  // detalhamento do que foi feito no equipamento se perdia ao fechar a tela).
  const persistEditing = (extra = {}) => {
    if (!editingOS) return;
    const updatedOS = {
      ...editingOS,
      services: serviceItems,
      serviceValue: totalServices,
      ...extra,
    };
    setOsList(prev => prev.map(os => (os.id === updatedOS.id ? updatedOS : os)));
    setEditingOS(null);
  };

  const handleCloseOS = () => persistEditing({
    status: OS_STATUS.ENCERRADO,
    readyDate: new Date().toISOString().split('T')[0],
  });
  const saveEdit = () => persistEditing();

  const openNewService = () => {
    setEditingServiceId(null);
    setNewItem({ description: '', price: '' });
    setShowServiceModal(true);
  };

  const openEditService = (item) => {
    setEditingServiceId(item.id);
    setNewItem({ description: item.description, price: String(item.price) });
    setShowServiceModal(true);
  };

  /** Grava serviço novo ou altera o existente e mantém o total sincronizado. */
  const submitService = () => {
    if (!newItem.description || !newItem.price) return;
    const price = parseFloat(newItem.price) || 0;
    const newItems = editingServiceId
      ? serviceItems.map(s => (s.id === editingServiceId ? { ...s, description: newItem.description, price } : s))
      : [...serviceItems, { id: crypto.randomUUID(), description: newItem.description, price }];

    setServiceItems(newItems);
    setNewItem({ description: '', price: '' });
    setEditingServiceId(null);
    setShowServiceModal(false);
    setEditingOS(prev => ({ ...prev, serviceValue: newItems.reduce((a, s) => a + s.price, 0) }));
  };

  const removeServiceItem = (id) => {
    const newItems = serviceItems.filter(item => item.id !== id);
    setServiceItems(newItems);
    setEditingOS(prev => ({ ...prev, serviceValue: newItems.reduce((a, s) => a + s.price, 0) }));
  };

  const totalServices = serviceItems.reduce((acc, item) => acc + item.price, 0);

  const handleCEPChange = async (value) => {
    setAddress(prev => ({ ...prev, cep: value }));
    const cleanCEP = value.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(prev => ({
            ...prev,
            cep: value,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }));
          // Auto focus on number field
          setTimeout(() => numberInputRef.current?.focus(), 100);
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  /**
   * Consulta o CPF na base local (que é o espelho do banco): se o cliente já
   * fez OS, preenche TODOS os dados dele (menos equipamento) e monta o
   * histórico exibido acima da seção do equipamento.
   */
  const lookupClientByCPF = (cpf) => {
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      setClientHistory([]);
      return;
    }
    const history = osList
      .filter(os => os.clientCPF && os.clientCPF.replace(/\D/g, '') === cleanCpf)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    setClientHistory(history);
    if (history.length === 0) return;

    // Registro mais recente que tenha cada dado (OS antigas podem não ter tudo)
    const pick = (field) => history.find(os => os[field] && (typeof os[field] !== 'object' || os[field].cep || os[field].street))?.[field];
    setFormData(prev => ({
      ...prev,
      clientName: pick('client') || prev.clientName,
      clientPhone: pick('clientPhone') || prev.clientPhone,
      clientBirthDate: pick('clientBirthDate') || prev.clientBirthDate,
    }));
    const savedAddress = pick('clientAddress');
    if (savedAddress) setAddress({ ...EMPTY_ADDRESS, ...savedAddress });
  };



  const matchesSearch = (os) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [os.client, os.id, os.device, os.deviceFull, os.clientPhone, os.clientCPF]
      .some((field) => String(field || '').toLowerCase().includes(term));
  };

  const filteredOS = osList.filter(os => {
    if (!matchesSearch(os)) return false;
    // Com busca ativa, procura em TODAS as OS (inclusive encerradas) —
    // é justamente para achar uma OS antiga que o operador busca.
    if (searchTerm.trim()) return true;
    const status = normalizeStatus(os.status);
    if (filter === 'analise') return status === OS_STATUS.ANALISE;
    if (filter === 'pronto') return status === OS_STATUS.PRONTO;
    if (filter === 'marcondes') return status === OS_STATUS.MARCONDES;
    if (filter === 'closed') return status === OS_STATUS.ENCERRADO;
    if (filter === 'all') return status !== OS_STATUS.ENCERRADO;
    return true;
  });

  const filterOptions = [
    { id: 'all',       label: 'Ativas' },
    { id: 'analise',   label: 'Em análise',   color: 'var(--status-warning)' },
    { id: 'pronto',    label: 'Prontas',      color: 'var(--status-success)' },
    { id: 'marcondes', label: 'Marcondes',    color: 'var(--status-info)' },
    { id: 'closed',    label: 'Encerradas' },
  ];


  return (
    <div className="os-container">
      <div className="module-header os-module-header">
        <h2 className="module-title">Ordens de Serviço</h2>
        <div className="os-header-actions">
          <div className="seg-control" role="tablist" aria-label="Modo da tela">
            <button
              role="tab"
              aria-selected={activeTab === 'list'}
              className={`seg-item ${activeTab === 'list' ? 'is-active' : ''}`}
              onClick={() => { setActiveTab('list'); setEditingOS(null); }}
            >
              <FileText size={15} /> Listagem
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'new'}
              className={`seg-item ${activeTab === 'new' ? 'is-active' : ''}`}
              onClick={() => { setActiveTab('new'); setEditingOS(null); }}
            >
              <Plus size={15} /> Nova OS
            </button>
          </div>
        </div>
      </div>

      <div className="module-body">
        {activeTab === 'list' && !editingOS && (
          <div className="os-list-view">
            <div className="os-toolbar">
              <div className="os-search">
                <Search size={16} className="os-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  className="os-search-input"
                  placeholder="Buscar por cliente, nº da OS, equipamento, telefone ou CPF"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="btn-icon os-search-clear" onClick={() => setSearchTerm('')} title="Limpar busca">
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="os-toolbar-right">
                <div className="seg-control" role="group" aria-label="Situação">
                  {filterOptions.map(opt => (
                    <button
                      key={opt.id}
                      className={`seg-item ${filter === opt.id ? 'is-active' : ''}`}
                      onClick={() => setFilter(opt.id)}
                      style={opt.color ? { '--seg-dot': opt.color } : undefined}
                    >
                      {opt.color && <span className="seg-dot" aria-hidden="true" />}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="seg-control" role="group" aria-label="Visualização">
                  <button
                    className={`seg-item seg-icon ${viewMode === 'cards' ? 'is-active' : ''}`}
                    onClick={() => setViewMode('cards')}
                    title="Cards"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={`seg-item seg-icon ${viewMode === 'table' ? 'is-active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Lista"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            <p className="os-result-count">
              {filteredOS.length} {filteredOS.length === 1 ? 'ordem' : 'ordens'}
              {searchTerm && ' encontradas'}
            </p>

            {filteredOS.length === 0 ? (
              <div className="os-empty">
                <FileText size={38} className="text-dim" />
                <p className="os-empty-title">
                  {searchTerm ? 'Nenhuma OS encontrada' : 'Nenhuma OS nesta situação'}
                </p>
                <p className="os-empty-sub">
                  {searchTerm ? `Nada corresponde a "${searchTerm}"` : 'As ordens abertas aparecem aqui'}
                </p>
              </div>
            ) : viewMode === 'cards' ? (
              <div className="os-grid">
                {filteredOS.map(os => {
                  const meta = OS_STATUS_META[normalizeStatus(os.status)];
                  return (
                    <button
                      key={os.id}
                      className="os-card"
                      style={{ '--card-accent': meta.color }}
                      onClick={() => handleEdit(os)}
                      title="Abrir OS"
                    >
                      <span className="os-card-top">
                        <span className="os-card-number">#{os.id}</span>
                        <span className="os-card-status" style={{ '--pill-color': meta.color, '--pill-bg': meta.bg }}>
                          <span className="status-dot" aria-hidden="true" />
                          {meta.label}
                        </span>
                      </span>

                      <span className="os-card-client">{os.client || 'Cliente não informado'}</span>
                      <span className="os-card-device">{os.device || os.deviceFull || '—'}</span>

                      <span className="os-card-defect">{os.defect || 'Defeito não informado'}</span>

                      <span className="os-card-foot">
                        <span className="os-card-date"><Clock size={13} /> {formatDate(os.date)}</span>
                        {os.serviceValue > 0 && (
                          <span className="os-card-value">{formatCurrency(os.serviceValue)}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="os-table-wrap">
                <table className="os-list-table">
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Cliente</th>
                      <th>Equipamento</th>
                      <th>Entrada</th>
                      <th>Situação</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOS.map(os => {
                      const meta = OS_STATUS_META[normalizeStatus(os.status)];
                      return (
                        <tr key={os.id} onClick={() => handleEdit(os)} title="Abrir OS">
                          <td className="os-list-number">#{os.id}</td>
                          <td className="font-medium">{os.client || '—'}</td>
                          <td className="text-muted">{os.device || '—'}</td>
                          <td className="text-muted">{formatDate(os.date)}</td>
                          <td>
                            <span className="os-card-status" style={{ '--pill-color': meta.color, '--pill-bg': meta.bg }}>
                              <span className="status-dot" aria-hidden="true" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="text-right">
                            {os.serviceValue > 0 ? formatCurrency(os.serviceValue) : <span className="text-dim">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {editingOS && (
          <div className="os-edit-view">
            {/* ── Cabeçalho: uma única linha ── */}
            <div className="os-topbar">
              <h2 className="os-topbar-title">O.S Nº {editingOS.id}</h2>

              <StatusPill
                status={normalizeStatus(editingOS.status)}
                onChange={(s) => setEditingOS({ ...editingOS, status: s, readyDate: '' })}
              />

              <div className="os-topbar-actions">
                <button className="btn-outline" onClick={handleCloseOS}>
                  <CheckCircle size={17} /> Encerrar OS
                </button>
                <button className="btn-outline" onClick={() => window.print()}>
                  <Printer size={17} /> Re-imprimir Nota
                </button>
                <button className="btn-outline" onClick={saveEdit}>
                  <Save size={17} /> Gravar OS
                </button>
                <button className="btn-outline" onClick={closeEdit}>
                  <X size={17} /> Fechar
                </button>
              </div>
            </div>

            {/* ── 1. Cliente ── */}
            <section className="os-panel">
              <header className="os-panel-head">
                <h4 className="os-panel-title"><User size={17} /> Cliente</h4>
              </header>

              <div className="os-inner">
                <div className="deco deco-top" aria-hidden="true">
                  <span className="deco-dots" />
                  <span className="deco-tile"><User size={34} strokeWidth={1.5} /></span>
                </div>

                <div className="inner-content">
                  <h3 className="client-name">{editingOS.client || 'Cliente não informado'}</h3>

                  <div className="field">
                    <span className="field-label">CPF</span>
                    <span className="field-value">{editingOS.clientCPF || 'Não informado'}</span>
                  </div>

                  <div className="field">
                    <span className="field-label">Telefone / WhatsApp</span>
                    <span className="field-value field-phone">
                      {editingOS.clientPhone || 'Não informado'}
                      {editingOS.clientPhone && (
                        <a
                          href={`https://wa.me/55${editingOS.clientPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-btn"
                          title="Abrir conversa no WhatsApp"
                          aria-label="Abrir conversa no WhatsApp"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.031 6.172c-2.32 0-4.518.892-6.193 2.512-3.483 3.388-3.483 8.901 0 12.289l-.438 2.603 2.705-.443c1.282.723 2.731 1.102 4.22 1.102.004 0 .008 0 .012 0 2.32 0 4.518-.892 6.193-2.512 3.483-3.388 3.483-8.901 0-12.289-1.675-1.62-3.873-2.512-6.193-2.512zm3.384 12.076c-.196.546-1.148 1.033-1.583 1.102-.434.07-1.015.03-1.686-.19-.462-.15-1.175-.406-1.996-.754-3.456-1.454-5.733-4.919-5.903-5.145-.17-.226-1.391-1.848-1.391-3.527 0-1.68.869-2.507 1.181-2.844.312-.337.689-.421.919-.421.23 0 .46.001.656.01.21.008.491-.08.769.587.279.667.952 2.321 1.034 2.489.082.168.137.363.027.587-.11.223-.164.363-.329.558-.164.196-.345.439-.493.588-.164.166-.335.347-.144.674.191.327.849 1.4 1.821 2.269.972.869 1.792 1.14 2.121 1.304.329.164.52.138.713-.082.193-.219.822-.958 1.041-1.287.219-.329.438-.274.74-.164.301.11 1.917.904 2.245 1.068.328.164.547.245.628.383.082.138.082.793-.114 1.339z"/></svg>
                        </a>
                      )}
                    </span>
                  </div>

                  <div className="field">
                    <span className="field-label">Endereço</span>
                    <span className="field-value">
                      {addressLines(editingOS.clientAddress).length
                        ? addressLines(editingOS.clientAddress).map((l, i) => <span key={i} className="addr-line">{l}</span>)
                        : 'Não informado'}
                    </span>
                  </div>

                  <div className="inner-divider" />

                  <div className="client-foot">
                    <span className="client-since">
                      Cliente desde: <strong>{clientSince(editingOS.clientCPF)}</strong>
                    </span>
                    <button type="button" className="btn-outline btn-outline-sm" onClick={handleEditClient}>
                      <Pencil size={15} /> Editar Cliente
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. Equipamento ── */}
            <section className="os-panel">
              <header className="os-panel-head">
                <h4 className="os-panel-title"><Laptop size={17} /> Equipamento</h4>
              </header>

              <div className="os-inner">
                <div className="deco" aria-hidden="true">
                  <span className="deco-dots" />
                  <span className="deco-tile"><Laptop size={34} strokeWidth={1.5} /></span>
                </div>

                <div className="inner-content">
                  <h3 className="device-name">{editingOS.device || editingOS.deviceFull || '—'}</h3>

                  <div className="device-grid">
                    <div className="field">
                      <span className="field-label">Senha</span>
                      <span className="field-value">{editingOS.devicePassword || 'Não informada'}</span>
                    </div>
                    <div className="field">
                      <span className="field-label">Defeito informado</span>
                      <span className="field-value">{editingOS.defect || 'Não informado'}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-outline btn-outline-sm"
                      onClick={() => setIsDeviceExpanded(!isDeviceExpanded)}
                      aria-expanded={isDeviceExpanded}
                    >
                      {isDeviceExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                      <ChevronRight size={15} className={`caret ${isDeviceExpanded ? 'is-open' : ''}`} />
                    </button>
                  </div>

                  {isDeviceExpanded && (
                    <>
                      <div className="inner-divider" />
                      <div className="device-more">
                        <div className="field">
                          <span className="field-label">Número de Série</span>
                          <span className="field-value">{deviceSerial(editingOS) || '—'}</span>
                        </div>
                        <div className="field">
                          <span className="field-label">Acessórios</span>
                          <span className="field-value">{editingOS.accessories || 'Nenhum'}</span>
                        </div>
                        <div className="field">
                          <span className="field-label">Data de entrada</span>
                          <span className="field-value">{formatDate(editingOS.entryDate)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ── 3. Serviços executados ── */}
            <section className={`os-panel ${!isServicesExpanded ? 'os-panel-collapsed' : ''}`}>
              <header className="os-panel-head">
                <button
                  type="button"
                  className="os-panel-title os-panel-title-toggle"
                  onClick={() => setIsServicesExpanded(v => !v)}
                  aria-expanded={isServicesExpanded}
                  title={isServicesExpanded ? 'Recolher' : 'Expandir'}
                >
                  <ChevronRight size={15} className={`caret ${isServicesExpanded ? 'is-open' : ''}`} />
                  <Wrench size={17} /> Serviços Executados
                  {!isServicesExpanded && serviceItems.length > 0 && (
                    <span className="svc-count-badge">{serviceItems.length}</span>
                  )}
                </button>
                <button className="btn btn-primary btn-sm" onClick={openNewService}>
                  <Plus size={16} /> Adicionar Serviço
                </button>
              </header>

              {isServicesExpanded && (
              <div className="os-panel-body">
                <table className="svc-table">
                  <thead>
                    <tr>
                      <th>Descrição do Serviço</th>
                      <th className="svc-col-value">Valor</th>
                      <th className="svc-col-actions">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className="svc-col-value">{formatCurrency(item.price)}</td>
                        <td className="svc-col-actions">
                          <div className="svc-actions">
                            <button className="icon-outline" onClick={() => openEditService(item)} title="Editar serviço">
                              <Pencil size={15} />
                            </button>
                            <button className="icon-outline icon-outline-danger" onClick={() => removeServiceItem(item.id)} title="Remover serviço">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {serviceItems.length === 0 && (
                      <tr>
                        <td colSpan="3" className="svc-empty">Nenhum serviço lançado</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TOTAL DOS SERVIÇOS</td>
                      <td className="svc-col-value svc-total">{formatCurrency(totalServices)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'new' && (
          <div className="os-form-view card">
            <h3 className="form-title mb-4">Abertura de Nova OS</h3>
            
            <form className="os-form" onSubmit={handleSave}>
              <div className="form-section">
                <h4 className="section-title"><User size={18} /> Dados do Cliente</h4>
                <div className="form-grid">
                  {/* CPF primeiro: é a chave do cliente e dispara a busca do cadastro */}
                  <div className="form-group">
                    <label>CPF/CNPJ (identifica o cliente)</label>
                    <input
                      type="text" className="input" placeholder="000.000.000-00" autoFocus
                      value={formData.clientCPF}
                      onChange={(e) => {
                        setFormData({ ...formData, clientCPF: e.target.value });
                        lookupClientByCPF(e.target.value);
                      }}
                      onBlur={(e) => lookupClientByCPF(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nome Completo</label>
                    <input
                      type="text" className="input" placeholder="Ex: João da Silva"
                      value={formData.clientName}
                      onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Telefone / WhatsApp</label>
                    <input
                      type="text" className="input" placeholder="(00) 00000-0000"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Data de Nascimento</label>
                    <input
                      type="date" className="input"
                      value={formData.clientBirthDate}
                      onChange={(e) => setFormData({...formData, clientBirthDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4 className="section-title"><Search size={18} /> Endereço</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>CEP</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="12200-000"
                      value={address.cep}
                      onChange={(e) => handleCEPChange(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cidade</label>
                    <input type="text" className="input" value={address.city} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Bairro</label>
                    <input type="text" className="input" value={address.neighborhood} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Logradouro (Rua/Av)</label>
                    <input type="text" className="input" value={address.street} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Número</label>
                    <input
                      ref={numberInputRef}
                      type="text"
                      className="input"
                      placeholder="Nº"
                      value={address.number}
                      onChange={(e) => setAddress(prev => ({ ...prev, number: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Histórico do cliente: aparece acima do equipamento quando o CPF já passou pela loja */}
              {clientHistory.length > 0 && (
                <div
                  className="flex items-center gap-2 px-4 py-3 mb-4"
                  style={{
                    background: 'var(--primary-subtle, rgba(255,215,0,0.08))',
                    border: '1px solid rgba(255,215,0,0.3)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Clock size={16} className="text-primary" style={{ flexShrink: 0 }} />
                  <span className="text-sm">
                    Cliente já atendido — última OS: <strong>{clientHistory[0].device || clientHistory[0].deviceFull}</strong> em{' '}
                    <strong>{formatDate(clientHistory[0].date)}</strong>
                    {clientHistory.length > 1 && ` (+${clientHistory.length - 1} OS anterior${clientHistory.length > 2 ? 'es' : ''})`}
                  </span>
                </div>
              )}

              <div className="form-section">
                <h4 className="section-title"><Wrench size={18} /> Dados do Equipamento</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tipo</label>
                    <select 
                      className="input select"
                      onChange={(e) => setFormData({...formData, deviceType: e.target.value})}
                    >
                      <option>Notebook</option>
                      <option>Desktop</option>
                      <option>All-in-One</option>
                      <option>Smartphone</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Marca / Modelo</label>
                    <input 
                      type="text" className="input" placeholder="Ex: Dell Inspiron 15" 
                      onChange={(e) => setFormData({...formData, deviceBrand: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Número de Série</label>
                    <input 
                      type="text" className="input" placeholder="S/N" 
                      onChange={(e) => setFormData({...formData, deviceSN: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Senha do Equipamento</label>
                    <input 
                      type="text" className="input" placeholder="Senha de acesso" 
                      onChange={(e) => setFormData({...formData, devicePassword: e.target.value})}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Defeito Relatado</label>
                    <textarea 
                      className="input textarea" rows="3" placeholder="Descreva o problema detalhadamente..."
                      onChange={(e) => setFormData({...formData, defect: e.target.value})}
                    ></textarea>
                  </div>
                  <div className="form-group full-width">
                    <label>Acessórios Deixados</label>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Ex: Carregador, mouse, capa..." 
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value)}
                      onBlur={() => {
                        if (!accessories.trim()) {
                          setAccessories('Nenhum acessório deixado.');
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-surface" onClick={() => setActiveTab('list')}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle size={20} className="mr-2" /> Salvar e Imprimir OS
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Print Layout */}
      <div className={`print-only template-${settings?.osPrintTemplate || 'thermal-1'}`}>
        <div className="print-header">
          <span className="print-logo">INFO CENTRO</span>
          <p>Assistência Técnica e Vendas</p>
          <p>SJC - São Paulo</p>
          <p>Tel: (12) 99999-9999</p>
        </div>

        <div className="print-section">
          <span className="print-section-title">ORDEM DE SERVIÇO #{editingOS ? editingOS.id : (osList.length > 0 ? osList[osList.length - 1].id : 'NOVA')}</span>
          <div className="print-row">
            <span>Data:</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <div className="print-section">
          <span className="print-section-title">CLIENTE</span>
          <p><strong>{editingOS ? editingOS.client : formData.clientName}</strong></p>
          <p>Tel: {editingOS ? editingOS.clientPhone : formData.clientPhone}</p>
        </div>

        <div className="print-section">
          <span className="print-section-title">EQUIPAMENTO</span>
          <p>{editingOS ? editingOS.deviceFull : `${formData.deviceType} ${formData.deviceBrand}`}</p>
          {!editingOS && <p>S/N: {formData.deviceSN}</p>}
        </div>

        <div className="print-section">
          <span className="print-section-title">RELATO DO DEFEITO</span>
          <p>{!editingOS ? formData.defect : 'N/A'}</p>
        </div>

        <div className="print-footer">
          <p>Acompanhe seu serviço em: infocentro.com.br</p>
          <div className="print-signature">
            Assinatura do Cliente
          </div>
        </div>
      </div>
      {showServiceModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowServiceModal(false)}>
          <div className="modal-content card">
            <h3 className="mb-4">{editingServiceId ? 'Editar Serviço' : 'Adicionar Serviço'}</h3>
            <div className="form-group mb-4">
              <label>Descrição</label>
              <input
                type="text" className="input" autoFocus
                value={newItem.description}
                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && submitService()}
                placeholder="Ex: Troca de tela"
              />
            </div>
            <div className="form-group mb-6">
              <label>Valor (R$)</label>
              <input
                type="number" step="0.01" min="0" className="input"
                value={newItem.price}
                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && submitService()}
                placeholder="0,00"
              />
            </div>
            <div className="flex gap-sm justify-end">
              <button className="btn btn-surface" onClick={() => setShowServiceModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitService}>
                {editingServiceId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OS;
