/** Utilidades de valores em R$ (entrada digitada e planilhas). */

export const round2 = (n) => Math.round(n * 100) / 100;

/** "1.500,50", "200,5", "200.50", "R$ 200" → número (NaN se vazio/inválido). */
export const parseMoney = (raw) => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  let s = String(raw ?? '').replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (!/^-?\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, ''); // "1.500" = mil e quinhentos
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** 199.9 → "199,90" (para campo de texto e planilha pt-BR). */
export const toInputMoney = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
