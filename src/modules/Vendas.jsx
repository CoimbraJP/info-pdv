import React, { useState } from 'react';
import { Receipt, Printer, Calendar, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import './OS.css';

const paymentLabel = (method) => ({ cartao: 'Cartão / PIX', dinheiro: 'Dinheiro' }[method] || method);
const paymentBadge = (method) => method === 'cartao' ? 'badge-info' : 'badge-success';

const vendaStyles = `
.venda-row-expand {
  background-color: var(--surface-hover);
  border-bottom: 1px solid var(--border-color);
  animation: fadeIn 0.18s ease-out;
}
.venda-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.venda-items-table th {
  padding: var(--s-2) var(--s-4);
  text-align: left;
  color: var(--text-dim);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-color);
}
.venda-items-table td {
  padding: var(--s-2) var(--s-4);
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-main);
}
.venda-items-table tr:last-child td { border-bottom: none; }
.venda-row-click {
  cursor: pointer;
  transition: background-color var(--t-fast);
}
.venda-row-click:hover td { background-color: rgba(255,255,255,0.025); }
.venda-row-click.expanded td { background-color: var(--primary-subtle); }
.chevron-icon { transition: transform var(--t-fast); }
.chevron-icon.open { transform: rotate(90deg); }
.venda-summary-bar {
  display: flex;
  gap: var(--s-4);
  padding: var(--s-3) var(--s-6);
  background: var(--surface-hover);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.8rem;
  color: var(--text-muted);
}
.venda-summary-bar strong { color: var(--text-main); }
`;

const Vendas = () => {
  const { sales, settings } = useGlobalState();
  const [selectedSale, setSelectedSale] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const today = new Date().toLocaleDateString('pt-BR');
  const todaySales = sales
    .filter(s => new Date(s.date).toLocaleDateString('pt-BR') === today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalToday = todaySales.reduce((acc, s) => acc + s.total, 0);
  const totalItens = todaySales.reduce((acc, s) => acc + (s.items?.length || 0), 0);

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

      <div className="module-header">
        <h2 className="module-title flex items-center gap-2">
          <Receipt size={22} className="text-primary" />
          Histórico de Vendas
        </h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover rounded" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <TrendingUp size={16} className="text-success" />
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Faturamento</div>
              <div className="font-bold text-success">{formatCurrency(totalToday)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover rounded" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <Calendar size={16} className="text-muted" />
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Vendas Hoje</div>
              <div className="font-bold">{todaySales.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="module-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

          {todaySales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
              <Receipt size={44} className="opacity-50" />
              <p className="font-medium">Nenhuma venda registrada hoje</p>
              <p className="text-sm text-dim">As vendas do PDV aparecem aqui automaticamente</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="venda-summary-bar">
                <span>{todaySales.length} venda{todaySales.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{totalItens} iten{totalItens !== 1 ? 's' : ''} vendido{totalItens !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>Total: <strong>{formatCurrency(totalToday)}</strong></span>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                  Clique em uma venda para ver os itens
                </span>
              </div>

              <div className="os-table-container">
                <table className="os-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28px' }}></th>
                      <th>Horário</th>
                      <th>Nº Venda</th>
                      <th>Itens</th>
                      <th>Pagamento</th>
                      <th className="text-right">Total</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySales.map(sale => {
                      const isExpanded = expandedId === sale.id;
                      const timeStr = formatDateTime(sale.date).split(' ')[1] || '--:--';
                      return (
                        <React.Fragment key={sale.id}>
                          {/* ── Main Row ── */}
                          <tr
                            className={`venda-row-click ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleExpand(sale.id)}
                          >
                            <td style={{ paddingLeft: 'var(--s-4)', width: '28px' }}>
                              {isExpanded
                                ? <ChevronDown size={16} className="text-primary chevron-icon open" />
                                : <ChevronRight size={16} className="text-dim chevron-icon" />
                              }
                            </td>
                            <td className="text-muted font-medium" style={{ fontFamily: 'monospace' }}>
                              {timeStr}
                            </td>
                            <td className="font-bold" style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              #{String(sale.id).slice(-6)}
                            </td>
                            <td>
                              <span className="badge badge-primary">
                                {sale.items?.length || 0} iten{(sale.items?.length || 0) !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${paymentBadge(sale.paymentMethod)}`}>
                                {paymentLabel(sale.paymentMethod)}
                              </span>
                            </td>
                            <td className="text-right font-bold text-primary">
                              {formatCurrency(sale.total)}
                            </td>
                            <td className="text-center">
                              <button
                                className="btn btn-surface btn-sm"
                                onClick={e => handleReprint(e, sale)}
                                title="Reimprimir Recibo"
                              >
                                <Printer size={14} />
                                Reimprimir
                              </button>
                            </td>
                          </tr>

                          {/* ── Expanded Items Row ── */}
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

                                  {/* Totals summary */}
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
            </>
          )}
        </div>
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
