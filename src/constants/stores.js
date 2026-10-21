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
  },
  {
    id: 'eaglegames',
    name: 'Eagle Games',
    defaultCode: '111',
    master: false,
    localDb: 'infopdv-eaglegames',
    defaultLogo: null,
    defaultSite: '',
  },
];

export const getStore = (id) => STORES.find((s) => s.id === id) || null;

/** Dados de marca usados na barra lateral e nos cupons. */
export const storeBrand = (store, settings) => ({
  name: settings?.storeName || store?.name || '',
  logo: settings?.logoDataUrl || store?.defaultLogo || null,
  site: settings?.storeSite ?? store?.defaultSite ?? '',
  phone: settings?.storePhone || '',
  address: settings?.storeAddress || '',
});
