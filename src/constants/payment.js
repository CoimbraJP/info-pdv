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
