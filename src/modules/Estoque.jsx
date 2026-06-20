import React, { useState } from 'react';
import { Package, Search, Plus, Edit2, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { formatCurrency } from '../utils/formatters';
import './OS.css';

const Estoque = () => {
  const { products, setProducts } = useGlobalState();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const initialFormState = { name: '', barcode: '', price: '', cost: '', stock: '' };
  const [formData, setFormData] = useState(initialFormState);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const criticalCount = products.filter(p => p.stock <= 2).length;

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ name: product.name, barcode: product.barcode || '', price: product.price, cost: product.cost ?? '', stock: product.stock });
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
    if (!formData.name || !formData.price) return;

    const newProduct = {
      id: editingProduct ? editingProduct.id : Date.now(),
      name: formData.name.trim(),
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

  return (
    <div className="os-container">
      <div className="module-header">
        <h2 className="module-title flex items-center gap-2">
          <Package size={22} className="text-primary" />
          Gestão de Estoque
        </h2>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--status-warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={16} className="text-warning" />
              <span className="text-sm text-warning font-bold">{criticalCount} crítico{criticalCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="module-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Search */}
          <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="search-bar" style={{ maxWidth: '440px' }}>
              <Search size={18} className="text-muted" style={{ flexShrink: 0 }} />
              <input
                type="text"
                className="input"
                placeholder="Buscar por nome ou código de barras..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="os-table-container">
            <table className="os-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th className="text-center">Estoque</th>
                  <th className="text-right">Preço</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id}>
                    <td className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>
                      {product.barcode || '—'}
                    </td>
                    <td className="font-medium">{product.name}</td>
                    <td className="text-center">{stockBadge(product.stock)}</td>
                    <td className="text-right font-bold text-primary">{formatCurrency(product.price)}</td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          className="btn-icon text-info"
                          onClick={() => handleOpenModal(product)}
                          title="Editar produto"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon text-danger"
                          onClick={() => handleDelete(product.id)}
                          title="Excluir produto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-8">
                      {searchTerm ? `Nenhum produto encontrado para "${searchTerm}"` : 'Nenhum produto cadastrado.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats footer */}
        <div className="flex gap-3 mt-4">
          <div className="card flex-1" style={{ padding: 'var(--s-4)' }}>
            <span className="text-muted text-xs uppercase tracking-wide">Total de Produtos</span>
            <p className="font-bold text-2xl mt-1">{products.length}</p>
          </div>
          <div className="card flex-1" style={{ padding: 'var(--s-4)' }}>
            <span className="text-muted text-xs uppercase tracking-wide">Valor em Estoque</span>
            <p className="font-bold text-2xl mt-1 text-primary">
              {formatCurrency(products.reduce((acc, p) => acc + (p.price * p.stock), 0))}
            </p>
          </div>
          <div className="card flex-1" style={{ padding: 'var(--s-4)' }}>
            <span className="text-muted text-xs uppercase tracking-wide">Itens Críticos</span>
            <p className={`font-bold text-2xl mt-1 ${criticalCount > 0 ? 'text-warning' : 'text-success'}`}>
              {criticalCount}
            </p>
          </div>
        </div>
      </div>

      {/* ── Product Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay">
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
              <div className="form-group mb-4">
                <label>Nome do Produto *</label>
                <input
                  type="text" className="input" autoFocus required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Teclado Mecânico Redragon"
                />
              </div>

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
