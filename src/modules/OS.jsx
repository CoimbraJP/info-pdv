import React, { useState, useRef } from 'react';
import { Plus, Search, Filter, Wrench, User, FileText, CheckCircle, Clock, Printer, LayoutGrid, List, Trash2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useGlobalState } from '../context/GlobalState';
import './OS.css';

const OS = () => {
  const { osList, setOsList, settings } = useGlobalState();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [cardSize, setCardSize] = useState('medium'); // 'small' | 'medium' | 'large'
  const [editTab, setEditTab] = useState('details'); // 'details' | 'services'
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editingOS, setEditingOS] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceItems, setServiceItems] = useState([]);
  const [newItem, setNewItem] = useState({ description: '', price: '' });
  const [address, setAddress] = useState({ street: '', neighborhood: '', city: '', state: '' });
  const [accessories, setAccessories] = useState('');
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientCPF: '',
    deviceType: 'Notebook',
    deviceBrand: '',
    deviceSN: '',
    devicePassword: '',
    defect: ''
  });
  const numberInputRef = useRef(null);

  const handleSave = (e) => {
    e.preventDefault();
    
    const newOs = {
      id: Date.now().toString().slice(-4), // Simple 4-digit ID
      client: formData.clientName,
      device: `${formData.deviceType} ${formData.deviceBrand}`,
      status: 'Em análise',
      date: new Date().toLocaleDateString('pt-BR'),
      clientPhone: formData.clientPhone,
      clientCPF: formData.clientCPF,
      deviceFull: `${formData.deviceType} ${formData.deviceBrand} - S/N: ${formData.deviceSN}`,
      devicePassword: formData.devicePassword,
      defect: formData.defect,
      accessories: accessories,
      serviceValue: 0,
      readyDate: ''
    };
    
    setOsList([...osList, newOs]);
    setTimeout(() => {
      window.print();
      setActiveTab('list');
      setFormData({
        clientName: '', clientPhone: '', clientCPF: '', 
        deviceType: 'Notebook', deviceBrand: '', deviceSN: '', 
        devicePassword: '', defect: ''
      });
    }, 100);
  };
  
  const [isDeviceExpanded, setIsDeviceExpanded] = useState(false);

  const handleEdit = (os) => {
    setIsDeviceExpanded(false);
    setEditingOS({
      ...os,
      clientPhone: os.clientPhone || '12999999999',
      clientCPF: os.clientCPF || '000.000.000-00',
      entryDate: os.date || '2026-05-02',
      readyDate: os.readyDate || '',
      serviceValue: os.serviceValue || 0,
      deviceFull: os.deviceFull || 'Notebook Dell Inspiron 15 3000 - S/N: ABC123XYZ',
      devicePassword: os.devicePassword || 'Não informada',
      defect: os.defect || 'Não informado',
      accessories: os.accessories || 'Nenhum',
      status: os.status || 'Em análise'
    });
    setServiceItems([
      { id: 1, description: 'Limpeza Interna', price: 80.00 },
      { id: 2, description: 'Pasta Térmica MX-4', price: 45.00 }
    ]);
  };

  const closeEdit = () => {
    setEditingOS(null);
  };

  const handleCloseOS = () => {
    if (!editingOS) return;
    const updatedOS = { ...editingOS, status: 'Encerrado' };
    const updatedList = osList.map(os => os.id === updatedOS.id ? updatedOS : os);
    setOsList(updatedList);
    setEditingOS(null);
  };

  const saveEdit = () => {
    if (!editingOS) return;
    const updatedOS = { ...editingOS, serviceValue: totalServices };
    const updatedList = osList.map(os => os.id === updatedOS.id ? updatedOS : os);
    setOsList(updatedList);
    setEditingOS(null);
  };

  const addServiceItem = () => {
    if (!newItem.description || !newItem.price) return;
    const item = {
      id: Date.now(),
      description: newItem.description,
      price: parseFloat(newItem.price)
    };
    const newItems = [...serviceItems, item];
    setServiceItems(newItems);
    setNewItem({ description: '', price: '' });
    
    // Sync top value
    const newTotal = newItems.reduce((acc, curr) => acc + curr.price, 0);
    setEditingOS(prev => ({ ...prev, serviceValue: newTotal }));
  };

  const removeServiceItem = (id) => {
    const newItems = serviceItems.filter(item => item.id !== id);
    setServiceItems(newItems);
    // Sync top value
    const newTotal = newItems.reduce((acc, curr) => acc + curr.price, 0);
    setEditingOS(prev => ({ ...prev, serviceValue: newTotal }));
  };

  const totalServices = serviceItems.reduce((acc, item) => acc + item.price, 0);

  const handleTopServiceValueChange = (val) => {
    const numericVal = parseFloat(val) || 0;
    setEditingOS(prev => ({ ...prev, serviceValue: numericVal }));
    
    // Auto-create service to balance
    if (serviceItems.length === 0) {
      setServiceItems([{ id: Date.now(), description: 'SERVIÇO AVULSO', price: numericVal }]);
    }
  };

  const handleCEPChange = async (value) => {
    const cleanCEP = value.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress({
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          });
          // Auto focus on number field
          setTimeout(() => numberInputRef.current?.focus(), 100);
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  const handleCPFBlur = (cpf) => {
    if (!cpf) return;
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length === 11 || cleanCpf.length === 14) {
      // Find client in osList (most recent first)
      const existingClient = [...osList].reverse().find(os => os.clientCPF && os.clientCPF.replace(/\D/g, '') === cleanCpf);
      if (existingClient) {
        setFormData(prev => ({
          ...prev,
          clientName: existingClient.client || prev.clientName,
          clientPhone: existingClient.clientPhone || prev.clientPhone
        }));
      }
    }
  };


  const getStatusColor = (status) => {
    switch(status) {
      case 'Em análise': return 'status-warning';
      case 'Aguardando Aprovação / Peças': return 'status-info';
      case 'Pronto Avisar Cliente.': return 'status-success';
      case 'Marcondes': return 'text-primary font-bold';
      case 'Encerrado': return 'opacity-50 grayscale';
      default: return 'text-muted';
    }
  };


  const filteredOS = osList.filter(os => {
    if (filter === 'maintenance') return os.status === 'Em análise' || os.status === 'Aguardando Aprovação / Peças';
    if (filter === 'ready') return os.status === 'Pronto Avisar Cliente.';
    if (filter === 'marcondes') return os.status === 'Marcondes';
    if (filter === 'closed') return os.status === 'Encerrado';
    if (filter === 'all') return os.status !== 'Encerrado';
    return true;
  });

  const filterOptions = [
    { id: 'maintenance', label: '1 - EM MANUTENÇÃO' },
    { id: 'ready', label: '2 - PRONTOS' },
    { id: 'marcondes', label: '3 - MARCONDES' },
    { id: 'all', label: '4 - TODOS' },
    { id: 'closed', label: '5 - FECHADOS' },
  ];

  return (
    <div className="os-container">
      <div className="module-header">
        <div className="flex justify-start items-center gap-6">
          <h2 className="module-title">Ordens de Serviço</h2>
          <div className="flex gap-sm">
            <button 
              className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-surface'}`}
              onClick={() => setActiveTab('list')}
            >
              <FileText size={20} className="mr-2" /> Listagem
            </button>
            <button 
              className={`btn ${activeTab === 'new' ? 'btn-primary' : 'btn-surface'}`}
              onClick={() => setActiveTab('new')}
            >
              <Plus size={20} className="mr-2" /> Nova OS
            </button>
          </div>
        </div>
      </div>

      <div className="module-body">
        {activeTab === 'list' && !editingOS && (
          <div className="os-list-view">
            <div className="filter-container mb-4">
              <div className="flex justify-between items-center w-full">
                <div className="search-bar">
                  <Search size={20} className="text-muted" />
                  <input type="text" className="input" placeholder="Buscar OS por cliente, número ou equipamento..." />
                </div>

                <div className="flex gap-4 items-center">
                  {viewMode === 'cards' && (
                    <div className="view-mode-toggle flex gap-xs bg-surface p-1 rounded-md border border-color">
                      <button 
                        className={`btn-icon ${cardSize === 'small' ? 'active' : ''}`}
                        onClick={() => setCardSize('small')}
                        title="Cards Pequenos"
                      >
                        <span className="font-bold text-xs" style={{fontFamily:'monospace'}}>S</span>
                      </button>
                      <button 
                        className={`btn-icon ${cardSize === 'medium' ? 'active' : ''}`}
                        onClick={() => setCardSize('medium')}
                        title="Cards Médios"
                      >
                        <span className="font-bold text-xs" style={{fontFamily:'monospace'}}>M</span>
                      </button>
                      <button 
                        className={`btn-icon ${cardSize === 'large' ? 'active' : ''}`}
                        onClick={() => setCardSize('large')}
                        title="Cards Grandes"
                      >
                        <span className="font-bold text-xs" style={{fontFamily:'monospace'}}>L</span>
                      </button>
                    </div>
                  )}

                  <div className="view-mode-toggle flex gap-xs bg-surface p-1 rounded-md border border-color">
                  <button 
                    className={`btn-icon ${viewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setViewMode('cards')}
                    title="Visualização em Cards"
                  >
                    <LayoutGrid size={20} />
                  </button>
                  <button 
                    className={`btn-icon ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Visualização em Lista (Excel)"
                  >
                    <List size={20} />
                  </button>
                </div>
                </div>
              </div>
              
              <div className="filter-chips mt-4">
                {filterOptions.map(opt => (
                  <button 
                    key={opt.id}
                    className={`filter-chip ${filter === opt.id ? 'active' : ''}`}
                    onClick={() => setFilter(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'cards' ? (
              <div className={`os-grid size-${cardSize}`}>
                {filteredOS.map(os => {
                  return (
                    <div key={os.id} className="os-card-wrapper">
                      <div className="os-card card">
                        <div className="os-card-front">
                          <div className="os-card-header">
                            <span className="os-number">OS #{os.id}</span>
                            <span className={`status-badge ${getStatusColor(os.status)}`}>{os.status}</span>
                          </div>
                          <div className="os-card-body">
                            <div className="os-info-row">
                              <User size={16} className="text-muted" />
                              <span>{os.client}</span>
                            </div>
                            <div className="os-info-row">
                              <Wrench size={16} className="text-muted" />
                              <span>{os.device}</span>
                            </div>
                            <div className="os-info-row">
                              <Clock size={16} className="text-muted" />
                              <span>{os.date}</span>
                            </div>
                            <div className="os-info-row mt-1 pt-1" style={{ borderTop: '1px solid var(--border-color)' }}>
                              <AlertCircle size={16} className="text-danger" />
                              <span className="text-sm line-clamp-2" title={os.defect}>{os.defect || 'Não informado'}</span>
                            </div>
                          </div>
                          <div className="os-card-footer">
                            <button className="btn btn-primary w-full" onClick={() => handleEdit(os)}>Editar / Serviços</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="os-table-container card">
                <table className="os-table">
                  <thead>
                    <tr>
                      <th>Nº OS</th>
                      <th>CLIENTE</th>
                      <th>EQUIPAMENTO</th>
                      <th>DATA</th>
                      <th>STATUS</th>
                      <th className="text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOS.map(os => (
                      <tr key={os.id}>
                        <td className="font-bold">#{os.id}</td>
                        <td>{os.client}</td>
                        <td>{os.device}</td>
                        <td>{os.date}</td>
                        <td>
                          <span className={`status-badge ${getStatusColor(os.status)}`}>{os.status}</span>
                        </td>
                        <td className="text-right">
                          <button className="btn btn-primary btn-sm" onClick={() => handleEdit(os)}>Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {editingOS && (
          <div className="os-edit-view card">
            <div className="edit-header border-bottom mb-6 pb-4">
              <div className="flex justify-between items-center w-full flex-wrap gap-4">
                <h2 className="text-xl font-bold text-muted">O.S Nº {editingOS.id}</h2>
                <div className="flex gap-sm ml-auto">
                  <button className="btn btn-success" onClick={handleCloseOS}>
                    <CheckCircle size={18} className="mr-2" /> Encerrar OS
                  </button>
                  <button className="btn btn-surface">
                    <Printer size={18} className="mr-2" /> Re-imprimir Nota
                  </button>
                  <button className="btn btn-primary" onClick={saveEdit}>
                    GRAVAR OS
                  </button>
                  <button className="btn btn-danger" onClick={closeEdit}>
                    FECHAR
                  </button>
                </div>
              </div>
            </div>

            <div className="edit-body">
              {/* Client Info Section */}
              <div className="edit-section mb-6">
                <h4 className="section-title"><User size={18} /> Dados do Cliente</h4>
                <div className="card bg-surface-hover p-5" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                  <div className="flex justify-between items-start mb-4 pb-4 border-bottom">
                     <div className="flex items-center gap-4">
                        <div className="avatar" style={{ width: '56px', height: '56px', fontSize: '1.6rem' }}>
                          {editingOS.client ? editingOS.client.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="font-bold text-xl">{editingOS.client}</h3>
                          <span className="text-muted text-sm font-medium tracking-wide" style={{ fontFamily: 'monospace' }}>CPF/CNPJ: {editingOS.clientCPF || 'Não informado'}</span>
                          <span className="text-muted text-sm font-medium tracking-wide" style={{ fontFamily: 'monospace' }}>TELEFONE: {editingOS.clientPhone || 'Não informado'}</span>
                        </div>
                     </div>
                     <a 
                        href={`https://wa.me/55${(editingOS.clientPhone || '').replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-success"
                        title="Abrir no WhatsApp"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-2.32 0-4.518.892-6.193 2.512-3.483 3.388-3.483 8.901 0 12.289l-.438 2.603 2.705-.443c1.282.723 2.731 1.102 4.22 1.102.004 0 .008 0 .012 0 2.32 0 4.518-.892 6.193-2.512 3.483-3.388 3.483-8.901 0-12.289-1.675-1.62-3.873-2.512-6.193-2.512zm3.384 12.076c-.196.546-1.148 1.033-1.583 1.102-.434.07-1.015.03-1.686-.19-.462-.15-1.175-.406-1.996-.754-3.456-1.454-5.733-4.919-5.903-5.145-.17-.226-1.391-1.848-1.391-3.527 0-1.68.869-2.507 1.181-2.844.312-.337.689-.421.919-.421.23 0 .46.001.656.01.21.008.491-.08.769.587.279.667.952 2.321 1.034 2.489.082.168.137.363.027.587-.11.223-.164.363-.329.558-.164.196-.345.439-.493.588-.164.166-.335.347-.144.674.191.327.849 1.4 1.821 2.269.972.869 1.792 1.14 2.121 1.304.329.164.52.138.713-.082.193-.219.822-.958 1.041-1.287.219-.329.438-.274.74-.164.301.11 1.917.904 2.245 1.068.328.164.547.245.628.383.082.138.082.793-.114 1.339z"/></svg>
                        WhatsApp
                      </a>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-2">
                    <div>
                       <span className="text-muted text-xs uppercase tracking-wide block mb-1">Data Entrada</span>
                       <span className="font-medium text-main">{editingOS.entryDate ? new Date(editingOS.entryDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                    <div>
                       <span className="text-muted text-xs uppercase tracking-wide block mb-1">Data de Saída (Pronto)</span>
                       <span className="font-medium text-main">{editingOS.readyDate ? new Date(editingOS.readyDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Pendente'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.5rem' }} className="mb-6">
                <div className="form-group">
                  <label>SITUAÇÃO DA OS</label>
                  <select 
                    className="input select" 
                    value={editingOS.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      let newReadyDate = editingOS.readyDate;
                      
                      if (newStatus === 'Pronto Avisar Cliente.') {
                        newReadyDate = new Date().toISOString().split('T')[0];
                      } else {
                        newReadyDate = '';
                      }
                      
                      setEditingOS({...editingOS, status: newStatus, readyDate: newReadyDate});
                    }}
                  >
                    <option value="Em análise">Em análise</option>
                    <option value="Aguardando Aprovação / Peças">Aguardando Aprovação / Peças</option>
                    <option value="Pronto Avisar Cliente.">Pronto Avisar Cliente.</option>
                    <option value="Marcondes">Marcondes</option>
                    <option value="Encerrado">Encerrado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Valor Total do Serviço</label>
                  <div className="flex items-center gap-xs">
                    <span className="text-muted">R$</span>
                    <input 
                      type="text" 
                      className="input font-bold bg-surface" 
                      value={totalServices.toFixed(2)}
                      disabled
                      style={{ cursor: 'not-allowed', opacity: 0.8 }}
                    />
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div className="edit-section mb-6">
                <h4 className="section-title"><Wrench size={18} /> Dados do Equipamento</h4>
                <div 
                  className="info-box card bg-surface-hover cursor-pointer"
                  onClick={() => setIsDeviceExpanded(!isDeviceExpanded)}
                  style={{ display: 'block', width: '100%' }}
                >
                  <div className="flex justify-between items-center w-full">
                    <p className="font-bold text-lg">{editingOS.deviceFull}</p>
                    <span className="text-xs text-primary">{isDeviceExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
                  </div>
                  
                  {isDeviceExpanded && (
                    <div className="mt-4 pt-4 border-top grid grid-cols-2 gap-md text-sm w-full">
                      <div className="w-full">
                        <span className="text-muted block mb-1">Senha:</span>
                        <span className="font-medium text-lg">{editingOS.devicePassword}</span>
                      </div>
                      <div className="w-full">
                        <span className="text-muted block mb-1">Acessórios:</span>
                        <span className="font-medium text-lg">{editingOS.accessories}</span>
                      </div>
                      <div className="col-span-2 mt-2 w-full">
                        <span className="text-muted block mb-1">Defeito Relatado:</span>
                        <p className="bg-background p-3 rounded border border-color mt-1 text-md">{editingOS.defect}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Services List */}
              <div className="edit-section">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="section-title mb-0"><List size={18} /> LISTA DE SERVIÇOS EXECUTADOS</h4>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowServiceModal(true)}>
                    <Plus size={16} className="mr-1" /> Adicionar Serviço
                  </button>
                </div>
                <div className="services-table-container">
                  <table className="os-table">
                    <thead>
                      <tr>
                        <th>DESCRIÇÃO DO SERVIÇO</th>
                        <th className="text-right">VALOR</th>
                        <th className="text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceItems.map(item => (
                        <tr key={item.id}>
                          <td>{item.description}</td>
                          <td className="text-right font-bold">{formatCurrency(item.price)}</td>
                          <td className="text-right">
                            <button className="btn-icon text-danger" onClick={() => removeServiceItem(item.id)}>
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {serviceItems.length === 0 && (
                        <tr>
                          <td colSpan="3" className="text-center text-muted py-4">Nenhum serviço registrado.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="font-bold">TOTAL DOS SERVIÇOS</td>
                        <td className="text-right font-bold text-primary text-lg">{formatCurrency(totalServices)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'new' && (
          <div className="os-form-view card">
            <h3 className="form-title mb-4">Abertura de Nova OS</h3>
            
            <form className="os-form" onSubmit={handleSave}>
              <div className="form-section">
                <h4 className="section-title"><User size={18} /> Dados do Cliente</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nome Completo</label>
                    <input 
                      type="text" className="input" placeholder="Ex: João da Silva" 
                      onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Telefone / WhatsApp</label>
                    <input 
                      type="text" className="input" placeholder="(00) 00000-0000" 
                      onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>CPF/CNPJ</label>
                    <input 
                      type="text" className="input" placeholder="000.000.000-00" 
                      value={formData.clientCPF}
                      onChange={(e) => setFormData({...formData, clientCPF: e.target.value})}
                      onBlur={(e) => handleCPFBlur(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Data de Nascimento</label>
                    <input type="date" className="input" />
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
                    />
                  </div>
                </div>
              </div>

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
      {/* Service Modal */}
      {showServiceModal && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3 className="mb-4">Adicionar Novo Serviço/Peça</h3>
            <div className="form-group mb-4">
              <label>Descrição</label>
              <input 
                type="text" className="input" autoFocus
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
                placeholder="Ex: Troca de Tela"
              />
            </div>
            <div className="form-group mb-6">
              <label>Valor (R$)</label>
              <input 
                type="number" className="input"
                value={newItem.price}
                onChange={e => setNewItem({...newItem, price: e.target.value})}
                placeholder="0,00"
              />
            </div>
            <div className="flex gap-sm justify-end">
              <button className="btn btn-surface" onClick={() => setShowServiceModal(false)}>Cancelar</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  addServiceItem();
                  setShowServiceModal(false);
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OS;
