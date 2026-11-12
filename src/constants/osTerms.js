/**
 * Condições impressas no final da O.S. (as duas vias).
 * Texto padrão — editável em Configurações > Dados da Loja > "Condições da O.S.".
 * Uma condição por linha.
 */
export const DEFAULT_OS_TERMS = [
  '1. Prazo de retirada: 90 dias após a abertura da O.S.',
  '2. Entrega do equipamento somente com esta O.S.',
  '3. Equipamentos deixados há mais de 120 dias serão descartados.',
  '4. Taxa de conservação: R$ 5,00 por dia após 10 dias do aviso.',
  '5. Não nos responsabilizamos por dados caso o HD apresente defeito ou precise ser formatado.',
].join('\n');

/** Texto efetivo: o salvo em Configurações (mesmo vazio = sem condições) ou o padrão. */
export const osTermsLines = (settings) =>
  String(settings?.osTerms ?? DEFAULT_OS_TERMS)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
