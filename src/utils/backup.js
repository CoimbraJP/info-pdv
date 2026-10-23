/**
 * Backup em arquivo JSON.
 *
 * Importante: a sincronização com o Atlas NÃO é backup — uma exclusão (ou
 * import errado) se propaga para a nuvem e para os outros terminais. O backup
 * em arquivo é a única cópia imune a isso. Além do botão manual em
 * Configurações, o app baixa automaticamente um backup por dia (ver
 * GlobalState). Guarde esses arquivos fora do computador do caixa
 * (Drive/pendrive).
 */

export const buildBackupPayload = ({ products, osList, sales, settings, etiquetas = [], storeId = 'infocentro' }) => ({
  app: 'INFO CENTRO',
  store: storeId,
  version: 1,
  exportedAt: new Date().toISOString(),
  data: { products, serviceOrders: osList, sales, settings, etiquetas },
});

export const downloadBackup = (payload, { auto = false } = {}) => {
  const prefix = payload?.store && payload.store !== 'infocentro' ? payload.store : 'infocentro';
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${prefix}-backup-${stamp}${auto ? '-auto' : ''}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
