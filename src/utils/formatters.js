export const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

export const formatPhone = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

export const formatCPF = (value) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

/**
 * Formats a date string or Date object to pt-BR locale date + time.
 * Returns: "05/05/2026 14:30"
 */
export const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date)) return String(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats a date string or Date object to pt-BR locale date only.
 * Returns: "05/05/2026"
 */
export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date)) return String(value);
  return date.toLocaleDateString('pt-BR');
};
