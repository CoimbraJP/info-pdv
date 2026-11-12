import { useGlobalState } from '../context/GlobalState';
import { storeBrand } from '../constants/stores';
import { osTermsLines } from '../constants/osTerms';
import { paymentLabel } from '../constants/payment';
import { formatCurrency } from '../utils/formatters';

/*
 * Cupons da Elgin i8 (bobina 80 mm) — modelos escolhidos:
 *   Venda B4 · OS 4 (compacta, duas vias iguais + condições).
 * Cada loja sai com os próprios dados: com logo (Info Centro) ou com o nome
 * em moldura (loja sem logo, ex.: Eagle Games).
 */

const pad = (n) => String(n).padStart(2, '0');
const dateTime = (iso) => {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Cabeçalho: logo + nome, ou nome em moldura quando a loja não tem logo. */
export const PrintHeader = ({ os = false, override }) => {
  const { store, settings } = useGlobalState();
  const b = storeBrand(store, { ...settings, ...override });
  const slogan = os ? b.osSlogan : b.slogan;
  const inner = (
    <>
      <div className="rc-brand">{b.name.toUpperCase()}</div>
      {slogan && <div className="rc-tag">{slogan}</div>}
      {b.address && <div className="rc-addr">{b.address}</div>}
      {b.phone && <div className="rc-addr">{b.phone}</div>}
    </>
  );
  return b.logo
    ? <div className="rc-c"><img src={b.logo} alt="" className="rc-logo" />{inner}</div>
    : <div className="rc-c rc-hbox">{inner}</div>;
};

/** Forma de pagamento como no modelo: "Cartão crédito" + linha de parcelamento. */
const payLine = (sale) => {
  if (sale.paymentMethod === 'cartao' && sale.cardType) return sale.cardType === 'debito' ? 'Cartão débito' : 'Cartão crédito';
  return paymentLabel(sale.paymentMethod);
};

/** Cupom de venda — modelo B4. `sale`: { id, date, items, subtotal, discount, total, paymentMethod, cardType, installments } */
export const SaleReceipt = ({ sale, override }) => {
  const { store, settings } = useGlobalState();
  const { site } = storeBrand(store, { ...settings, ...override });
  const items = sale.items || [];
  const subtotal = sale.subtotal ?? items.reduce((a, it) => a + it.price * it.quantity, 0);
  const discount = sale.discount || 0;
  const n = sale.installments || 1;
  return (
    <div className="print-only rcpt">
      <PrintHeader override={override} />
      <div className="rc-line" />
      <div className="rc-row rc-s">
        <span>Venda <b>#{String(sale.id || '').slice(-6).toUpperCase()}</b></span>
        <span>{dateTime(sale.date)}</span>
      </div>
      <div className="rc-row rc-b rc-colh"><span>Descrição</span><span>Total</span></div>
      {items.map((it, i) => (
        <div key={i} className="rc-it">
          <div className="rc-b rc-up">{it.name}</div>
          <div className="rc-row rc-s">
            <span>{it.quantity} un × {formatCurrency(it.price)}</span>
            <span className="rc-b">{formatCurrency(it.price * it.quantity)}</span>
          </div>
        </div>
      ))}
      <div className="rc-line" />
      {discount > 0 && (
        <>
          <div className="rc-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="rc-row"><span>Desconto</span><span>- {formatCurrency(discount)}</span></div>
        </>
      )}
      <div className="rc-row rc-tot"><span>TOTAL A PAGAR</span><span>{formatCurrency(sale.total)}</span></div>
      <div className="rc-line" />
      <div className="rc-row"><span>Forma de pagamento</span><span>{payLine(sale)}</span></div>
      {n > 1 && <div className="rc-row"><span>Parcelamento</span><span>{n}x de {formatCurrency(sale.total / n)}</span></div>}
      <div className="rc-line" />
      <div className="rc-c rc-thanks">Obrigado pela preferência!</div>
      {site && <div className="rc-c rc-xs">{site}</div>}
      <div className="rc-c rc-xs">Documento sem valor fiscal</div>
    </div>
  );
};

/* ── OS ── */
const addressText = (addr) => {
  if (!addr || typeof addr === 'string') return addr || '';
  const l1 = [[addr.street, addr.number].filter(Boolean).join(', '), addr.neighborhood].filter(Boolean).join(' - ');
  const l2 = [addr.city, addr.state].filter(Boolean).join('/');
  return [l1, l2].filter(Boolean).join(' — ');
};
const deviceParts = (os) => {
  const full = String(os.deviceFull || os.device || '');
  const m = full.match(/\s*-\s*S\/N:\s*(.*)$/i);
  const sn = (m?.[1] || '').trim();
  return { model: (m ? full.slice(0, m.index) : full).trim(), sn: sn && sn.toLowerCase() !== 'n/a' ? sn : '' };
};

/** Ordem de serviço — modelo 4 (compacta), duas vias iguais: cliente primeiro, depois a da loja. */
export const OSReceipt = ({ os }) => {
  const { settings } = useGlobalState();
  const terms = osTermsLines(settings);
  const { model, sn } = deviceParts(os);
  const addr = addressText(os.clientAddress);

  const via = (label, extra) => (
    <>
      <div className="rc-c rc-xs rc-b rc-vlabel">{label}</div>
      <PrintHeader os />
      <div className="rc-inv rc-row rc-osbar"><span>OS Nº {os.id}</span><span className="rc-s">{dateTime(os.date)}</span></div>
      <div className="rc-cmp">
        <div><b>Cliente:</b> {os.client}{os.clientCPF ? ` · CPF ${os.clientCPF}` : ''}</div>
        {os.clientPhone && <div><b>Tel:</b> {os.clientPhone}</div>}
        {addr && <div><b>End.:</b> {addr}</div>}
        <div className="rc-dash" />
        <div><b>Equip.:</b> {model}</div>
        {(os.devicePassword || sn) && (
          <div>
            {os.devicePassword && <><b>Senha:</b> {os.devicePassword}</>}
            {os.devicePassword && sn && ' · '}
            {sn && <><b>S/N:</b> {sn}</>}
          </div>
        )}
        {os.accessories && <div><b>Acess.:</b> {os.accessories}</div>}
        {os.defect && <div><b>Defeito:</b> {os.defect}</div>}
      </div>
      {terms.length > 0 && <div className="rc-terms">{terms.map((t, i) => <p key={i}>{t}</p>)}</div>}
      {extra}
    </>
  );

  return (
    <div className="print-only rcpt">
      {via('VIA DO CLIENTE')}
      <div className="rc-cut">✂ - - - - - - - corte aqui - - - - - - - ✂</div>
      {via('VIA DA LOJA', <div className="rc-sig">Assinatura do cliente</div>)}
    </div>
  );
};
