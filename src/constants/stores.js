/**
 * Lojas do sistema. Mesmo site, mesmo servidor; cada loja com dados próprios
 * (banco no MongoDB + banco local no navegador), logo, nota e senhas.
 *
 * defaultCode só vale enquanto o código não for trocado em
 * Configurações > Senhas do sistema (painel master da Info Centro).
 */
export const STORES = [
  {
    id: 'infocentro',
    name: 'Info Centro',
    defaultCode: '000',
    master: true,
    localDb: 'infocentro',            // banco local que já existia — dados preservados
    defaultLogo: '/logo-square.png',
    defaultSite: 'infocentro.com.br',
    defaultSlogan: 'Assistência Técnica e Vendas',
    defaultOsSlogan: 'Assistência Técnica Especializada',
    defaultAddress: 'Rua Rubião Júnior, 33 — Centro — São José dos Campos - SP',
    defaultPhone: '(12) 98200-7553',
  },
  {
    id: 'eaglegames',
    name: 'Eagle Games',
    defaultCode: '111',
    master: false,
    localDb: 'infopdv-eaglegames',
    defaultLogo: null,               // sem logo: o cupom sai com o nome em moldura
    defaultSite: '',
    defaultSlogan: '',
    defaultOsSlogan: '',
    defaultAddress: 'Rua Rubião Júnior, 33 — Centro — São José dos Campos - SP',
    defaultPhone: '(12) 3942-1409',
  },
];

export const getStore = (id) => STORES.find((s) => s.id === id) || null;

/** Valores de exemplo das primeiras versões — tratados como "não preenchido". */
const PLACEHOLDERS = new Set(['SJC — São Paulo', '(12) 99999-9999']);
const filled = (v) => (v && !PLACEHOLDERS.has(String(v).trim()) ? v : '');

/** Dados de marca usados na barra lateral e nos cupons (o salvo em Configurações ou o padrão da loja). */
export const storeBrand = (store, settings) => ({
  name: settings?.storeName || store?.name || '',
  logo: settings?.logoDataUrl || store?.defaultLogo || null,
  site: settings?.storeSite ?? store?.defaultSite ?? '',
  phone: filled(settings?.storePhone) || store?.defaultPhone || '',
  address: filled(settings?.storeAddress) || store?.defaultAddress || '',
  slogan: settings?.storeSlogan ?? store?.defaultSlogan ?? '',
  osSlogan: settings?.storeOsSlogan ?? store?.defaultOsSlogan ?? settings?.storeSlogan ?? '',
});
