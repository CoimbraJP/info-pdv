import { useState, useRef } from 'react';
import { Package, Search, Plus, Edit2, Trash2, X, Check, AlertTriangle, Download, Upload } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { formatCurrency } from '../utils/formatters';
import { parseMoney, toInputMoney } from '../utils/money';

/**
 * Produto = tipo (ex.: "Notebook"); Marca/Modelo = "Dell Vostro 3300".
 * `name` continua sendo o nome COMPLETO ("Notebook Dell Vostro 3300") — é o
 * que o PDV, o cupom e as vendas usam —, e as duas partes ficam guardadas
 * separadas para editar e exportar. Produtos antigos: tudo em `product`.
 */
const joinName = (product, brandModel) => [product, brandModel].map(s => (s || '').trim()).filter(Boolean).join(' ');
const partsOf = (p) => ({
  product: p.product ?? p.name ?? '',
  brandModel: p.brandModel ?? '',
});

/** Acha a coluna da planilha pelo nome do cabeçalho (sem acento/caixa). */
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const findCol = (header, ...keys) => header.findIndex(h => keys.some(k => norm(h).startsWith(k)));
import './OS.css';

const Estoque = () => {
  const { products, setProducts, isAdmin } = useGlobalState();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const initialFormState = { product: '', brandModel: '', barcode: '', price: '', cost: '', stock: '' };
  const [formData, setFormData] = useState(initialFormState);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const criticalCount = products.filter(p => p.stock <= 2).length;

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...partsOf(product), barcode: product.barcode || '', price: product.price, cost: product.cost ?? '', stock: product.stock });
    } else {
      setEditingProduct(null);
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(initialFormState);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.product.trim() || !formData.price) return;

    const newProduct = {
      id: editingProduct ? editingProduct.id : Date.now(),
      name: joinName(formData.product, formData.brandModel),
      product: formData.product.trim(),
      brandModel: formData.brandModel.trim(),
      barcode: formData.barcode.trim(),
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost) || 0,
      stock: parseInt(formData.stock) || 0,
    };

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts(prev => [...prev, newProduct]);
    }

    handleCloseModal();
  };

  const handleDelete = (id) => {
    // Use native confirm — simple and effective for a local POS system
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const stockBadge = (stock) => {
    if (stock === 0) return <span className="badge badge-danger">Esgotado</span>;
    if (stock <= 2) return <span className="badge badge-warning">{stock} un</span>;
    return <span className="badge badge-success">{stock} un</span>;
  };

  const marginBadge = (price, cost) => {
    if (!price || price === 0) return '—';
    const margin = ((price - cost) / price) * 100;
    const color = margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-danger';
    return <span className={`font-bold ${color}`}>{margin.toFixed(1)}%</span>;
  };

  const fileInputRef = useRef(null);

  // Exportar produtos para XLS via CSV (Excel lê nativamente)
  const handleExportXLS = () => {
    if (products.length === 0) {
      alert('Nenhum produto para exportar');
      return;
    }

    // Cabeçalho (o Excel em português abre com acentos graças ao BOM)
    const headers = ['Código de Barras', 'Produto', 'Marca/Modelo', 'Custo (R$)', 'Preço (R$)', 'Estoque'];
    const clean = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();

    const rows = products.map(p => {
      const { product, brandModel } = partsOf(p);
      return [
        clean(p.barcode),
        clean(product),
        clean(brandModel),
        p.cost ? toInputMoney(p.cost) : '',
        toInputMoney(p.price),
        p.stock || 0,
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join('\t'),
      ...rows.map(row => row.join('\t')),
    ].join('\r\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `estoque-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
  };

  // Importar produtos de XLS
  const handleImportXLS = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') return;

        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          alert('Arquivo vazio ou inválido');
          return;
        }

        // Colunas pelo cabeçalho: aceita o modelo novo (com Marca/Modelo) e o antigo
        const header = lines[0].replace(/^\uFEFF/, '').split('\t');
        let col = {
          barcode: findCol(header, 'codigo'),
          product: findCol(header, 'produto'),
          brandModel: findCol(header, 'marca', 'modelo'),
          cost: findCol(header, 'custo'),
          price: findCol(header, 'preco', 'valor'),
          stock: findCol(header, 'estoque', 'qtd', 'quantidade'),
        };
        if (col.product < 0 || col.price < 0) {
          col = { barcode: 0, product: 1, brandModel: -1, cost: 2, price: 3, stock: 4 }; // sem cabeçalho reconhecido
        }

        const rows = lines.slice(1);
        const imported = [];
        const errors = [];

        rows.forEach((line, idx) => {
          const cells = line.split('\t').map(v => v.replace(/\r$/, '').trim());
          const get = (k) => (col[k] >= 0 ? cells[col[k]] ?? '' : '');
          const product = get('product');
          const brandModel = get('brandModel');
          const price = parseMoney(get('price'));

          if (!product && !brandModel) {
            errors.push(`Linha ${idx + 2}: produto é obrigatório`);
            return;
          }
          if (!Number.isFinite(price) || price <= 0) {
            errors.push(`Linha ${idx + 2}: preço inválido`);
            return;
          }

          const cost = parseMoney(get('cost'));
          imported.push({
            id: Date.now() + idx, // novo ID para imports
            barcode: get('barcode'),
            name: joinName(product, brandModel),
            product,
            brandModel,
            cost: Number.isFinite(cost) ? cost : 0,
            price,
            stock: parseInt(get('stock'), 10) || 0,
          });
        });

        if (errors.length > 0) {
          alert(`Erros ao importar:\n${errors.join('\n')}`);
          return;
        }

        // Merge: atualiza produtos com barcode/nome igual, adiciona novos
        setProducts((prev) => {
          const updated = [...prev];
          imported.forEach((imp) => {
            const idx = updated.findIndex(p =>
              (imp.barcode && p.barcode === imp.barcode) ||
              p.name.toLowerCase() === imp.name.toLowerCase()
            );
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], ...imp, id: updated[idx].id }; // mantém ID original
            } else {
              updated.push(imp);
            }
          });
          return updated;
        });

        alert(`${imported.length} produto(s) importado(s) com sucesso!`);
      } catch (err) {
        alert('Erro ao ler arquivo: ' + err.message);
      }
    };
    reader.readAsText(file);

    // Limpa o input para permitir re-upload
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="os-container">
      {/* ── Cabeçalho: uma linha ── */}
      <div className="module-header">
        <h2 className="module-title">
          <Package size={20} className="text-primary" />
          Estoque
        </h2>

        <div className="toolbar-right">
          <div className="stat-chip">
            <div>
              <span className="stat-chip-label">Produtos</span>
              <span className="stat-chip-value">{products.length}</span>
            </div>
          </div>
          {isAdmin && (
          <div className="stat-chip">
            <div>
              <span className="stat-chip-label">Valor em estoque</span>
              <span className="stat-chip-value text-primary">
                {formatCurrency(products.reduce((acc, p) => acc + (p.price * p.stock), 0))}
              </span>
            </div>
          </div>
          )}
          <div className="stat-chip" style={criticalCount > 0 ? { borderColor: 'rgba(245,158,11,0.35)' } : undefined}>
            <div>
              <span className="stat-chip-label">Críticos</span>
              <span className={`stat-chip-value ${criticalCount > 0 ? 'text-warning' : 'text-success'}`}>
                {criticalCount}
              </span>
            </div>
          </div>
          {isAdmin && (<>
          <button className="btn-outline btn-outline-sm" onClick={handleExportXLS} title="Exportar estoque em formato XLS">
            <Download size={16} /> Exportar XLS
          </button>
          <button className="btn-outline btn-outline-sm" onClick={() => fileInputRef.current?.click()} title="Importar estoque de um arquivo XLS">
            <Upload size={16} /> Importar XLS
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx,.csv,.tsv,.txt"
            onChange={handleImportXLS}
            style={{ display: 'none' }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal()}>
            <Plus size={16} /> Novo Produto
          </button>
          </>)}
        </div>
      </div>

      <div className="module-body">
        <div className="toolbar">
          <div className="search-pill">
            <Search size={16} className="search-pill-icon" aria-hidden="true" />
            <input
              type="text"
              className="search-pill-input"
              placeholder="Buscar por nome ou código de barras"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="btn-icon search-pill-clear" onClick={() => setSearchTerm('')} title="Limpar busca">
                <X size={15} />
              </button>
            )}
          </div>

          {criticalCount > 0 && (
            <div className="toolbar-right">
              <span className="badge badge-warning">
                <AlertTriangle size={12} style={{ marginRight: 4 }} />
                {criticalCount} item{criticalCount > 1 ? 's' : ''} para repor
              </span>
            </div>
          )}
        </div>

        <p className="result-count">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
          {searchTerm && ' encontrados'}
        </p>

        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={38} className="text-dim" />
            <p className="empty-state-title">
              {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            </p>
            <p className="empty-state-sub">
              {searchTerm ? `Nada corresponde a "${searchTerm}"` : (isAdmin ? 'Cadastre o primeiro produto para começar' : 'Peça ao administrador para cadastrar os produtos')}
            </p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th className="text-center">Estoque</th>
                  {isAdmin && <th className="text-right">Margem</th>}
                  {isAdmin && <th className="text-right">Custo</th>}
                  <th className="text-right">Preço</th>
                  {isAdmin && <th className="text-right" style={{ width: '110px' }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id}>
                    <td className="text-dim" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {product.barcode || '—'}
                    </td>
                    <td className="font-medium">{product.name}</td>
                    <td className="text-center">{stockBadge(product.stock)}</td>
                    {isAdmin && <td className="text-right">{marginBadge(product.price, product.cost)}</td>}
                    {isAdmin && <td className="text-right text-muted">{product.cost ? formatCurrency(product.cost) : '—'}</td>}
                    <td className="text-right font-bold text-primary">{formatCurrency(product.price)}</td>
                    {isAdmin && (
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="icon-outline" onClick={() => handleOpenModal(product)} title="Editar produto">
                          <Edit2 size={15} />
                        </button>
                        <button className="icon-outline icon-outline-danger" onClick={() => handleDelete(product.id)} title="Excluir produto">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Product Modal ── */}
      {isAdmin && isModalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="modal-content card">
            <div className="flex justify-between items-center border-bottom pb-4 mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package size={20} className="text-primary" />
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button className="btn-icon" onClick={handleCloseModal}>
                <X size={20} className="text-muted" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="flex gap-4 mb-4">
                <div className="form-group" style={{ flex: '0 0 38%' }}>
                  <label>Produto *</label>
                  <input
                    type="text" className="input" autoFocus required
                    value={formData.product}
                    onChange={e => setFormData({ ...formData, product: e.target.value })}
                    placeholder="Ex: Notebook"
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Marca/Modelo</label>
                  <input
                    type="text" className="input"
                    value={formData.brandModel}
                    onChange={e => setFormData({ ...formData, brandModel: e.target.value })}
                    placeholder="Ex: Dell Vostro 3300"
                  />
                </div>
              </div>
              {(formData.product || formData.brandModel) && (
                <p className="text-sm text-muted mb-4" style={{ marginTop: '-8px' }}>
                  Aparece como: <strong className="text-main">{joinName(formData.product, formData.brandModel)}</strong>
                </p>
              )}

              <div className="form-group mb-4">
                <label>Código de Barras</label>
                <input
                  type="text" className="input"
                  value={formData.barcode}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Ex: 7891234567890"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div className="flex gap-4 mb-6">
                <div className="form-group flex-1">
                  <label>Preço de Custo (R$)</label>
                  <input
                    type="number" step="0.01" min="0" className="input"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Preço de Venda (R$) *</label>
                  <input
                    type="number" step="0.01" min="0" className="input" required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="form-group" style={{ width: '110px' }}>
                  <label>Qtd Estoque</label>
                  <input
                    type="number" min="0" className="input"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-surface" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Estoque;
