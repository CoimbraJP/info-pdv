/**
 * Formas de pagamento do PDV — fonte única (PDV, Vendas, Dashboard).
 * Vendas antigas gravadas como 'cartao' eram "Cartão / PIX" juntos; a partir
 * desta versão PIX é separado ('pix').
 */
export const PAYMENT_METHODS = [
  { id: 'cartao',   label: 'Cartão',   key: 'c', num: '1', icon: '💳' },
  { id: 'pix',      label: 'PIX',      key: 'p', num: '2', icon: '📱' },
  { id: 'dinheiro', label: 'Dinheiro', key: 'd', num: '3', icon: '💵' },
];

export const paymentLabel = (id) =>
  PAYMENT_METHODS.find((m) => m.id === id)?.label || id || '—';

export const paymentBadge = (id) =>
  ({ cartao: 'badge-info', pix: 'badge-primary', dinheiro: 'badge-success' }[id] || 'badge-info');

/**
 * Taxas da maquininha (Point — Mercado Pago), em %. PIX é isento.
 * Débito e crédito por número de parcelas (1 = crédito à vista).
 */
export const CARD_FEES = {
  debito: 0.99,
  credito: {
    1: 3.05, 2: 4.29, 3: 5.09, 4: 5.89, 5: 6.69, 6: 7.49, 7: 8.39, 8: 9.19, 9: 9.99,
    10: 10.79, 11: 11.59, 12: 12.39, 13: 14.18, 14: 14.98, 15: 15.78, 16: 16.58, 17: 17.38, 18: 18.18,
  },
};

/** Janela "Cartão" no PDV: 3 modos; "Parcelado" abre a escolha de 2x a 18x. */
export const CARD_MODES = [
  { id: 'debito',    key: 'd', label: 'Débito' },
  { id: 'avista',    key: 'v', label: 'Crédito à vista' },
  { id: 'parcelado', key: 'p', label: 'Parcelado' },
];

export const MAX_INSTALLMENTS = Math.max(...Object.keys(CARD_FEES.credito).map(Number)); // 18

/** Modo + parcelas → dados gravados na venda e mostrados na tela. */
export const cardDetails = (mode, installments = 2) => {
  if (mode === 'debito') return { type: 'debito', installments: 1, rate: CARD_FEES.debito, label: 'Débito' };
  if (mode === 'avista') return { type: 'credito', installments: 1, rate: CARD_FEES.credito[1], label: 'Crédito à vista' };
  const n = Math.min(MAX_INSTALLMENTS, Math.max(2, Number(installments) || 2));
  return { type: 'credito', installments: n, rate: CARD_FEES.credito[n], label: `Crédito ${n}x` };
};

/** Texto da forma de pagamento de uma venda (lista, recibo): "Cartão crédito 3x". */
export const paymentText = (sale) => {
  if (sale?.paymentMethod !== 'cartao' || !sale.cardType) return paymentLabel(sale?.paymentMethod);
  if (sale.cardType === 'debito') return 'Cartão débito';
  return sale.installments > 1 ? `Cartão crédito ${sale.installments}x` : 'Cartão crédito';
};
