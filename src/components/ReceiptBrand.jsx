import { useGlobalState } from '../context/GlobalState';
import { storeBrand } from '../constants/stores';

/**
 * Cabeçalho e rodapé dos cupons/OS impressos com a marca da LOJA ATIVA
 * (logo, nome, slogan, endereço, telefone, site) — cada loja sai com a sua.
 * `override` permite pré-visualizar dados ainda não salvos (Configurações).
 */
export const ReceiptHeader = ({ children, override }) => {
  const { store, settings } = useGlobalState();
  const brand = storeBrand(store, { ...settings, ...override });
  const slogan = override?.storeSlogan ?? settings?.storeSlogan;
  return (
    <div className="print-header">
      {brand.logo && <img src={brand.logo} alt="" className="print-logo-img" />}
      <span className="print-logo">{brand.name.toUpperCase()}</span>
      {slogan && <p>{slogan}</p>}
      {brand.address && <p>{brand.address}</p>}
      {brand.phone && <p>Tel: {brand.phone}</p>}
      {children}
    </div>
  );
};

/** Site da loja (ou nada, se a loja não tiver site). */
export const ReceiptSite = ({ prefix = '' }) => {
  const { store, settings } = useGlobalState();
  const { site } = storeBrand(store, settings);
  return site ? <p>{prefix}{site}</p> : null;
};
