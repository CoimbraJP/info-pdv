/**
 * Fonte única dos status de OS.
 * A auditoria apontou que os status eram strings soltas repetidas em 4 arquivos —
 * agora qualquer tela/relatório importa daqui.
 */
export const OS_STATUS = {
  ANALISE: 'Em análise',
  MARCONDES: 'Marcondes',
  ENCERRADO: 'Encerrado',
};

export const OS_STATUS_LIST = [
  OS_STATUS.ANALISE,
  OS_STATUS.MARCONDES,
  OS_STATUS.ENCERRADO,
];

/**
 * Converte status antigos ("Aguardando Aprovação / Peças", "Pronto Avisar
 * Cliente.") para o conjunto atual, sem quebrar registros legados que ainda
 * possam chegar via sync/backup.
 */
export const normalizeStatus = (status) => {
  if (OS_STATUS_LIST.includes(status)) return status;
  if (status === 'Encerrado') return OS_STATUS.ENCERRADO;
  return OS_STATUS.ANALISE; // default e destino dos status legados
};
