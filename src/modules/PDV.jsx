import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, CreditCard, X, ShoppingCart, Pencil, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useGlobalState } from '../context/GlobalState';
import { PAYMENT_METHODS, paymentLabel } from '../constants/payment';
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

const round2 = (n) => Math.round(n * 100) / 100;

/** "1.500,50", "200,5", "200.50", "R$ 200" → número (NaN se vazio/inválido). */
const parseMoney = (raw) => {
  let s = String(raw ?? '').replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, ''); // "1.500" = mil e quinhentos
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const toInputMoney = (n) => n.toFixed(2).replace('.', ',');

/**
 * Valor final digitado pelo vendedor. Venda de 214, digitou 200 →
 * { final: 200, discount: 14 }. Vazio = sem desconto.
 */
const parseFinalPrice = (raw, subtotal) => {
  if (!String(raw ?? '').trim()) return { final: subtotal, discount: 0, error: '' };
  const n = parseMoney(raw);
  if (!Number.isFinite(n) || n <= 0) return { final: subtotal, discount: 0, error: 'Valor inválido' };
  if (n > subtotal + 0.001) return { final: subtotal, discount: 0, error: `Maior que o total da venda (${formatCurrency(subtotal)})` };
  const final = round2(n);
  return { final, discount: round2(subtotal - final), error: '' };
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
  const [finalPriceInput, setFinalPriceInput] = useState(''); // valor final combinado com o cliente
  // Passos: 'pagamento' → 'valor' (Enter finaliza e imprime; digitar menos = desconto)
  const [checkoutStep, setCheckoutStep] = useState('pagamento');

  const barcodeInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const checkoutRef = useRef(null);
  const finalInputRef = useRef(null);
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

  const subtotal = round2(cart.reduce((acc, item) => acc + (item.price * item.quantity), 0));
  const { final: total, discount, error: priceError } = parseFinalPrice(finalPriceInput, subtotal);

  const openCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod('cartao');
    setFinalPriceInput(toInputMoney(subtotal));
    setCheckoutStep('pagamento');
    setShowSuggestions(false);
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep('pagamento');
  };

  /** Esc volta um passo; no primeiro passo fecha. */
  const stepBack = () => {
    if (checkoutStep === 'valor') setCheckoutStep('pagamento');
    else closeCheckout();
  };

  /** Enter no valor: finaliza e imprime na hora, em qualquer forma de pagamento. */
  const confirmValue = () => {
    if (priceError) return;
    finalizeSale();
  };

  const finalizeSale = () => {
    if (submittingRef.current || priceError) return;
    submittingRef.current = true;

    addSale({
      items: cart,
      subtotal,
      discount,
      total,
      paymentMethod,
      amountReceived: total,
    });

    // Espera o React renderizar o cupom antes de imprimir
    setTimeout(() => {
      window.print();
      setCart([]);
      closeCheckout();
      setPaymentMethod('cartao');
      setFinalPriceInput('');
      submittingRef.current = false;
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }, 150);
  };

  /** Foco certo em cada passo (e de volta na busca ao fechar). */
  useEffect(() => {
    const t = setTimeout(() => {
      if (isCheckoutOpen) {
        if (checkoutStep === 'pagamento') checkoutRef.current?.focus();
        if (checkoutStep === 'valor') { finalInputRef.current?.focus(); finalInputRef.current?.select(); }
      } else if (!isModalOpen) {
        barcodeInputRef.current?.focus();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [isCheckoutOpen, isModalOpen, checkoutStep]);

  /*
   * Atalhos de teclado:
   *  Busca     ↑/↓ escolhe · Enter adiciona · 3*código = quantidade
   *  Venda     F2 finalizar · F4 cancelar · Esc fecha
   *  Checkout  1) C = Cartão · P = PIX · D = Dinheiro (ou 1/2/3, ←/→) · Enter
   *            2) valor da venda (digite menos para dar desconto) · Enter finaliza
   *            Esc volta um passo
   */
  const handleKeyDown = (e) => {
    if (isCheckoutOpen) {
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') { e.preventDefault(); stepBack(); return; }

      if (checkoutStep === 'pagamento') {
        const picked = PAYMENT_METHODS.find(m => m.key === k || m.num === k);
        if (picked) { e.preventDefault(); setPaymentMethod(picked.id); return; }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          setPaymentMethod(cur => {
            const i = PAYMENT_METHODS.findIndex(m => m.id === cur);
            return PAYMENT_METHODS[(i + step + PAYMENT_METHODS.length) % PAYMENT_METHODS.length].id;
          });
          return;
        }
        if (e.key === 'Enter') { e.preventDefault(); setCheckoutStep('valor'); }
        return;
      }
      if (checkoutStep === 'valor' && e.key === 'Enter') { e.preventDefault(); confirmValue(); return; }
      return; // demais teclas: digitação normal nos campos
    }

    if (e.key === 'F2' && cart.length > 0 && !isModalOpen) {
      e.preventDefault();
      openCheckout();
    }
    if (e.key === 'F4' && cart.length > 0 && !isModalOpen) {
      e.preventDefault();
      handleCancelSale();
    }
    if (e.key === 'Escape') {
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
            <div className="divider"></div>
            <div className="total-row">
              <span className="total-label">Total</span>
              <span className="total-value">{formatCurrency(subtotal)}</span>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="btn action-btn btn-primary"
              disabled={cart.length === 0}
              onClick={() => openCheckout()}
            >
              <CreditCard size={22} />
              <span>Finalizar Venda</span>
              <span className="shortcut">[F2]</span>
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

      {/* ── Checkout Modal (por passos, 100% teclado) ── */}
      {isCheckoutOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeCheckout()}>
          <div className="modal-content card checkout-modal" ref={checkoutRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="checkout-title">
            <div className="flex justify-between items-center border-bottom pb-4 mb-5">
              <h3 id="checkout-title" className="text-xl font-bold">Finalizar Venda</h3>
              <button className="btn-icon" onClick={closeCheckout} title="Fechar (Esc)">
                <X size={20} className="text-muted" />
              </button>
            </div>

            <div className="checkout-total-box mb-5">
              <div className="flex justify-between items-center">
                <span className="text-muted font-medium text-sm uppercase tracking-wide">Total da Venda</span>
                <span className="total-value" style={{ fontSize: '1.75rem' }}>{formatCurrency(subtotal)}</span>
              </div>
              {checkoutStep !== 'pagamento' && (
                <div className="checkout-sub" style={{ borderBottom: 'none', borderTop: '1px dashed var(--border-strong)', margin: 'var(--s-2) 0 0', padding: 'var(--s-2) 0 0' }}>
                  <span>Pagamento: <strong>{paymentLabel(paymentMethod)}</strong></span>
                  {discount > 0 && checkoutStep !== 'valor' && (
                    <span className="text-success">Venda por <strong>{formatCurrency(total)}</strong></span>
                  )}
                </div>
              )}
            </div>

            {/* Passo 1 — forma de pagamento */}
            {checkoutStep === 'pagamento' && (
              <>
                <label className="checkout-step-label">Forma de pagamento</label>
                <div className="payment-toggle mt-2">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`payment-btn ${paymentMethod === m.id ? 'active' : ''}`}
                      onClick={() => { setPaymentMethod(m.id); setCheckoutStep('valor'); }}
                      aria-pressed={paymentMethod === m.id}
                    >
                      <span className="payment-btn-icon">{m.icon}</span>
                      <span>{m.label}</span>
                      <kbd className="kbd">{m.key.toUpperCase()}</kbd>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Passo 2 — valor da venda (digitar menos = desconto) */}
            {checkoutStep === 'valor' && (
              <div className="form-group">
                <label htmlFor="pdv-final" className="checkout-step-label">Valor da venda (R$)</label>
                <input
                  id="pdv-final"
                  ref={finalInputRef}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={`input checkout-big-input ${priceError ? 'input-error' : ''}`}
                  value={finalPriceInput}
                  onChange={e => setFinalPriceInput(e.target.value)}
                />
                {priceError
                  ? <p className="text-danger text-sm mt-2">{priceError}</p>
                  : discount > 0
                    ? <p className="discount-notice">Desconto de <strong>{formatCurrency(discount)}</strong> — sai no cupom. Enter finaliza por {formatCurrency(total)}.</p>
                    : <p className="text-dim text-sm mt-2">Para dar desconto, digite o valor combinado (ex.: {Math.floor(subtotal * 0.95)}).</p>}
              </div>
            )}

            {/* Rodapé */}
            <div className="flex gap-2 justify-end items-center mt-6">
              <span className="checkout-hint">
                {checkoutStep === 'pagamento' && <><kbd className="kbd">C</kbd>/<kbd className="kbd">P</kbd>/<kbd className="kbd">D</kbd> escolhe · </>}
                <kbd className="kbd">Esc</kbd> {checkoutStep === 'pagamento' ? 'fechar' : 'voltar'}
              </span>
              <button type="button" className="btn btn-surface" onClick={stepBack}>
                {checkoutStep === 'pagamento' ? 'Cancelar' : <><ArrowLeft size={16} /> Voltar</>}
              </button>

              {checkoutStep === 'pagamento' && (
                <button type="button" className="btn btn-primary" onClick={() => setCheckoutStep('valor')}>
                  Continuar <kbd className="kbd kbd-on-primary">Enter</kbd>
                </button>
              )}
              {checkoutStep === 'valor' && (
                <button type="button" className="btn btn-primary" onClick={confirmValue} disabled={!!priceError}>
                  Finalizar e imprimir
                  <kbd className="kbd kbd-on-primary">Enter</kbd>
                </button>
              )}
            </div>
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
            <span>{paymentLabel(paymentMethod)}</span>
          </div>
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
