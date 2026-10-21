import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, CreditCard, X, ShoppingCart, Pencil, Percent } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useGlobalState } from '../context/GlobalState';
import './PDV.css';

/**
 * "3*7891234" ou "3*cabo hdmi" → { qty: 3, term: '7891234' }.
 * Só o asterisco é separador (um nome como "4x4..." não vira quantidade).
 */
const parseQuery = (raw) => {
  const m = String(raw || '').match(/^\s*(\d{1,3})\s*\*\s*(.+)$/);
  return m
    ? { qty: Math.max(1, parseInt(m[1], 10)), term: m[2].trim() }
    : { qty: 1, term: String(raw || '').trim() };
};

/**
 * Desconto por VALOR FINAL: a venda deu 214, o vendedor digita 200 e o
 * sistema calcula o desconto (14). Aceita "200", "199,90" ou "R$ 199,90".
 */
const parseFinalPrice = (raw, subtotal) => {
  const s = String(raw || '').trim();
  if (!s) return { value: 0, error: '' };
  const final = parseFloat(s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(final) || final <= 0) return { value: 0, error: 'Valor inválido' };
  if (final > subtotal) return { value: 0, error: `Maior que o total da venda (${formatCurrency(subtotal)})` };
  return { value: Math.round((subtotal - final) * 100) / 100, error: '' };
};

const isTypingField = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

const PDV = () => {
  const [cart, setCart] = useState([]);
  const [barcode, setBarcode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0); // sugestão destacada (↑/↓)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [avulsoItem, setAvulsoItem] = useState({ name: '', price: '', quantity: 1 });

  // Checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cartao');
  const [amountReceived, setAmountReceived] = useState('');
  const [finalPriceInput, setFinalPriceInput] = useState(''); // valor final combinado com o cliente

  const barcodeInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const amountInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const focusDiscountRef = useRef(false); // F3 abre o checkout já no campo de desconto
  const submittingRef = useRef(false); // evita venda duplicada com Enter repetido
  const { products, addSale, settings } = useGlobalState();

  // Focus barcode input on click anywhere (except inputs)
  useEffect(() => {
    barcodeInputRef.current?.focus();
    const handleGlobalClick = () => {
      // Com modal aberto o foco é do modal — antes o clique devolvia o foco
      // para a busca (atrás do modal) e o Enter disparava a busca.
      if (document.querySelector('.modal-overlay')) return;
      if (!isTypingField(document.activeElement)) {
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
    setActiveIndex(0);
    const { term } = parseQuery(value);
    if (term.length >= 1) {
      const filtered = products.filter(p =>
        (p.name || '').toLowerCase().includes(term.toLowerCase()) ||
        (p.barcode || '').includes(term)
      );
      setSuggestions([...filtered, { id: 'avulso', name: 'Adicionar item avulso...', barcode: '' }]);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (product, qty = parseQuery(barcode).qty) => {
    if (product.id === 'avulso') {
      openAvulsoModal();
    } else {
      addToCart(product, qty);
      setBarcode('');
      setSuggestions([]);
      setShowSuggestions(false);
      barcodeInputRef.current?.focus();
    }
  };

  const openAvulsoModal = () => {
    const { qty, term } = parseQuery(barcode);
    setAvulsoItem({ name: term, price: '', quantity: qty });
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
        id: crypto.randomUUID(),
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
    const { qty, term } = parseQuery(barcode);
    if (!term) return;
    const menuOpen = showSuggestions && suggestions.length > 0;

    // 1) Escolha feita com ↑/↓ tem prioridade
    if (menuOpen && activeIndex > 0) {
      selectSuggestion(suggestions[activeIndex], qty);
      return;
    }
    // 2) Leitor de código de barras: correspondência exata
    const exact = products.find(p =>
      p.barcode === term || (p.name || '').toLowerCase() === term.toLowerCase()
    );
    if (exact) {
      selectSuggestion(exact, qty);
      return;
    }
    // 3) Primeira sugestão (destacada) ou item avulso
    if (menuOpen) {
      selectSuggestion(suggestions[activeIndex] || suggestions[0], qty);
    } else {
      openAvulsoModal();
    }
  };

  /** ↑/↓ navega nas sugestões; Enter (no submit) adiciona a destacada. */
  const handleBarcodeKeyDown = (e) => {
    const len = suggestions.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!len) return;
      e.preventDefault();
      if (!showSuggestions) { setShowSuggestions(true); return; }
      setActiveIndex(i => (e.key === 'ArrowDown' ? (i + 1) % len : (i - 1 + len) % len));
    }
  };

  // Mantém a sugestão destacada visível ao navegar com as setas
  useEffect(() => {
    suggestionsRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, showSuggestions]);

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

  /** Cancelar limpa o carrinho — confirma quando há vários itens digitados. */
  const handleCancelSale = () => {
    if (cart.length === 0) return;
    if (cart.length > 1 && !window.confirm(`Cancelar a venda e remover ${cart.length} itens do carrinho?`)) return;
    setCart([]);
    setFinalPriceInput('');
    barcodeInputRef.current?.focus();
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const { value: discount, error: discountError } = parseFinalPrice(finalPriceInput, subtotal);
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const change = paymentMethod === 'dinheiro' ? Math.max(0, parseFloat(amountReceived || 0) - total) : 0;
  const canConfirm = !discountError && (paymentMethod !== 'dinheiro' || parseFloat(amountReceived || 0) >= total);

  const openCheckout = ({ focusDiscount = false } = {}) => {
    if (cart.length === 0) return;
    focusDiscountRef.current = focusDiscount;
    setPaymentMethod('cartao');
    setAmountReceived('');
    setShowSuggestions(false);
    setIsCheckoutOpen(true);
  };

  const choosePayment = (method) => setPaymentMethod(method);

  /**
   * Foco sempre no lugar certo:
   * - checkout aberto em Cartão/PIX → botão Confirmar (Enter finaliza);
   * - checkout em Dinheiro → campo "Valor recebido";
   * - nenhum modal → campo de busca.
   */
  useEffect(() => {
    const t = setTimeout(() => {
      if (isCheckoutOpen) {
        if (focusDiscountRef.current) {
          focusDiscountRef.current = false;
          discountInputRef.current?.focus();
          discountInputRef.current?.select();
        } else if (paymentMethod === 'dinheiro') amountInputRef.current?.focus();
        else confirmBtnRef.current?.focus();
      } else if (!isModalOpen) {
        barcodeInputRef.current?.focus();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [isCheckoutOpen, isModalOpen, paymentMethod]);

  const handleCheckoutSubmit = (e) => {
    e?.preventDefault();
    if (!canConfirm || submittingRef.current) return;
    submittingRef.current = true;

    addSale({
      items: cart,
      subtotal,
      discount,
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
      setFinalPriceInput('');
      submittingRef.current = false;
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }, 150);
  };

  /*
   * Atalhos de teclado:
   *  Busca    ↑/↓ escolhe · Enter adiciona · 3*código = quantidade
   *  F2       finalizar venda · F3 desconto · F4 cancelar venda · Esc fecha
   *  Checkout C ou 1 = Cartão/PIX · D ou 2 = Dinheiro · ←/→ alterna
   *           Enter confirma e imprime
   */
  const handleKeyDown = (e) => {
    if (isCheckoutOpen) {
      const typing = isTypingField(e.target);
      const k = e.key.toLowerCase();
      if (k === 'c' || (!typing && k === '1')) { e.preventDefault(); choosePayment('cartao'); return; }
      if (k === 'd' || (!typing && k === '2')) { e.preventDefault(); choosePayment('dinheiro'); return; }
      if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        choosePayment(paymentMethod === 'cartao' ? 'dinheiro' : 'cartao');
        return;
      }
      // Enter fora de campo/botão (ex.: foco no fundo do modal) também confirma
      if (e.key === 'Enter' && !e.target.closest?.('form')) {
        e.preventDefault();
        handleCheckoutSubmit();
        return;
      }
    }
    if (e.key === 'F3' && cart.length > 0 && !isModalOpen) {
      e.preventDefault();
      if (isCheckoutOpen) { discountInputRef.current?.focus(); discountInputRef.current?.select(); }
      else openCheckout({ focusDiscount: true });
      return;
    }
    if (e.key === 'F2' && cart.length > 0 && !isCheckoutOpen && !isModalOpen) {
      e.preventDefault();
      openCheckout();
    }
    if (e.key === 'F4' && cart.length > 0 && !isCheckoutOpen && !isModalOpen) {
      e.preventDefault();
      handleCancelSale();
    }
    if (e.key === 'Escape') {
      setIsCheckoutOpen(false);
      setIsModalOpen(false);
      setShowSuggestions(false);
    }
  };

  // O listener é registrado uma vez e sempre chama a versão mais recente
  const keyHandlerRef = useRef(handleKeyDown);
  useEffect(() => { keyHandlerRef.current = handleKeyDown; });
  useEffect(() => {
    const onKey = (e) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="pdv-container">
      <div className="pdv-main">
        {/* ── Left: Cart ── */}
        <div className="cart-section card">
          <div className="cart-header">
            <h2 className="panel-title"><ShoppingCart size={17} /> Lista de Itens</h2>
            <span className="item-count">
              {cart.reduce((a, c) => a + c.quantity, 0)} {cart.reduce((a, c) => a + c.quantity, 0) === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={38} className="text-dim" />
                <p className="empty-state-title">Nenhum item adicionado</p>
                <p className="empty-state-sub">Digite o código ou o nome do produto abaixo</p>
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
                          <button className="icon-outline" onClick={() => handleEditItem(item)} title="Editar item">
                            <Pencil size={15} />
                          </button>
                          <button className="icon-outline icon-outline-danger" onClick={() => removeFromCart(item.id)} title="Remover item">
                            <Trash2 size={15} />
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
                  placeholder="Código de barras ou nome do produto  ·  ↑↓ escolhe · Enter adiciona · 3*código"
                  value={barcode}
                  onChange={handleInputChange}
                  onKeyDown={handleBarcodeKeyDown}
                  role="combobox"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="pdv-suggestions"
                  aria-activedescendant={showSuggestions && suggestions[activeIndex] ? `sug-${suggestions[activeIndex].id}` : undefined}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => barcode.length >= 1 && setShowSuggestions(true)}
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-menu" id="pdv-suggestions" role="listbox" ref={suggestionsRef}>
                    {suggestions.map((p, i) => (
                      <div
                        key={p.id}
                        id={`sug-${p.id}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        className={`suggestion-item ${p.id === 'avulso' ? 'suggestion-avulso' : ''} ${i === activeIndex ? 'is-active' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(p); }}
                        onMouseEnter={() => setActiveIndex(i)}
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
            <div className={`totals-row ${discount > 0 ? 'text-success' : ''}`}>
              <span>Desconto</span>
              <span>{discount > 0 ? `− ${formatCurrency(discount)}` : formatCurrency(0)}</span>
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
              onClick={openCheckout}
            >
              <CreditCard size={22} />
              <span>Finalizar Venda</span>
              <span className="shortcut">[F2]</span>
            </button>

            <button
              className="btn-outline action-btn"
              onClick={() => openCheckout({ focusDiscount: true })}
              disabled={cart.length === 0}
            >
              <Percent size={20} />
              <span>Desconto</span>
              <span className="shortcut">[F3]</span>
            </button>

            <button
              className="btn-outline action-btn"
              onClick={handleCancelSale}
              disabled={cart.length === 0}
            >
              <X size={20} />
              <span>Cancelar Venda</span>
              <span className="shortcut">[F4]</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Avulso Modal ── */}
      {isModalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
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
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setIsCheckoutOpen(false)}>
          <div className="modal-content card checkout-modal">
            <div className="flex justify-between items-center border-bottom pb-4 mb-6">
              <h3 className="text-xl font-bold">Finalizar Venda</h3>
              <button className="btn-icon" onClick={() => setIsCheckoutOpen(false)}>
                <X size={20} className="text-muted" />
              </button>
            </div>

            {/* Total destaque */}
            <div className="checkout-total-box mb-5">
              {discount > 0 && (
                <div className="checkout-sub">
                  <span>Subtotal {formatCurrency(subtotal)}</span>
                  <span className="text-success">Desconto − {formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted font-medium text-sm uppercase tracking-wide">Total da Venda</span>
                <span className="total-value" style={{ fontSize: '1.75rem' }}>{formatCurrency(total)}</span>
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit}>
              <div className="form-group mb-5">
                <label htmlFor="pdv-discount">
                  Valor com desconto (R$) <kbd className="kbd">F3</kbd>
                </label>
                <input
                  id="pdv-discount"
                  ref={discountInputRef}
                  type="text"
                  inputMode="decimal"
                  className={`input ${discountError ? 'input-error' : ''}`}
                  placeholder={`Total ${formatCurrency(subtotal)} — digite o valor final, ex.: ${Math.floor(subtotal)}`}
                  value={finalPriceInput}
                  onChange={e => setFinalPriceInput(e.target.value)}
                  onKeyDown={e => {
                    // Enter no desconto não finaliza: passa para o próximo passo
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (discountError) return;
                      if (paymentMethod === 'dinheiro') amountInputRef.current?.focus();
                      else confirmBtnRef.current?.focus();
                    }
                  }}
                  autoComplete="off"
                />
                {discountError && <p className="text-danger text-sm mt-2">{discountError}</p>}
                {!discountError && discount > 0 && (
                  <p className="discount-notice">
                    Desconto de <strong>{formatCurrency(discount)}</strong> — cliente paga {formatCurrency(total)}
                  </p>
                )}
              </div>

              <div className="form-group mb-6">
                <label>Forma de Pagamento</label>
                <div className="payment-toggle mt-2">
                  <button
                    type="button"
                    className={`payment-btn ${paymentMethod === 'cartao' ? 'active' : ''}`}
                    onClick={() => choosePayment('cartao')}
                    aria-pressed={paymentMethod === 'cartao'}
                  >
                    <span className="payment-btn-icon">💳</span>
                    <span>Cartão / PIX</span>
                    <kbd className="kbd">C</kbd>
                  </button>
                  <button
                    type="button"
                    className={`payment-btn ${paymentMethod === 'dinheiro' ? 'active' : ''}`}
                    onClick={() => choosePayment('dinheiro')}
                    aria-pressed={paymentMethod === 'dinheiro'}
                  >
                    <span className="payment-btn-icon">💵</span>
                    <span>Dinheiro</span>
                    <kbd className="kbd">D</kbd>
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
                    ref={amountInputRef}
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

              <div className="flex gap-2 justify-end items-center mt-6">
                <span className="checkout-hint">
                  <kbd className="kbd">C</kbd>/<kbd className="kbd">D</kbd> pagamento · <kbd className="kbd">Esc</kbd> voltar
                </span>
                <button type="button" className="btn btn-surface" onClick={() => setIsCheckoutOpen(false)}>
                  Voltar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!canConfirm} ref={confirmBtnRef}>
                  <CreditCard size={18} />
                  Confirmar e Imprimir
                  <kbd className="kbd kbd-on-primary">Enter</kbd>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Print Receipt (screen-hidden) ── */}
      <div className={`print-only template-${settings?.osPrintTemplate || 'thermal-1'}`}>
        <div className="print-header">
          <span className="print-logo">{settings?.storeName || 'INFO CENTRO'}</span>
          <p>{settings?.storeAddress || 'SJC — São Paulo'}</p>
          <p>Tel: {settings?.storePhone || '(12) 99999-9999'}</p>
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
          {discount > 0 && (
            <>
              <div className="print-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="print-row">
                <span>Desconto</span>
                <span>- {formatCurrency(discount)}</span>
              </div>
            </>
          )}
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
