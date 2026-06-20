import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, CreditCard, Tag, X, ShoppingCart, Pencil, Banknote, QrCode } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useGlobalState } from '../context/GlobalState';
import './PDV.css';

const PDV = () => {
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [avulsoItem, setAvulsoItem] = useState({ name: '', price: '', quantity: 1 });

  // Checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cartao');
  const [amountReceived, setAmountReceived] = useState('');

  const barcodeInputRef = useRef(null);
  const { products, addSale, settings } = useGlobalState();

  // Focus barcode input on click anywhere (except inputs)
  useEffect(() => {
    barcodeInputRef.current?.focus();
    const handleGlobalClick = () => {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Autocomplete
  const handleInputChange = (e) => {
    const value = e.target.value;
    setBarcode(value);
    if (value.trim().length >= 1) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.barcode.includes(value)
      );
      setSuggestions([...filtered, { id: 'avulso', name: 'Adicionar item avulso...', barcode: '' }]);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (product) => {
    if (product.id === 'avulso') {
      openAvulsoModal();
    } else {
      addToCart(product);
      setBarcode('');
      setSuggestions([]);
      setShowSuggestions(false);
      barcodeInputRef.current?.focus();
    }
  };

  const openAvulsoModal = () => {
    setAvulsoItem({ name: barcode, price: '', quantity: 1 });
    setEditingId(null);
    setIsModalOpen(true);
    setShowSuggestions(false);
  };

  const handleEditItem = (item) => {
    setAvulsoItem({ name: item.name, price: item.price, quantity: item.quantity });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleAddAvulso = (e) => {
    e.preventDefault();
    if (!avulsoItem.name || !avulsoItem.price) return;
    if (editingId) {
      setCart(prev => prev.map(item =>
        item.id === editingId
          ? { ...item, name: avulsoItem.name, price: parseFloat(avulsoItem.price), quantity: parseInt(avulsoItem.quantity) || 1 }
          : item
      ));
    } else {
      addToCart({
        id: Date.now(),
        name: avulsoItem.name,
        price: parseFloat(avulsoItem.price),
        isAvulso: true
      }, parseInt(avulsoItem.quantity) || 1);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setBarcode('');
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;
    const product = products.find(p => p.barcode === barcode || p.name === barcode);
    if (product) {
      addToCart(product);
      setBarcode('');
      setSuggestions([]);
      setShowSuggestions(false);
    } else if (suggestions.filter(s => s.id !== 'avulso').length > 0) {
      selectSuggestion(suggestions[0]);
    } else {
      openAvulsoModal();
    }
  };

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, { ...product, quantity: qty }];
    });
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discount = 0;
  const total = subtotal - discount;
  const change = paymentMethod === 'dinheiro' ? Math.max(0, parseFloat(amountReceived || 0) - total) : 0;
  const canConfirm = paymentMethod !== 'dinheiro' || parseFloat(amountReceived || 0) >= total;

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (!canConfirm) return;

    addSale({
      items: cart,
      total,
      paymentMethod,
      amountReceived: paymentMethod === 'dinheiro' ? parseFloat(amountReceived) : total
    });

    // Wait for React to render print-only before calling print
    setTimeout(() => {
      window.print();
      setCart([]);
      setIsCheckoutOpen(false);
      setPaymentMethod('cartao');
      setAmountReceived('');
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }, 150);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2' && cart.length > 0 && !isCheckoutOpen && !isModalOpen) {
        e.preventDefault();
        setIsCheckoutOpen(true);
      }
      if (e.key === 'F4' && cart.length > 0 && !isCheckoutOpen && !isModalOpen) {
        e.preventDefault();
        setCart([]);
      }
      if (e.key === 'Escape') {
        setIsCheckoutOpen(false);
        setIsModalOpen(false);
        setShowSuggestions(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutOpen, isModalOpen]);

  return (
    <div className="pdv-container">
      <div className="pdv-main">
        {/* ── Left: Cart ── */}
        <div className="cart-section card">
          <div className="cart-header">
            <h2>Lista de Itens</h2>
            <span className="item-count">{cart.reduce((a, c) => a + c.quantity, 0)} itens</span>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={44} />
                <p>Nenhum item adicionado</p>
                <p>Digite o código ou nome do produto abaixo</p>
              </div>
            ) : (
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="text-center">Qtd</th>
                    <th className="text-right">Unit.</th>
                    <th className="text-right">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.id}>
                      <td className="product-name">{item.name}</td>
                      <td className="text-center font-bold">{item.quantity}</td>
                      <td className="text-right text-muted">{formatCurrency(item.price)}</td>
                      <td className="text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end">
                          <button className="btn-icon text-info" onClick={() => handleEditItem(item)} title="Editar">
                            <Pencil size={16} />
                          </button>
                          <button className="btn-icon text-danger" onClick={() => removeFromCart(item.id)} title="Remover">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Barcode Input */}
          <div className="barcode-section">
            <form onSubmit={handleBarcodeSubmit} className="barcode-form">
              <div className="input-wrapper">
                <Search className="barcode-icon" size={20} />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  className="input barcode-input"
                  placeholder="Código de barras ou nome do produto..."
                  value={barcode}
                  onChange={handleInputChange}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => barcode.length >= 1 && setShowSuggestions(true)}
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-menu">
                    {suggestions.map(p => (
                      <div
                        key={p.id}
                        className={`suggestion-item ${p.id === 'avulso' ? 'suggestion-avulso' : ''}`}
                        onMouseDown={() => selectSuggestion(p)}
                      >
                        <div className="suggestion-info">
                          <span className="suggestion-name">{p.name}</span>
                          {p.id !== 'avulso' && <span className="suggestion-barcode">{p.barcode}</span>}
                        </div>
                        {p.id !== 'avulso' && <span className="suggestion-price">{formatCurrency(p.price)}</span>}
                        {p.id === 'avulso' && <Plus size={16} className="text-primary" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-surface">Adicionar</button>
            </form>
          </div>
        </div>

        {/* ── Right: Totals + Actions ── */}
        <div className="actions-section">
          <div className="totals-card card">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>Desconto</span>
              <span>{formatCurrency(discount)}</span>
            </div>
            <div className="divider"></div>
            <div className="total-row">
              <span className="total-label">Total</span>
              <span className="total-value">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="btn action-btn btn-primary"
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
            >
              <CreditCard size={22} />
              <span>Finalizar Venda</span>
              <span className="shortcut">[F2]</span>
            </button>

            <button className="btn action-btn btn-surface" disabled={cart.length === 0}>
              <Tag size={22} />
              <span>Aplicar Desconto</span>
              <span className="shortcut">[F3]</span>
            </button>

            <button
              className="btn action-btn btn-danger"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
            >
              <X size={22} />
              <span>Cancelar Venda</span>
              <span className="shortcut">[F4]</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Avulso Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <div className="flex justify-between items-center border-bottom pb-4 mb-6">
              <h3 className="text-xl font-bold">{editingId ? 'Editar Item' : 'Item Avulso'}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} className="text-muted" />
              </button>
            </div>
            <form onSubmit={handleAddAvulso}>
              <div className="form-group mb-4">
                <label>Descrição do Item</label>
                <input
                  type="text" className="input" autoFocus required
                  value={avulsoItem.name}
                  onChange={e => setAvulsoItem({ ...avulsoItem, name: e.target.value })}
                  placeholder="Ex: Serviço de limpeza"
                />
              </div>
              <div className="flex gap-4 mb-6">
                <div className="form-group flex-1">
                  <label>Valor Unitário (R$)</label>
                  <input
                    type="number" step="0.01" min="0" className="input" required placeholder="0,00"
                    value={avulsoItem.price}
                    onChange={e => setAvulsoItem({ ...avulsoItem, price: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ width: '90px' }}>
                  <label>Qtd</label>
                  <input
                    type="number" min="1" className="input"
                    value={avulsoItem.quantity}
                    onChange={e => setAvulsoItem({ ...avulsoItem, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-surface" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Salvar Alterações' : 'Adicionar ao Carrinho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Checkout Modal ── */}
      {isCheckoutOpen && (
        <div className="modal-overlay">
          <div className="modal-content card checkout-modal">
            <div className="flex justify-between items-center border-bottom pb-4 mb-6">
              <h3 className="text-xl font-bold">Finalizar Venda</h3>
              <button className="btn-icon" onClick={() => setIsCheckoutOpen(false)}>
                <X size={20} className="text-muted" />
              </button>
            </div>

            {/* Total destaque */}
            <div className="flex justify-between items-center bg-surface-hover p-4 rounded mb-6" style={{ borderRadius: 'var(--radius-lg)' }}>
              <span className="text-muted font-medium text-sm uppercase tracking-wide">Total da Venda</span>
              <span className="total-value" style={{ fontSize: '1.75rem' }}>{formatCurrency(total)}</span>
            </div>

            <form onSubmit={handleCheckoutSubmit}>
              <div className="form-group mb-6">
                <label>Forma de Pagamento</label>
                <div className="payment-toggle mt-2">
                  <button
                    type="button"
                    className={`payment-btn ${paymentMethod === 'cartao' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('cartao')}
                  >
                    <span className="payment-btn-icon">💳</span>
                    <span>Cartão / PIX</span>
                  </button>
                  <button
                    type="button"
                    className={`payment-btn ${paymentMethod === 'dinheiro' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('dinheiro')}
                  >
                    <span className="payment-btn-icon">💵</span>
                    <span>Dinheiro</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div className="form-group mb-4">
                  <label>Valor Recebido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    autoFocus
                    value={amountReceived}
                    onChange={e => setAmountReceived(e.target.value)}
                    placeholder="0,00"
                    style={{ fontSize: '1.25rem', fontWeight: '700', height: '52px' }}
                  />
                  {amountReceived && parseFloat(amountReceived) >= total && (
                    <div className="change-display">
                      <span className="text-muted font-medium">Troco</span>
                      <span className="change-value">{formatCurrency(change)}</span>
                    </div>
                  )}
                  {amountReceived && parseFloat(amountReceived) < total && (
                    <p className="text-danger text-sm mt-2">
                      Faltam {formatCurrency(total - parseFloat(amountReceived))}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end mt-6">
                <button type="button" className="btn btn-surface" onClick={() => setIsCheckoutOpen(false)}>
                  Voltar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!canConfirm}>
                  <CreditCard size={18} />
                  Confirmar e Imprimir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Print Receipt (screen-hidden) ── */}
      <div className={`print-only template-${settings?.osPrintTemplate || 'thermal-1'}`}>
        <div className="print-header">
          <span className="print-logo">INFO CENTRO</span>
          <p>SJC — São Paulo</p>
          <p>Tel: (12) 99999-9999</p>
          <p>{new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div className="print-section text-center">
          <span className="print-section-title">CUPOM NÃO FISCAL</span>
        </div>
        <div className="print-section" style={{ borderBottom: '1px dashed #000', paddingBottom: '2mm' }}>
          <div className="print-row" style={{ fontWeight: 'bold' }}>
            <span>DESCRIÇÃO</span>
            <span>TOTAL</span>
          </div>
          {cart.map(item => (
            <div key={item.id} style={{ marginBottom: '1mm' }}>
              <div>{item.name}</div>
              <div className="print-row">
                <span>{item.quantity} x {formatCurrency(item.price)}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="print-section" style={{ marginTop: '2mm' }}>
          <div className="print-row" style={{ fontSize: '11pt', fontWeight: 'bold' }}>
            <span>TOTAL</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="print-row">
            <span>Pagamento</span>
            <span>{paymentMethod === 'cartao' ? 'Cartão/PIX' : 'Dinheiro'}</span>
          </div>
          {paymentMethod === 'dinheiro' && (
            <>
              <div className="print-row">
                <span>Recebido</span>
                <span>{formatCurrency(parseFloat(amountReceived || 0))}</span>
              </div>
              <div className="print-row">
                <span>Troco</span>
                <span>{formatCurrency(change)}</span>
              </div>
            </>
          )}
        </div>
        <div className="print-footer">
          <p>Obrigado pela preferência!</p>
          <p>infocentro.com.br</p>
        </div>
      </div>
    </div>
  );
};

export default PDV;
