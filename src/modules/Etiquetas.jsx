import { useState, useRef } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Download, Upload, Printer } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import './Etiquetas.css';

const INSTALLMENT_RATE = 0.15;
const INSTALLMENTS = 12;

/** Calcula valor parcelado em 12x com 15% de acréscimo */
const calculateInstallmentValue = (valorAVista) => {
  const valor = typeof valorAVista === 'string'
    ? parseFloat(valorAVista.replace(',', '.'))
    : valorAVista;
  if (valor <= 0) return 0;
  return (valor * (1 + INSTALLMENT_RATE)) / INSTALLMENTS;
};

/** Formata valor para moeda brasileira */
const formatBRL = (value) => {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/** Template visual da etiqueta — Clássico (340px quadrado) */
const EtiquetaTemplate = ({ etiqueta, storeName = 'INFO CENTRO' }) => {
  const parcelado = calculateInstallmentValue(etiqueta.valorAVista);
  const valorNum = typeof etiqueta.valorAVista === 'string'
    ? parseFloat(etiqueta.valorAVista.replace(',', '.'))
    : etiqueta.valorAVista;

  return (
    <div className="etiqueta-template">
      <div className="etiqueta-logo">{storeName}</div>

      <div className="etiqueta-modelo">{etiqueta.marcaModelo}</div>

      <div className="etiqueta-specs">
        <div className="spec-line">
          <span className="spec-icon">🖥</span>
          <span className="spec-text">{etiqueta.processador}</span>
        </div>
        <div className="spec-line">
          <span className="spec-icon">💾</span>
          <span className="spec-text">{etiqueta.memoriaRam}</span>
        </div>
        <div className="spec-line">
          <span className="spec-icon">💿</span>
          <span className="spec-text">{etiqueta.armazenamento}</span>
        </div>
        <div className="spec-line">
          <span className="spec-icon">🖨</span>
          <span className="spec-text">{etiqueta.sistemaOperacional}</span>
        </div>
        {etiqueta.placaVideo && (
          <div className="spec-line">
            <span className="spec-icon">🎮</span>
            <span className="spec-text">{etiqueta.placaVideo}</span>
          </div>
        )}
      </div>

      <div className="etiqueta-bateria" data-bateria={etiqueta.bateria || 'Boa'}>
        {etiqueta.bateria && <span>BATERIA {etiqueta.bateria.toUpperCase()}</span>}
      </div>

      <div className="etiqueta-footer">
        <div className="etiqueta-preco-vista">
          <span className="label">À VISTA</span>
          <span className="valor">{formatBRL(valorNum)}</span>
        </div>
        <div className="etiqueta-preco-parcelado">
          <span className="label">12X DE</span>
          <span className="valor">{formatBRL(parcelado)}</span>
        </div>
      </div>

      <div className="etiqueta-tela">{etiqueta.tela}</div>
    </div>
  );
};

const Etiquetas = () => {
  const { etiquetas, setEtiquetas, settings } = useGlobalState();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEtiqueta, setEditingEtiqueta] = useState(null);
  const [selectedForPrint, setSelectedForPrint] = useState([]);
  const [printPerPage, setPrintPerPage] = useState(6);
  const fileInputRef = useRef(null);

  const initialFormState = {
    marcaModelo: '',
    processador: '',
    memoriaRam: '',
    armazenamento: '',
    sistemaOperacional: 'Windows 10',
    tela: '14"',
    bateria: 'Boa',
    placaVideo: '',
    valorAVista: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  const filteredEtiquetas = etiquetas.filter(e =>
    e.marcaModelo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (etiqueta = null) => {
    if (etiqueta) {
      setEditingEtiqueta(etiqueta);
      setFormData(etiqueta);
    } else {
      setEditingEtiqueta(null);
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEtiqueta(null);
    setFormData(initialFormState);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.marcaModelo || !formData.valorAVista) {
      alert('Preencha Modelo e Valor À Vista');
      return;
    }

    const newEtiqueta = {
      id: editingEtiqueta ? editingEtiqueta.id : crypto.randomUUID(),
      ...formData,
      createdAt: editingEtiqueta ? editingEtiqueta.createdAt : Date.now(),
    };

    if (editingEtiqueta) {
      setEtiquetas(prev => prev.map(e => e.id === editingEtiqueta.id ? newEtiqueta : e));
    } else {
      setEtiquetas(prev => [...prev, newEtiqueta]);
    }

    handleCloseModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta etiqueta?')) {
      setEtiquetas(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleExportJSON = () => {
    if (etiquetas.length === 0) {
      alert('Nenhuma etiqueta para exportar');
      return;
    }
    const json = JSON.stringify(etiquetas, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `etiquetas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result);
        if (!Array.isArray(data)) throw new Error('Arquivo não é um array');

        const imported = data.map(item => ({
          id: crypto.randomUUID(),
          marcaModelo: item.marcaModelo || '',
          processador: item.processador || '',
          memoriaRam: item.memoriaRam || '',
          armazenamento: item.armazenamento || '',
          sistemaOperacional: item.sistemaOperacional || 'Windows 10',
          tela: item.tela || '14"',
          bateria: item.bateria || '',
          placaVideo: item.placaVideo || '',
          valorAVista: item.valorAVista || '',
          createdAt: Date.now(),
        }));

        setEtiquetas(prev => [...prev, ...imported]);
        alert(`${imported.length} etiqueta(s) importada(s) com sucesso!`);
      } catch (err) {
        alert('Erro ao ler arquivo: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePrint = () => {
    if (selectedForPrint.length === 0) {
      alert('Selecione etiquetas para imprimir');
      return;
    }
    const etiquetasToPrint = etiquetas.filter(e => selectedForPrint.includes(e.id));
    window.open(`#print:${JSON.stringify(etiquetasToPrint)}:${printPerPage}`, '_blank');
  };

  return (
    <div className="os-container">
      {/* ── Cabeçalho ── */}
      <div className="module-header">
        <h2 className="module-title">
          <Tag size={20} className="text-primary" />
          Etiquetas de Notebooks
        </h2>

        <div className="toolbar-right">
          <div className="stat-chip">
            <div>
              <span className="stat-chip-label">Etiquetas</span>
              <span className="stat-chip-value">{etiquetas.length}</span>
            </div>
          </div>
          <button className="btn-outline btn-outline-sm" onClick={handleExportJSON} title="Exportar para JSON">
            <Download size={16} /> Exportar
          </button>
          <button className="btn-outline btn-outline-sm" onClick={() => fileInputRef.current?.click()} title="Importar do JSON">
            <Upload size={16} /> Importar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal()}>
            <Plus size={16} /> Nova Etiqueta
          </button>
        </div>
      </div>

      <div className="module-body">
        <div className="toolbar">
          <div className="search-pill">
            <input
              type="text"
              className="search-pill-input"
              placeholder="Buscar por modelo"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="btn-icon search-pill-clear" onClick={() => setSearchTerm('')} title="Limpar busca">
                <X size={15} />
              </button>
            )}
          </div>

          {selectedForPrint.length > 0 && (
            <div className="toolbar-right">
              <select
                value={printPerPage}
                onChange={e => setPrintPerPage(Number(e.target.value))}
                className="input"
                style={{ width: '100px' }}
              >
                <option value={6}>6 por página</option>
                <option value={9}>9 por página</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                <Printer size={16} /> Imprimir {selectedForPrint.length}
              </button>
            </div>
          )}
        </div>

        <p className="result-count">
          {filteredEtiquetas.length} {filteredEtiquetas.length === 1 ? 'etiqueta' : 'etiquetas'}
          {searchTerm && ' encontradas'}
        </p>

        {filteredEtiquetas.length === 0 ? (
          <div className="empty-state">
            <Tag size={38} className="text-dim" />
            <p className="empty-state-title">
              {searchTerm ? 'Nenhuma etiqueta encontrada' : 'Nenhuma etiqueta cadastrada'}
            </p>
            <p className="empty-state-sub">
              {searchTerm ? `Nada corresponde a "${searchTerm}"` : 'Cadastre a primeira etiqueta para começar'}
            </p>
          </div>
        ) : (
          <div className="etiquetas-grid">
            {filteredEtiquetas.map(etiqueta => (
              <div key={etiqueta.id} className="etiqueta-card">
                <div className="etiqueta-preview">
                  <EtiquetaTemplate etiqueta={etiqueta} storeName={(settings?.storeName || 'INFO CENTRO').toUpperCase()} />
                </div>

                <div className="etiqueta-actions">
                  <label className="etiqueta-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedForPrint.includes(etiqueta.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedForPrint(prev => [...prev, etiqueta.id]);
                        } else {
                          setSelectedForPrint(prev => prev.filter(id => id !== etiqueta.id));
                        }
                      }}
                    />
                    <span>Imprimir</span>
                  </label>

                  <button
                    className="icon-outline"
                    onClick={() => handleOpenModal(etiqueta)}
                    title="Editar etiqueta"
                  >
                    <Edit2 size={15} />
                  </button>

                  <button
                    className="icon-outline icon-outline-danger"
                    onClick={() => handleDelete(etiqueta.id)}
                    title="Excluir etiqueta"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="modal-content card">
            <div className="flex justify-between items-center border-bottom pb-4 mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Tag size={20} className="text-primary" />
                {editingEtiqueta ? 'Editar Etiqueta' : 'Nova Etiqueta'}
              </h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                <X size={20} className="text-muted" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group mb-4">
                <label>Marca/Modelo *</label>
                <input
                  type="text" className="input" autoFocus required
                  value={formData.marcaModelo}
                  onChange={e => setFormData({ ...formData, marcaModelo: e.target.value })}
                  placeholder="Ex: Dell Vostro 14 3468"
                />
              </div>

              <div className="form-group mb-4">
                <label>Processador</label>
                <input
                  type="text" className="input"
                  value={formData.processador}
                  onChange={e => setFormData({ ...formData, processador: e.target.value })}
                  placeholder="Ex: Intel Core i5"
                />
              </div>

              <div className="flex gap-4 mb-4">
                <div className="form-group flex-1">
                  <label>Memória RAM</label>
                  <input
                    type="text" className="input"
                    value={formData.memoriaRam}
                    onChange={e => setFormData({ ...formData, memoriaRam: e.target.value })}
                    placeholder="Ex: 8GB RAM"
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Armazenamento</label>
                  <input
                    type="text" className="input"
                    value={formData.armazenamento}
                    onChange={e => setFormData({ ...formData, armazenamento: e.target.value })}
                    placeholder="Ex: 500GB HD"
                  />
                </div>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="form-group flex-1">
                  <label>Sistema Operacional</label>
                  <select
                    className="input"
                    value={formData.sistemaOperacional}
                    onChange={e => setFormData({ ...formData, sistemaOperacional: e.target.value })}
                  >
                    <option>Windows 10</option>
                    <option>Windows 11</option>
                    <option>Linux</option>
                    <option>Sem Sistema Operacional</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Tela</label>
                  <select
                    className="input"
                    value={formData.tela}
                    onChange={e => setFormData({ ...formData, tela: e.target.value })}
                  >
                    <option>11.6"</option>
                    <option>13.3"</option>
                    <option>14"</option>
                    <option>15.6"</option>
                    <option>17.3"</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mb-4">
                <div className="form-group flex-1">
                  <label>Bateria</label>
                  <select
                    className="input"
                    value={formData.bateria}
                    onChange={e => setFormData({ ...formData, bateria: e.target.value })}
                  >
                    <option>Boa</option>
                    <option>Ruim</option>
                    <option></option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Placa de Vídeo (opcional)</label>
                  <input
                    type="text" className="input"
                    value={formData.placaVideo}
                    onChange={e => setFormData({ ...formData, placaVideo: e.target.value })}
                    placeholder="Ex: GT630M - 2G"
                  />
                </div>
              </div>

              <div className="form-group mb-6">
                <label>Valor à Vista (R$) *</label>
                <input
                  type="text" className="input" required
                  value={formData.valorAVista}
                  onChange={e => setFormData({ ...formData, valorAVista: e.target.value })}
                  placeholder="Ex: 1899,00"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-outline" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEtiqueta ? 'Atualizar' : 'Salvar'} Etiqueta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Etiquetas;
