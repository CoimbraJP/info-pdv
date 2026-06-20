import React, { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, Package, Wrench, ArrowUpRight, ArrowDownRight,
  Calendar, BarChart2, Receipt, CreditCard, Banknote, ClipboardList,
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { formatCurrency } from '../utils/formatters';
import './Dashboard.css';

const PERIODS = [
  { key: 'hoje',     label: 'Hoje' },
  { key: '30d',      label: '30 Dias' },
  { key: 'semestre', label: 'Semestral' },
  { key: 'anual',    label: 'Anual' },
];

const PERIOD_LABEL = {
  hoje: 'hoje', '30d': 'nos últimos 30 dias',
  semestre: 'no semestre', anual: 'no ano',
};

/* Início do período selecionado (epoch ms) */
function periodStartTs(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'hoje') return d.getTime();
  if (period === '30d') { d.setDate(d.getDate() - 29); return d.getTime(); }
  if (period === 'semestre') { d.setMonth(d.getMonth() - 6); return d.getTime(); }
  if (period === 'anual') { d.setFullYear(d.getFullYear() - 1); return d.getTime(); }
  return 0;
}

/* Buckets para o gráfico de faturamento */
function buildBuckets(period, sales) {
  const now = new Date();
  const buckets = [];

  if (period === 'semestre' || period === 'anual') {
    const months = period === 'semestre' ? 6 : 12;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        start: d.getTime(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
        total: 0,
      });
    }
    sales.forEach((s) => {
      const t = new Date(s.date).getTime();
      const b = buckets.find((b) => t >= b.start && t < b.end);
      if (b) b.total += s.total;
    });
    return buckets;
  }

  const days = period === 'hoje' ? 7 : 30;
  const base = new Date(now); base.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    buckets.push({
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      total: 0,
    });
  }
  const startTs = new Date(base); startTs.setDate(startTs.getDate() - (days - 1));
  const start = startTs.getTime();
  sales.forEach((s) => {
    const sd = new Date(s.date); sd.setHours(0, 0, 0, 0);
    const idx = Math.round((sd.getTime() - start) / 86400000);
    if (idx >= 0 && idx < buckets.length) buckets[idx].total += s.total;
  });
  return buckets;
}

/* Gráfico de barras em SVG (sem dependências) */
const RevenueChart = ({ buckets }) => {
  const hasData = buckets.some((b) => b.total > 0);
  if (!hasData) {
    return (
      <div className="chart-placeholder">
        <BarChart2 size={36} className="text-dim" />
        <span className="text-muted text-sm">Sem vendas no período</span>
      </div>
    );
  }

  const W = 600, H = 200, padX = 8, padTop = 12, padBottom = 26;
  const n = buckets.length;
  const max = Math.max(...buckets.map((b) => b.total));
  const slot = (W - padX * 2) / n;
  const barW = Math.min(slot * 0.62, 36);
  const plotH = H - padTop - padBottom;
  const labelStep = Math.ceil(n / 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" preserveAspectRatio="none" role="img" aria-label="Gráfico de faturamento">
      <line x1={padX} y1={H - padBottom} x2={W - padX} y2={H - padBottom} stroke="var(--border-color)" strokeWidth="1" />
      {buckets.map((b, i) => {
        const h = max > 0 ? (b.total / max) * plotH : 0;
        const x = padX + i * slot + (slot - barW) / 2;
        const y = H - padBottom - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, b.total > 0 ? 2 : 0)} rx="3" fill="var(--primary-color)" opacity="0.9">
              <title>{`${b.label}: ${formatCurrency(b.total)}`}</title>
            </rect>
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={H - padBottom + 16} textAnchor="middle" fontSize="10" fill="var(--text-dim)">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const Dashboard = () => {
  const [period, setPeriod] = useState('30d');
  const { products, osList, sales } = useGlobalState();

  const m = useMemo(() => {
    const start = periodStartTs(period);
    const salesInPeriod = sales.filter((s) => new Date(s.date).getTime() >= start);
    const osInPeriod = osList.filter((o) => new Date(o.date).getTime() >= start);

    const productRevenue = salesInPeriod.reduce((acc, s) => acc + (s.total || 0), 0);
    const numSales = salesInPeriod.length;

    const productProfit = salesInPeriod.reduce((acc, s) => (
      acc + (s.items || []).reduce((a, it) => a + ((it.price || 0) - (it.cost || 0)) * (it.quantity || 0), 0)
    ), 0);

    const serviceRevenue = osInPeriod
      .filter((o) => o.status === 'Encerrado')
      .reduce((acc, o) => acc + (o.serviceValue || o.total || 0), 0);

    const totalRevenue = productRevenue + serviceRevenue;
    const totalProfit = productProfit + serviceRevenue; // serviço = mão de obra (margem cheia)
    const ticket = numSales ? productRevenue / numSales : 0;

    // Pagamentos
    const byCard = salesInPeriod.filter((s) => s.paymentMethod === 'cartao').reduce((a, s) => a + s.total, 0);
    const byCash = salesInPeriod.filter((s) => s.paymentMethod === 'dinheiro').reduce((a, s) => a + s.total, 0);

    // Mais vendidos (por quantidade)
    const map = new Map();
    salesInPeriod.forEach((s) => (s.items || []).forEach((it) => {
      const key = it.name;
      const cur = map.get(key) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.quantity || 0;
      cur.revenue += (it.price || 0) * (it.quantity || 0);
      map.set(key, cur);
    }));
    const topProducts = Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // OS
    const osEmAndamento = osList.filter((o) => o.status === 'Em análise' || o.status === 'Aguardando Aprovação / Peças').length;
    const osProntas = osList.filter((o) => o.status === 'Pronto Avisar Cliente.').length;
    const contasReceber = osList
      .filter((o) => o.status === 'Pronto Avisar Cliente.')
      .reduce((acc, o) => acc + (o.serviceValue || o.total || 0), 0);

    const estoqueCritico = products.filter((p) => p.stock <= 2);

    return {
      productRevenue, serviceRevenue, totalRevenue, totalProfit, productProfit,
      numSales, ticket, byCard, byCash, topProducts,
      osEmAndamento, osProntas, contasReceber, estoqueCritico,
      margin: totalRevenue ? (totalProfit / totalRevenue) * 100 : 0,
      buckets: buildBuckets(period, sales),
    };
  }, [period, products, osList, sales]);

  const payMax = Math.max(1, m.byCard, m.byCash);

  return (
    <div className="dashboard-container">
      <div className="module-header">
        <h2 className="module-title">
          <BarChart2 size={22} className="text-primary" />
          Dashboard Gerencial
        </h2>

        <div className="period-selector">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`period-btn ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="module-body">
        {/* KPI Cards */}
        <div className="kpi-grid mb-6">
          <div className="card kpi-card">
            <div className="kpi-icon bg-primary-light">
              <DollarSign size={22} className="text-primary" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Faturamento {PERIOD_LABEL[period]}</span>
              <h3 className="kpi-value">{formatCurrency(m.totalRevenue)}</h3>
              <div className="kpi-trend positive">
                <ArrowUpRight size={14} />
                <span>{m.numSales} venda{m.numSales !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div className="card kpi-card">
            <div className="kpi-icon bg-success-light">
              <TrendingUp size={22} className="text-success" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Lucro Estimado</span>
              <h3 className="kpi-value">{formatCurrency(m.totalProfit)}</h3>
              <div className="kpi-trend positive">
                <ArrowUpRight size={14} />
                <span>~{m.margin.toFixed(0)}% margem</span>
              </div>
            </div>
          </div>

          <div className="card kpi-card">
            <div className="kpi-icon bg-info-light">
              <Receipt size={22} className="text-info" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Ticket Médio</span>
              <h3 className="kpi-value">{formatCurrency(m.ticket)}</h3>
              <div className="kpi-trend neutral">
                <span>por venda</span>
              </div>
            </div>
          </div>

          <div className="card kpi-card">
            <div className="kpi-icon bg-warning-light">
              <Package size={22} className="text-warning" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Estoque Crítico</span>
              <h3 className="kpi-value">{m.estoqueCritico.length}</h3>
              <div className={`kpi-trend ${m.estoqueCritico.length > 0 ? 'negative' : 'positive'}`}>
                {m.estoqueCritico.length > 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                <span>{m.estoqueCritico.length > 0 ? 'Reposição necessária' : 'Estoque OK'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Linha 1: gráfico + rankings */}
        <div className="dashboard-grid mb-6">
          <div className="card dashboard-section dashboard-chart-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-header mb-0">Faturamento por Período</h3>
              <Calendar size={18} className="text-muted" />
            </div>
            <RevenueChart buckets={m.buckets} />
          </div>

          <div className="card dashboard-section">
            <h3 className="section-header">Mais Vendidos</h3>
            <ul className="ranking-list">
              {m.topProducts.map((p, i) => (
                <li key={p.name} className="ranking-item">
                  <div className="rank">{i + 1}</div>
                  <div className="item-details">
                    <span className="item-name">{p.name}</span>
                    <span className="text-muted text-xs">{p.qty} un</span>
                  </div>
                </li>
              ))}
              {m.topProducts.length === 0 && (
                <li className="ranking-item text-muted text-sm">Sem vendas no período</li>
              )}
            </ul>
          </div>

          <div className="card dashboard-section">
            <h3 className="section-header text-danger">Estoque Crítico</h3>
            <ul className="critical-list">
              {m.estoqueCritico.slice(0, 5).map((p) => (
                <li key={p.id} className="critical-item">
                  <div className="item-details">
                    <span className="item-name">{p.name}</span>
                    <span className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>
                      {p.stock} un
                    </span>
                  </div>
                </li>
              ))}
              {m.estoqueCritico.length === 0 && (
                <li className="critical-item text-muted text-sm border-0">✓ Nenhum item crítico</li>
              )}
            </ul>
          </div>
        </div>

        {/* Linha 2: financeiro + pagamentos + OS */}
        <div className="dashboard-grid">
          <div className="card dashboard-section">
            <h3 className="section-header">Composição do Faturamento</h3>
            <div className="dash-line">
              <span><Package size={15} className="text-primary" /> Produtos</span>
              <strong>{formatCurrency(m.productRevenue)}</strong>
            </div>
            <div className="dash-line">
              <span><Wrench size={15} className="text-info" /> Serviços (OS)</span>
              <strong>{formatCurrency(m.serviceRevenue)}</strong>
            </div>
            <div className="dash-line dash-line-total">
              <span>Total</span>
              <strong className="text-primary">{formatCurrency(m.totalRevenue)}</strong>
            </div>
            <div className="dash-line">
              <span className="text-muted">Lucro estimado</span>
              <strong className="text-success">{formatCurrency(m.totalProfit)}</strong>
            </div>
          </div>

          <div className="card dashboard-section">
            <h3 className="section-header">Formas de Pagamento</h3>
            <div className="pay-row">
              <div className="pay-head">
                <span><CreditCard size={15} className="text-info" /> Cartão / PIX</span>
                <strong>{formatCurrency(m.byCard)}</strong>
              </div>
              <div className="pay-bar"><div className="pay-fill pay-card" style={{ width: `${(m.byCard / payMax) * 100}%` }} /></div>
            </div>
            <div className="pay-row">
              <div className="pay-head">
                <span><Banknote size={15} className="text-success" /> Dinheiro</span>
                <strong>{formatCurrency(m.byCash)}</strong>
              </div>
              <div className="pay-bar"><div className="pay-fill pay-cash" style={{ width: `${(m.byCash / payMax) * 100}%` }} /></div>
            </div>
          </div>

          <div className="card dashboard-section">
            <h3 className="section-header">Ordens de Serviço</h3>
            <div className="dash-line">
              <span><ClipboardList size={15} className="text-warning" /> Em andamento</span>
              <strong>{m.osEmAndamento}</strong>
            </div>
            <div className="dash-line">
              <span><Wrench size={15} className="text-success" /> Prontas p/ avisar</span>
              <strong>{m.osProntas}</strong>
            </div>
            <div className="dash-line dash-line-total">
              <span>Contas a receber</span>
              <strong className="text-primary">{formatCurrency(m.contasReceber)}</strong>
            </div>
          </div>
        </div>

        <p className="text-xs text-dim mt-4">
          * O lucro considera o preço de custo cadastrado nos produtos e o valor de mão de obra das OS encerradas.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
