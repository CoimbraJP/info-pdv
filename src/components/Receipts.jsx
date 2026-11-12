import { useGlobalState } from '../context/GlobalState';
import { storeBrand } from '../constants/stores';
import { osTermsLines } from '../constants/osTerms';
import { paymentLabel } from '../constants/payment';
import { formatCurrency } from '../utils/formatters';
import { DEFAULT_SALE_TEMPLATE, DEFAULT_OS_TEMPLATE } from '../constants/receiptTemplates';

/*
 * Cupons da Elgin i8 (bobina 80 mm, área útil 72 mm).
 *
 * Modelos selecionáveis em Configurações (cada loja escolhe o seu):
 *   Venda: B1 a B5 (padrão B4)  ·  OS: 1 a 5, sempre em duas vias + condições (padrão 4)
 * Cada loja sai com os próprios dados; loja sem logo usa o nome em moldura.
 *
 * `preview`: desenha na tela (miniaturas de Configurações) em vez de só na impressão.
 */

const pad = (n) => String(n).padStart(2, '0');
const dateTime = (iso) => {
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Cabeçalho. `withLogo`: logo + nome (ou nome em moldura se a loja não tem logo). */
export const PrintHeader = ({ os = false, override, withLogo = true }) => {
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
  if (!withLogo) return <div className="rc-c">{inner}</div>;
  return b.logo
    ? <div className="rc-c"><img src={b.logo} alt="" className="rc-logo" />{inner}</div>
    : <div className="rc-c rc-hbox">{inner}</div>;
};

const rootClass = (preview) => (preview ? 'rcpt rc-preview' : 'print-only rcpt');

/** "Cartão crédito" / "Cartão débito" / "PIX" / "Dinheiro". */
const payLine = (sale) => {
  if (sale.paymentMethod === 'cartao' && sale.cardType) return sale.cardType === 'debito' ? 'Cartão débito' : 'Cartão crédito';
  return paymentLabel(sale.paymentMethod);
};

/* ───────────────────────────── VENDA ───────────────────────────── */

const SaleItems = ({ items, template }) => {
  if (template === 'B5') {
    return items.map((it, i) => (
      <div key={i} className="rc-it">
        <div className="rc-row"><span className="rc-b rc-up">{it.name}</span><span className="rc-b">{formatCurrency(it.price * it.quantity)}</span></div>
        <div className="rc-xs">{it.quantity} un × {formatCurrency(it.price)}</div>
      </div>
    ));
  }
  return items.map((it, i) => (
    <div key={i}>
      {template === 'B3' && i > 0 && <div className="rc-dotsep" />}
      <div className={template === 'B3' ? 'rc-it3' : 'rc-it'}>
        <div className="rc-b rc-up">{it.name}</div>
        <div className="rc-row rc-s">
          <span>{it.quantity} un × {formatCurrency(it.price)}</span>
          <span className="rc-b">{formatCurrency(it.price * it.quantity)}</span>
        </div>
      </div>
    </div>
  ));
};

/** Cupom de venda. `sale`: { id, date, items, subtotal, discount, total, paymentMethod, cardType, installments } */
export const SaleReceipt = ({ sale, override, template, preview = false }) => {
  const { store, settings } = useGlobalState();
  const t = template || settings?.saleTemplate || DEFAULT_SALE_TEMPLATE;
  const { site } = storeBrand(store, { ...settings, ...override });
  const items = sale.items || [];
  const subtotal = sale.subtotal ?? items.reduce((a, it) => a + it.price * it.quantity, 0);
  const discount = sale.discount || 0;
  const n = sale.installments || 1;
  const units = items.reduce((a, it) => a + (it.quantity || 0), 0);
  return (
    <div className={rootClass(preview)}>
      <PrintHeader override={override} withLogo={t === 'B4'} />
      <div className="rc-line" />
      <div className="rc-row rc-s">
        <span>Venda <b>#{String(sale.id || '').slice(-6).toUpperCase()}</b></span>
        <span>{dateTime(sale.date)}</span>
      </div>
      <div className="rc-row rc-b rc-colh"><span>Descrição</span><span>Total</span></div>
      <SaleItems items={items} template={t} />
      <div className="rc-line" />
      {t === 'B3' && <div className="rc-xs">{items.length} {items.length === 1 ? 'item' : 'itens'} · {units} {units === 1 ? 'unidade' : 'unidades'}</div>}
      {discount > 0 && (
        <>
          <div className="rc-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="rc-row"><span>Desconto</span><span>- {formatCurrency(discount)}</span></div>
        </>
      )}
      <div className={`rc-row rc-tot ${t === 'B2' ? 'rc-inv' : ''}`}><span>TOTAL A PAGAR</span><span>{formatCurrency(sale.total)}</span></div>
      {t !== 'B2' && <div className="rc-line" />}
      <div className="rc-row"><span>Forma de pagamento</span><span>{payLine(sale)}</span></div>
      {n > 1 && <div className="rc-row"><span>Parcelamento</span><span>{n}x de {formatCurrency(sale.total / n)}</span></div>}
      <div className="rc-line" />
      <div className="rc-c rc-thanks">Obrigado pela preferência!</div>
      {site && <div className="rc-c rc-xs">{site}</div>}
      <div className="rc-c rc-xs">Documento sem valor fiscal</div>
    </div>
  );
};

/* ─────────────────────────────── OS ─────────────────────────────── */

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

const KV = ({ label, value }) => (value ? <div className="rc-row rc-kv"><span>{label}</span><span>{value}</span></div> : null);
const Field = ({ label, value }) => (value ? <div className="rc-fld"><i>{label}</i>{value}</div> : null);

/** Corpo da OS conforme o modelo escolhido. */
const OSBody = ({ os, template }) => {
  const { model, sn } = deviceParts(os);
  const addr = addressText(os.clientAddress);
  const d = { cpf: os.clientCPF, nome: os.client, tel: os.clientPhone, addr, model, senha: os.devicePassword, sn, acc: os.accessories, defeito: os.defect };

  if (template === '1') {
    const line = (l, v) => (v ? <div>{l}: {v}</div> : null);
    return (
      <>
        <div className="rc-sec">Dados do Cliente:</div>
        {line('CPF', d.cpf)}{line('Nome', d.nome)}{line('Telefone', d.tel)}{line('Endereço', d.addr)}
        <div className="rc-sec">EQUIPAMENTO:</div>
        {line('Marca/Modelo', d.model)}{line('Senha', d.senha)}{line('Defeito reclamado', d.defeito)}{line('Acessórios', d.acc)}{line('Nº de série', d.sn)}
      </>
    );
  }
  if (template === '2') {
    return (
      <>
        <div className="rc-sec">Dados do Cliente</div>
        <div className="rc-g2"><Field label="CPF" value={d.cpf} /><Field label="Telefone" value={d.tel} /></div>
        <Field label="Nome" value={d.nome} /><Field label="Endereço" value={d.addr} />
        <div className="rc-sec">Equipamento</div>
        <Field label="Marca/Modelo" value={d.model} />
        <div className="rc-g2"><Field label="Senha" value={d.senha} /><Field label="Nº de série" value={d.sn} /></div>
        <Field label="Defeito reclamado" value={d.defeito} /><Field label="Acessórios" value={d.acc} />
      </>
    );
  }
  if (template === '3') {
    return (
      <>
        <div className="rc-frame">
          <div className="rc-ftitle">DADOS DO CLIENTE</div>
          <KV label="CPF" value={d.cpf} /><KV label="Nome" value={d.nome} /><KV label="Telefone" value={d.tel} />
          {d.addr && <div className="rc-s">Endereço: {d.addr}</div>}
        </div>
        <div className="rc-frame">
          <div className="rc-ftitle">EQUIPAMENTO</div>
          <KV label="Marca/Modelo" value={d.model} /><KV label="Senha" value={d.senha} /><KV label="Nº de série" value={d.sn} /><KV label="Acessórios" value={d.acc} />
          {d.defeito && <div className="rc-s rc-mt1"><b>Defeito reclamado:</b> {d.defeito}</div>}
        </div>
      </>
    );
  }
  if (template === '5') {
    return (
      <>
        <div className="rc-inv rc-sbar">DADOS DO CLIENTE</div>
        <KV label="CPF" value={d.cpf} /><KV label="Nome" value={d.nome} /><KV label="Telefone" value={d.tel} />
        {d.addr && <div className="rc-s">{d.addr}</div>}
        <div className="rc-inv rc-sbar">EQUIPAMENTO</div>
        <KV label="Marca/Modelo" value={d.model} /><KV label="Senha" value={d.senha} /><KV label="Nº de série" value={d.sn} /><KV label="Acessórios" value={d.acc} />
        {d.defeito && <><div className="rc-b rc-mt1">Defeito reclamado</div><div>{d.defeito}</div></>}
      </>
    );
  }
  // 4 — compacto
  return (
    <div className="rc-cmp">
      <div><b>Cliente:</b> {d.nome}{d.cpf ? ` · CPF ${d.cpf}` : ''}</div>
      {d.tel && <div><b>Tel:</b> {d.tel}</div>}
      {d.addr && <div><b>End.:</b> {d.addr}</div>}
      <div className="rc-dash" />
      <div><b>Equip.:</b> {d.model}</div>
      {(d.senha || d.sn) && (
        <div>
          {d.senha && <><b>Senha:</b> {d.senha}</>}
          {d.senha && d.sn && ' · '}
          {d.sn && <><b>S/N:</b> {d.sn}</>}
        </div>
      )}
      {d.acc && <div><b>Acess.:</b> {d.acc}</div>}
      {d.defeito && <div><b>Defeito:</b> {d.defeito}</div>}
    </div>
  );
};

/** Ordem de serviço — duas vias iguais (cliente primeiro, depois a da loja), com as condições. */
export const OSReceipt = ({ os, template, preview = false, singleVia = false }) => {
  const { settings } = useGlobalState();
  const t = template || settings?.osTemplate || DEFAULT_OS_TEMPLATE;
  const terms = osTermsLines(settings);

  const via = (label, extra) => (
    <>
      <div className="rc-c rc-xs rc-b rc-vlabel">{label}</div>
      <PrintHeader os />
      <div className="rc-inv rc-row rc-osbar"><span>OS Nº {os.id}</span><span className="rc-s">{dateTime(os.date)}</span></div>
      <OSBody os={os} template={t} />
      {terms.length > 0 && <div className="rc-terms">{terms.map((line, i) => <p key={i}>{line}</p>)}</div>}
      {extra}
    </>
  );

  return (
    <div className={rootClass(preview)}>
      {via('VIA DO CLIENTE')}
      {!singleVia && (
        <>
          <div className="rc-cut">✂ - - - - - - - corte aqui - - - - - - - ✂</div>
          {via('VIA DA LOJA', <div className="rc-sig">Assinatura do cliente</div>)}
        </>
      )}
    </div>
  );
};
