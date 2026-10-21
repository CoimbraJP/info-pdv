import React, { useState, useMemo } from 'react';
import { Receipt, Printer, Calendar, TrendingUp, ChevronRight } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { formatCurrency, formatDateTime, formatDate, parseDate } from '../utils/formatters';
import './OS.css';

const paymentLabel = (method) => ({ cartao: 'Cartão / PIX', dinheiro: 'Dinheiro' }[method] || method);
const paymentBadge = (method) => method === 'cartao' ? 'badge-info' : 'badge-success';

const vendaStyles = `
.venda-row-expand {
  background-color: var(--bg-color);
  animation: fadeIn 0.18s ease-out;
}
.venda-items-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.venda-items-table th {
  padding: var(--s-2) var(--s-4);
  text-align: left;
  color: var(--text-dim);
  font-size: 0.68rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-color);
}
.venda-items-table td {
  padding: var(--s-2) var(--s-4);
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-main);
}
.venda-items-table tr:last-child td { border-bottom: none; }
.venda-row-click { cursor: pointer; }
.venda-row-click.expanded > td { background-color: var(--surface-hover); }
.chevron-icon { transition: transform var(--t-fast); }
.chevron-icon.open { transform: rotate(90deg); }
`;

const PERIOD_OPTIONS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d',   label: '7 dias' },
  { id: '30d',  label: '30 dias' },
];

const Vendas = () => {
  const { sales, settings, isAdmin } = useGlobalState();
  const [selectedSale, setSelectedSale] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [period, setPeriod] = useState('hoje');
  const [customDate, setCustomDate] = useState(''); // 'YYYY-MM-DD' — dia específico

  // Intervalo [start, end) do período selecionado + derivações (memoizado:
  // com histórico grande, refazer filter+sort a cada render sai caro)
  const { filteredSales, periodLabel, totalPeriod, totalItens } = useMemo(() => {
    const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
    let start, end;
    if (customDate) {
      start = dayStart(customDate + 'T12:00:00');
      end = start + 86400000;
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
      end = Infinity; // períodos relativos não têm limite superior
      start = dayStart(new Date()) - (days - 1) * 86400000;
    }

    const filtered = sales
      .filter(s => {
        const t = parseDate(s.date)?.getTime() ?? NaN;
        return t >= start && t < end;
      })
      .sort((a, b) => (parseDate(b.date)?.getTime() ?? 0) - (parseDate(a.date)?.getTime() ?? 0));

    return {
      filteredSales: filtered,
      periodLabel: customDate
        ? formatDate(customDate + 'T12:00:00')
        : PERIOD_OPTIONS.find(p => p.id === period)?.label || 'Hoje',
      totalPeriod: filtered.reduce((acc, s) => acc + s.total, 0),
      totalItens: filtered.reduce((acc, s) => acc + (s.items?.length || 0), 0),
    };
  }, [sales, period, customDate]);

  const handleReprint = (e, sale) => {
    e.stopPropagation();
    setSelectedSale(sale);
    setTimeout(() => {
      window.print();
      setTimeout(() => setSelectedSale(null), 500);
    }, 150);
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="os-container">
      <style>{vendaStyles}</style>

      {/* ── Cabeçalho: uma linha ── */}
      <div className="module-header">
        <h2 className="module-title">
          <Receipt size={20} className="text-primary" />
          Vendas
        </h2>

        <div className="toolbar-right">
          <div className="seg-control" role="group" aria-label="Período">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`seg-item ${period === opt.id && !customDate ? 'is-active' : ''}`}
                onClick={() => { setPeriod(opt.id); setCustomDate(''); }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            className="input"
            style={{ height: '38px', width: '150px', fontSize: '0.85rem' }}
            value={customDate}
            onChange={e => setCustomDate(e.target.value)}
            title="Ver vendas de um dia específico"
          />

          {/* Faturamento do período: só ADM. O vendedor usa esta tela para reimprimir recibos. */}
          {isAdmin && (
          <div className="stat-chip">
            <TrendingUp size={15} className="text-success" />
            <div>
              <span className="stat-chip-label">Faturamento</span>
              <span className="stat-chip-value text-success">{formatCurrency(totalPeriod)}</span>
            </div>
          </div>
          )}
          <div className="stat-chip">
            <Calendar size={15} className="text-muted" />
            <div>
              <span className="stat-chip-label">{periodLabel}</span>
              <span className="stat-chip-value">{filteredSales.length} venda{filteredSales.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="module-body">
        <p className="result-count">
          {filteredSales.length} {filteredSales.length === 1 ? 'venda' : 'vendas'} · {totalItens} {totalItens === 1 ? 'item' : 'itens'}
          {isAdmin && ` · total ${formatCurrency(totalPeriod)}`}
          {filteredSales.length > 0 && ' · clique numa linha para ver os itens'}
        </p>

        {filteredSales.length === 0 ? (
          <div className="empty-state">
            <Receipt size={38} className="text-dim" />
            <p className="empty-state-title">Nenhuma venda no período ({periodLabel})</p>
            <p className="empty-state-sub">As vendas do PDV aparecem aqui automaticamente</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Data / Hora</th>
                  <th>Nº</th>
                  <th>Itens</th>
                  <th>Pagamento</th>
                  <th className="text-right">Total</th>
                  <th className="text-right" style={{ width: '90px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(sale => {
                  const isExpanded = expandedId === sale.id;
                  return (
                    <React.Fragment key={sale.id}>
                      <tr
                        className={`venda-row-click ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => toggleExpand(sale.id)}
                      >
                        <td>
                          <ChevronRight size={15} className={`chevron-icon ${isExpanded ? 'open text-primary' : 'text-dim'}`} />
                        </td>
                        <td className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatDateTime(sale.date)}
                        </td>
                        <td className="text-dim" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          #{String(sale.id).slice(-6)}
                        </td>
                        <td>
                          <span className="badge badge-primary">{sale.items?.length || 0}</span>
                        </td>
                        <td>
                          <span className={`badge ${paymentBadge(sale.paymentMethod)}`}>
                            {paymentLabel(sale.paymentMethod)}
                          </span>
                        </td>
                        <td className="text-right font-bold text-primary">{formatCurrency(sale.total)}</td>
                        <td className="text-right">
                          <button
                            className="icon-outline"
                            onClick={e => handleReprint(e, sale)}
                            title="Reimprimir recibo"
                          >
                            <Printer size={15} />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="venda-row-expand">
                          <td colSpan="7" style={{ padding: 0 }}>
                            <div style={{ padding: 'var(--s-3) var(--s-6) var(--s-4)' }}>
                              <table className="venda-items-table">
                                <thead>
                                  <tr>
                                    <th>Produto / Serviço</th>
                                    <th className="text-center" style={{ width: '60px' }}>Qtd</th>
                                    <th className="text-right" style={{ width: '120px' }}>Unit.</th>
                                    <th className="text-right" style={{ width: '120px' }}>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(sale.items || []).map((item, i) => (
                                    <tr key={i}>
                                      <td>{item.name}</td>
                                      <td className="text-center">{item.quantity}</td>
                                      <td className="text-right text-muted">{formatCurrency(item.price)}</td>
                                      <td className="text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="flex justify-end gap-6 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                {sale.paymentMethod === 'dinheiro' && sale.amountReceived && (
                                  <>
                                    <span className="text-muted text-sm">
                                      Recebido: <strong>{formatCurrency(sale.amountReceived)}</strong>
                                    </span>
                                    <span className="text-success text-sm">
                                      Troco: <strong>{formatCurrency(sale.amountReceived - sale.total)}</strong>
                                    </span>
                                  </>
                                )}
                                <span className="text-sm">
                                  Total: <strong className="text-primary">{formatCurrency(sale.total)}</strong>
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hidden Print Layout ── */}
      {selectedSale && (
        <div className="print-only">
          <div className="print-header">
            <span className="print-logo">INFO CENTRO</span>
            <p>{settings?.storeAddress || 'SJC — São Paulo'}</p>
            <p>Tel: {settings?.storePhone || '(12) 99999-9999'}</p>
            <p>--------------------------------</p>
            <p style={{ fontWeight: 'bold' }}>RECIBO Nº #{String(selectedSale.id).slice(-6)}</p>
            <p>{formatDateTime(selectedSale.date)}</p>
            <p>--------------------------------</p>
          </div>

          <div className="print-section">
            <div className="print-row" style={{ fontWeight: 'bold' }}>
              <span>ITEM</span>
              <span>TOTAL</span>
            </div>
            {selectedSale.items?.map((item, i) => (
              <div key={i} style={{ marginBottom: '1mm' }}>
                <div style={{ fontWeight: '500' }}>{item.name}</div>
                <div className="print-row" style={{ color: '#333' }}>
                  <span>{item.quantity}x {formatCurrency(item.price)}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="print-section" style={{ borderTop: '1px dashed #000', paddingTop: '2mm' }}>
            <div className="print-row" style={{ fontWeight: 'bold', fontSize: '10.5pt' }}>
              <span>TOTAL</span>
              <span>{formatCurrency(selectedSale.total)}</span>
            </div>
            <div className="print-row">
              <span>Pagamento</span>
              <span>{paymentLabel(selectedSale.paymentMethod)}</span>
            </div>
            {selectedSale.paymentMethod === 'dinheiro' && selectedSale.amountReceived && (
              <>
                <div className="print-row">
                  <span>Recebido</span>
                  <span>{formatCurrency(selectedSale.amountReceived)}</span>
                </div>
                <div className="print-row">
                  <span>Troco</span>
                  <span>{formatCurrency(selectedSale.amountReceived - selectedSale.total)}</span>
                </div>
              </>
            )}
          </div>

          <div className="print-footer">
            <p>Obrigado pela preferência!</p>
            <p>infocentro.com.br</p>
            <p style={{ marginTop: '2mm', fontSize: '7pt' }}>* Documento sem valor fiscal *</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendas;
