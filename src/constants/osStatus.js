/**
 * Fonte única dos status de OS.
 *
 * Três status de TRABALHO (alternados na badge do cabeçalho) + o estado
 * terminal "Encerrado", que não é opção da badge: só é atingido pelo botão
 * "Encerrar OS". Isso mantém o fluxo do balcão com 3 estados e preserva o
 * arquivamento.
 */
export const OS_STATUS = {
  ANALISE: 'Em análise',
  PRONTO: 'Pronto avisar cliente',
  MARCONDES: 'Marcondes',
  ENCERRADO: 'Encerrado',
};

/** Status alternáveis pelo técnico (badge). */
export const OS_STATUS_WORK = [
  OS_STATUS.ANALISE,
  OS_STATUS.PRONTO,
  OS_STATUS.MARCONDES,
];

export const OS_STATUS_LIST = [...OS_STATUS_WORK, OS_STATUS.ENCERRADO];

/** Aparência de cada status — usa os tokens de status do design system. */
export const OS_STATUS_META = {
  [OS_STATUS.ANALISE]:   { label: 'EM ANÁLISE',            color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  [OS_STATUS.PRONTO]:    { label: 'PRONTO AVISAR CLIENTE', color: 'var(--status-success)', bg: 'var(--status-success-bg)' },
  [OS_STATUS.MARCONDES]: { label: 'MARCONDES',             color: 'var(--status-info)',    bg: 'var(--status-info-bg)' },
  [OS_STATUS.ENCERRADO]: { label: 'ENCERRADO',             color: 'var(--text-muted)',     bg: 'rgba(138,142,151,0.12)' },
};

/**
 * Converte status antigos ("Aguardando Aprovação / Peças", "Pronto Avisar
 * Cliente.") para o conjunto atual, sem quebrar registros legados que ainda
 * possam chegar via sync/backup.
 */
export const normalizeStatus = (status) => {
  if (OS_STATUS_LIST.includes(status)) return status;
  if (status === 'Pronto Avisar Cliente.') return OS_STATUS.PRONTO;
  return OS_STATUS.ANALISE; // default e destino dos demais status legados
};
