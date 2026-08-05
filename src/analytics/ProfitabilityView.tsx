// Panel de Rentabilidad: el analisis de negocio, separado del Panel de
// Analiticas (que es el tablero operativo del dia a dia).
//
// Los calculos viven en profitability.ts; aqui solo se presentan.

import { useMemo, useState } from 'react';
import type {
  Product, Rental, RentalItem, RentalPayment,
  MaintenanceExpense, MaintenanceRecord, RentalBikeAssignment,
  Sale, FinancingPayment, AppAccount, AppAccountEarning, AppPlatform,
} from '../db';
import type { FiscalDocument } from '../invoicing/types';
import {
  computeBikeProfits, summarize, computeLossStats, computeSalesCadence,
  computeOccupancy, computeRevenueMix, computeInvoiceStatus, computeFleetAge,
  computeDepositStats, computeModelStats, computeDeliveryAccounts,
  computeRentalLifecycle,
  type BikeProfit, type SegmentStats,
} from './profitability';
import { formatMoney } from '../invoicing/money';

interface Props {
  language: 'es' | 'en';
  products: Product[];
  bikeCategoryId: string;
  rentals: Rental[];
  rentalItems: RentalItem[];
  payments: RentalPayment[];
  expenses: MaintenanceExpense[];
  records: MaintenanceRecord[];
  assignments: RentalBikeAssignment[];
  sales: Sale[];
  financingPayments: FinancingPayment[];
  documents: FiscalDocument[];
  appAccounts: AppAccount[];
  accountEarnings: AppAccountEarning[];
  platforms: AppPlatform[];
}

const CARD: React.CSSProperties = { padding: '18px' };
const GRID2 = 'repeat(auto-fit, minmax(320px, 1fr))';

function Metric({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'neutral';
}) {
  const color = tone === 'good' ? '#34d399' : tone === 'bad' ? '#f87171' : 'var(--text-bright)';
  return (
    <div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>{text}</p>;
}

export function ProfitabilityView(props: Props) {
  const {
    language, products, bikeCategoryId, rentals, rentalItems, payments,
    expenses, records, assignments, sales, financingPayments, documents,
    appAccounts, accountEarnings, platforms,
  } = props;
  const es = language === 'es';
  const [showAllBikes, setShowAllBikes] = useState(false);

  const bikeRows = useMemo(
    () => computeBikeProfits({ products, bikeCategoryId, rentals, rentalItems, payments, expenses, records, assignments }),
    [products, bikeCategoryId, rentals, rentalItems, payments, expenses, records, assignments],
  );

  const occ = useMemo(
    () => computeOccupancy({ products, bikeCategoryId, rentals, rentalItems, assignments }),
    [products, bikeCategoryId, rentals, rentalItems, assignments],
  );
  const mix = useMemo(
    () => computeRevenueMix({ payments, rentals, sales, financingPayments, accountEarnings }),
    [payments, rentals, sales, financingPayments, accountEarnings],
  );
  const inv = useMemo(() => computeInvoiceStatus({ documents }), [documents]);
  const age = useMemo(() => computeFleetAge({ products, bikeCategoryId }), [products, bikeCategoryId]);
  const dep = useMemo(() => computeDepositStats({ rentals }), [rentals]);
  const byModel = useMemo(() => computeModelStats(bikeRows), [bikeRows]);
  const delivery = useMemo(
    () => computeDeliveryAccounts({ accounts: appAccounts, earnings: accountEarnings, platforms }),
    [appAccounts, accountEarnings, platforms],
  );
  const life = useMemo(() => computeRentalLifecycle({ rentals, payments }), [rentals, payments]);
  const loss = useMemo(() => computeLossStats({ products, bikeCategoryId }), [products, bikeCategoryId]);
  const cadence = useMemo(
    () => computeSalesCadence({ products, excludeCategoryId: bikeCategoryId }),
    [products, bikeCategoryId],
  );

  const seg = useMemo(() => {
    const by = (s: BikeProfit['segment']) => summarize(bikeRows.filter(r => r.segment === s));
    return {
      conDeposito: by('activa_con_deposito'),
      sinDeposito: by('activa_sin_deposito'),
      inactivas: by('inactiva'),
      vendidas: by('vendida'),
      perdidas: by('perdida'),
      todas: summarize(bikeRows),
    };
  }, [bikeRows]);

  const rented = useMemo(() => bikeRows.filter(r => r.daysOnRent > 0), [bikeRows]);
  const rentedStats = useMemo(() => summarize(rented), [rented]);

  const fmtWeeks = (w: number | null) => (w === null ? '—' : es ? `${w.toFixed(1)} sem` : `${w.toFixed(1)} wk`);
  const fmtDays = (d: number | null) => {
    if (d === null) return '—';
    if (d < 60) return es ? `${d} días` : `${d} days`;
    const m = Math.round((d / 30.44) * 10) / 10;
    return es ? `${m} meses` : `${m} months`;
  };

  const visibleBikes = showAllBikes ? bikeRows : bikeRows.slice(0, 12);

  const segRow = (label: string, s: SegmentStats, tone?: string) => (
    <tr key={label}>
      <td style={{ fontWeight: 600, color: tone }}>{label}</td>
      <td>{s.count}</td>
      <td>{formatMoney(s.invested)}</td>
      <td>{formatMoney(s.rentalIncome)}</td>
      <td>{formatMoney(s.depositRetained)}</td>
      <td>{formatMoney(s.maintenanceCost)}</td>
      <td style={{ fontWeight: 700, color: s.profit >= 0 ? '#34d399' : '#f87171' }}>{formatMoney(s.profit)}</td>
      <td style={{ color: s.avgRoi >= 0 ? '#34d399' : '#f87171' }}>{s.avgRoi}%</td>
      <td>{formatMoney(s.avgPerWeek)}</td>
      <td>{fmtWeeks(s.avgPaybackWeeks)}</td>
    </tr>
  );

  const mixRows: { label: string; value: number; color: string }[] = [
    { label: es ? 'Alquiler' : 'Rental', value: mix.rental, color: '#34d399' },
    { label: es ? 'Venta contado' : 'Cash sales', value: mix.saleCash, color: '#60a5fa' },
    { label: es ? 'Financiación' : 'Financing', value: mix.financing, color: '#a78bfa' },
    { label: es ? 'Depósitos retenidos' : 'Deposits retained', value: mix.depositRetained, color: '#fbbf24' },
    { label: es ? 'Cuentas de reparto' : 'Delivery accounts', value: mix.deliveryApps, color: '#f472b6' },
  ].sort((a, b) => b.value - a.value);

  return (
    <>
      {/* ---------- KPIs DE FLOTA ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="glass-card" style={CARD}>
          <Metric
            label={es ? 'Ocupación de flota' : 'Fleet occupancy'}
            value={`${occ.occupancyPct}%`}
            tone={occ.occupancyPct >= 80 ? 'good' : occ.occupancyPct >= 60 ? 'neutral' : 'bad'}
            hint={es ? `${occ.rented} alquiladas de ${occ.usable} utilizables` : `${occ.rented} of ${occ.usable} usable`}
          />
        </div>
        <div className="glass-card" style={CARD}>
          <Metric
            label={es ? 'Ingreso semanal comprometido' : 'Weekly run-rate'}
            value={formatMoney(occ.runRatePerWeek)}
            tone="good"
            hint={es ? 'suma de tarifas de alquileres abiertos' : 'sum of open rental rates'}
          />
        </div>
        <div className="glass-card" style={CARD}>
          <Metric
            label={es ? 'Lucro cesante' : 'Idle cost'}
            value={formatMoney(occ.idleCostPerWeek)}
            tone={occ.idle > 0 ? 'bad' : 'good'}
            hint={es ? `${occ.idle} bicis paradas · por semana` : `${occ.idle} idle bikes · per week`}
          />
        </div>
        <div className="glass-card" style={CARD}>
          <Metric
            label={es ? 'Nunca alquiladas' : 'Never rented'}
            value={`${occ.neverRented}`}
            tone={occ.neverRented > 0 ? 'bad' : 'good'}
            hint={es ? 'compradas y jamás usadas' : 'bought and never used'}
          />
        </div>
      </div>

      {/* ---------- 1. INGRESO POR ALQUILER COMPLETO ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>💵 {es ? 'Cuánto deja un alquiler completo' : 'Revenue per full rental'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {es
            ? 'De principio a fin, por alquiler entero (no por semana). "Facturado" es tarifa × duración; "cobrado" es lo que realmente se registró.'
            : 'Start to finish, per whole rental (not per week). "Billed" is rate × duration; "collected" is what was actually recorded.'}
        </p>

        {life.closedCount === 0 ? (
          <Empty text={es
            ? 'Todavía no hay alquileres terminados con duración real, así que aún no se puede calcular el ciclo completo.'
            : 'No finished rentals with real duration yet, so the full cycle cannot be computed.'} />
        ) : (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: '10px' }}>
              {es ? `TERMINADOS · ${life.closedCount} alquileres` : `FINISHED · ${life.closedCount} rentals`}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '18px' }}>
              <Metric
                label={es ? 'Facturado por alquiler' : 'Billed per rental'}
                value={formatMoney(life.avgBilledClosed)}
                tone="neutral"
                hint={es ? 'tarifa × duración, promedio' : 'rate × duration, average'}
              />
              <Metric
                label={es ? 'Cobrado por alquiler' : 'Collected per rental'}
                value={formatMoney(life.avgCollectedClosed)}
                tone={life.avgCollectedClosed >= life.avgBilledClosed ? 'good' : 'bad'}
                hint={es ? 'realmente registrado, promedio' : 'actually recorded, average'}
              />
              <Metric
                label={es ? 'Duración media' : 'Average duration'}
                value={`${life.avgWeeksClosed} ${es ? 'sem' : 'wk'}`}
              />
              <Metric
                label={es ? 'Depósito retenido' : 'Deposit kept'}
                value={formatMoney(life.avgDepositKeptClosed)}
                hint={es ? 'aparte de la renta' : 'on top of rent'}
              />
            </div>

            {life.avgBilledClosed > life.avgCollectedClosed && (
              <div style={{ marginTop: '14px', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px' }}>
                ⚠️ {es
                  ? `Se cobró ${formatMoney(life.avgBilledClosed - life.avgCollectedClosed)} menos por alquiler de lo que se debió facturar (${formatMoney(life.totalBilledClosed - life.totalCollectedClosed)} en total sobre los terminados).`
                  : `${formatMoney(life.avgBilledClosed - life.avgCollectedClosed)} less collected per rental than billed (${formatMoney(life.totalBilledClosed - life.totalCollectedClosed)} across finished rentals).`}
              </div>
            )}
          </>
        )}

        {life.openCount > 0 && (
          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: '10px' }}>
              {es ? `EN CURSO · ${life.openCount} alquileres (acumulado hasta hoy)` : `IN PROGRESS · ${life.openCount} rentals (so far)`}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '18px' }}>
              <Metric label={es ? 'Facturado por alquiler' : 'Billed per rental'} value={formatMoney(life.avgBilledOpen)} />
              <Metric
                label={es ? 'Cobrado por alquiler' : 'Collected per rental'}
                value={formatMoney(life.avgCollectedOpen)}
                tone={life.avgCollectedOpen >= life.avgBilledOpen ? 'good' : 'bad'}
              />
              <Metric label={es ? 'Llevan alquilados' : 'Running for'} value={`${life.avgWeeksOpen} ${es ? 'sem' : 'wk'}`} />
            </div>
          </div>
        )}

        {life.skippedZeroLength > 0 && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
            {es
              ? `${life.skippedZeroLength} alquiler(es) terminados duran cero días (pruebas o cancelaciones) y no entran en el promedio.`
              : `${life.skippedZeroLength} finished rental(s) last zero days (tests or cancellations) and are excluded from the average.`}
          </p>
        )}
      </div>

      {/* ---------- 2. RENTABILIDAD MEDIA DEL ALQUILER (ritmo) ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>🚲 {es ? 'Rentabilidad media del alquiler' : 'Average rental profitability'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {es
            ? `Sobre las ${rented.length} bicis que han estado alquiladas alguna vez. Las que nunca se alquilaron no entran para no ensuciar el promedio.`
            : `Across the ${rented.length} bikes rented at least once. Never-rented bikes are excluded so they don't skew the average.`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '18px' }}>
          <Metric label={es ? 'Ingreso por semana alquilada' : 'Income per rented week'} value={formatMoney(rentedStats.avgPerWeek)} hint={es ? 'promedio por bici' : 'average per bike'} />
          <Metric label={es ? 'Recuperar la compra' : 'Payback period'} value={fmtWeeks(rentedStats.avgPaybackWeeks)} hint={es ? 'semanas alquilada' : 'weeks on rent'} />
          <Metric label={es ? 'Tiempo alquilada' : 'Time on rent'} value={`${rentedStats.avgWeeksOnRent} ${es ? 'sem' : 'wk'}`} hint={es ? 'promedio por bici' : 'average per bike'} />
          <Metric label="ROI" value={`${rentedStats.avgRoi}%`} tone={rentedStats.avgRoi >= 0 ? 'good' : 'bad'} hint={es ? 'promedio' : 'average'} />
          <Metric label={es ? 'Resultado neto' : 'Net result'} value={formatMoney(rentedStats.profit)} tone={rentedStats.profit >= 0 ? 'good' : 'bad'} hint={es ? 'compra y taller descontados' : 'purchase and repairs deducted'} />
        </div>
      </div>

      {/* ---------- 2. MIX DE INGRESOS ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>🧭 {es ? 'De dónde viene el dinero' : 'Where the money comes from'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {es
            ? 'Vista de caja: de una venta financiada solo cuenta la entrada y las cuotas ya pagadas, no el total de la venta.'
            : 'Cash view: for financed sales only the down payment and paid installments count, not the full sale.'}
        </p>
        {mix.total <= 0 ? (
          <Empty text={es ? 'Sin ingresos registrados.' : 'No revenue recorded.'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mixRows.map(m => {
              const pct = mix.total > 0 ? (m.value / mix.total) * 100 : 0;
              return (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '150px', fontSize: '12px', fontWeight: 600 }}>{m.label}</span>
                  <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(pct, 0)}%`, background: m.color, borderRadius: '4px' }} />
                  </div>
                  <span style={{ width: '96px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{formatMoney(m.value)}</span>
                  <span style={{ width: '48px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
                </div>
              );
            })}
            <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
              <span>{es ? 'Total cobrado' : 'Total collected'}</span>
              <span>{formatMoney(mix.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ---------- 3. SEGMENTOS ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>📊 {es ? 'Rentabilidad por segmento' : 'Profitability by segment'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {es
            ? 'Activas = con alquiler abierto hoy. El depósito se cuenta como ganancia solo cuando el alquiler se cerró y no se devolvió.'
            : 'Active = currently on an open rental. Deposits count as profit only once the rental closed and they were not refunded.'}
        </p>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{es ? 'Segmento' : 'Segment'}</th>
                <th>{es ? 'Bicis' : 'Bikes'}</th>
                <th>{es ? 'Invertido' : 'Invested'}</th>
                <th>{es ? 'Alquiler' : 'Rental'}</th>
                <th>{es ? 'Depósito' : 'Deposit'}</th>
                <th>{es ? 'Taller' : 'Repairs'}</th>
                <th>{es ? 'Resultado' : 'Result'}</th>
                <th>ROI</th>
                <th>{es ? '€/semana' : '€/week'}</th>
                <th>Payback</th>
              </tr>
            </thead>
            <tbody>
              {segRow(es ? '🔒 Activas con depósito' : '🔒 Active with deposit', seg.conDeposito, '#34d399')}
              {segRow(es ? '🔓 Activas sin depósito' : '🔓 Active without deposit', seg.sinDeposito, '#fbbf24')}
              {segRow(es ? '💤 Inactivas' : '💤 Idle', seg.inactivas, '#94a3b8')}
              {seg.vendidas.count > 0 && segRow(es ? '💰 Vendidas' : '💰 Sold', seg.vendidas, '#60a5fa')}
              {seg.perdidas.count > 0 && segRow(es ? '🚨 Perdidas/robadas' : '🚨 Lost/stolen', seg.perdidas, '#f87171')}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- 4. RENTABILIDAD POR MODELO ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>🏷️ {es ? 'Rentabilidad por modelo' : 'Profitability by model'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {es ? 'Qué modelo conviene volver a comprar y cuál no.' : 'Which model is worth buying again, and which is not.'}
        </p>
        {byModel.length === 0 ? (
          <Empty text={es ? 'Sin bicis en la flota.' : 'No bikes in the fleet.'} />
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>{es ? 'Modelo' : 'Model'}</th>
                  <th>{es ? 'Unidades' : 'Units'}</th>
                  <th>{es ? 'Activas' : 'Active'}</th>
                  <th>{es ? 'Vendidas' : 'Sold'}</th>
                  <th>{es ? 'Invertido' : 'Invested'}</th>
                  <th>{es ? 'Alquiler' : 'Rental'}</th>
                  <th>{es ? 'Venta' : 'Sale'}</th>
                  <th>{es ? 'Resultado' : 'Result'}</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map(m => (
                  <tr key={m.model}>
                    <td style={{ fontWeight: 600 }}>{m.model}</td>
                    <td>{m.units}</td>
                    <td>{m.unitsActive}</td>
                    <td>{m.unitsSold}</td>
                    <td>{formatMoney(m.invested)}</td>
                    <td>{formatMoney(m.rentalIncome)}</td>
                    <td>{formatMoney(m.soldValue)}</td>
                    <td style={{ fontWeight: 700, color: m.profit >= 0 ? '#34d399' : '#f87171' }}>{formatMoney(m.profit)}</td>
                    <td style={{ color: m.roi >= 0 ? '#34d399' : '#f87171' }}>{m.roi}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: GRID2, gap: '20px', marginBottom: '20px' }}>
        {/* ---------- 5. EFECTIVIDAD DEL DEPOSITO ---------- */}
        <div className="glass-card" style={CARD}>
          <h3 style={{ marginBottom: '4px' }}>🏦 {es ? 'Efectividad del depósito' : 'Deposit effectiveness'}</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            {es
              ? 'Lo que está en garantía es un pasivo, no ganancia: solo pasa a ingreso lo que no se devuelve al cerrar.'
              : 'Money held is a liability, not profit: it only becomes income when it is not refunded at closing.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
            <Metric label={es ? 'En garantía ahora' : 'Held now'} value={formatMoney(dep.heldNow)} hint={es ? 'pasivo, no ingreso' : 'liability'} />
            <Metric label={es ? 'Depósito medio' : 'Average deposit'} value={formatMoney(dep.avgDeposit)} hint={es ? `${dep.withDeposit} con · ${dep.withoutDeposit} sin` : `${dep.withDeposit} with · ${dep.withoutDeposit} without`} />
            <Metric label={es ? 'Retenido' : 'Retained'} value={formatMoney(dep.retained)} tone={dep.retained > 0 ? 'good' : 'neutral'} hint={es ? `${dep.retainedPct}% de los cerrados` : `${dep.retainedPct}% of closed`} />
            <Metric label={es ? 'Devuelto' : 'Refunded'} value={formatMoney(dep.refunded)} hint={es ? `${dep.closedCount} alquileres cerrados` : `${dep.closedCount} closed rentals`} />
          </div>
          {dep.closedCount === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
              {es
                ? 'Todavía no se cerró ningún alquiler con devolución de depósito, así que aún no se puede medir si el depósito cubre los daños.'
                : 'No rental has closed with a deposit settlement yet, so deposit-vs-damage cannot be measured.'}
            </p>
          )}
          {dep.openWithoutDeposit > 0 && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px' }}>
              ⚠️ {es
                ? `${dep.openWithoutDeposit} alquiler(es) abiertos sin depósito — exposición de ${formatMoney(dep.exposure)}/semana.`
                : `${dep.openWithoutDeposit} open rental(s) without deposit — ${formatMoney(dep.exposure)}/week at risk.`}
            </div>
          )}
        </div>

        {/* ---------- 6. FACTURAS EMITIDAS VS COBRADAS ---------- */}
        <div className="glass-card" style={CARD}>
          <h3 style={{ marginBottom: '14px' }}>🧾 {es ? 'Facturas emitidas vs cobradas' : 'Invoices issued vs collected'}</h3>
          {inv.issuedCount === 0 ? (
            <Empty text={es ? 'Todavía no hay facturas emitidas.' : 'No invoices issued yet.'} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
                <Metric label={es ? 'Emitido' : 'Issued'} value={formatMoney(inv.issuedTotal)} hint={`${inv.issuedCount} ${es ? 'facturas' : 'invoices'}`} />
                <Metric label={es ? 'Cobrado' : 'Collected'} value={formatMoney(inv.paidTotal)} tone="good" hint={`${inv.paidCount} · ${inv.collectedPct}%`} />
                <Metric label={es ? 'Pendiente' : 'Outstanding'} value={formatMoney(inv.pendingTotal)} tone={inv.pendingTotal > 0 ? 'bad' : 'good'} hint={`${inv.pendingCount} ${es ? 'facturas' : 'invoices'}`} />
              </div>
              <div style={{ marginTop: '14px', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${inv.collectedPct}%`, background: '#34d399', borderRadius: '4px' }} />
              </div>
              {inv.overdueCount > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px' }}>
                  ⚠️ {es
                    ? `${inv.overdueCount} factura(s) llevan más de 7 días sin cobrar: ${formatMoney(inv.overdueTotal)}.`
                    : `${inv.overdueCount} invoice(s) unpaid for over 7 days: ${formatMoney(inv.overdueTotal)}.`}
                </div>
              )}
            </>
          )}
        </div>

        {/* ---------- 7. ANTIGUEDAD DE FLOTA ---------- */}
        <div className="glass-card" style={CARD}>
          <h3 style={{ marginBottom: '14px' }}>📅 {es ? 'Antigüedad de la flota' : 'Fleet age'}</h3>
          {age.count === 0 ? (
            <Empty text={es ? 'Sin bicis en flota.' : 'No bikes in fleet.'} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                <Metric label={es ? 'Edad media' : 'Average age'} value={fmtDays(age.avgDays)} hint={`${age.count} ${es ? 'bicis' : 'bikes'}`} />
                <Metric label={es ? 'La más antigua' : 'Oldest'} value={fmtDays(age.oldestDays)} />
                <Metric label={es ? 'La más nueva' : 'Newest'} value={fmtDays(age.newestDays)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {age.buckets.map(b => {
                  const pct = age.count > 0 ? (b.count / age.count) * 100 : 0;
                  return (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <span style={{ width: '90px' }}>{b.label}</span>
                      <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))', borderRadius: '3px' }} />
                      </div>
                      <span style={{ width: '28px', textAlign: 'right', fontWeight: 700 }}>{b.count}</span>
                      <span style={{ width: '80px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatMoney(b.value)}</span>
                    </div>
                  );
                })}
              </div>
              {age.unknown > 0 && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
                  {es ? `${age.unknown} sin fecha de compra: no entran en la edad media.` : `${age.unknown} without purchase date: excluded from the average.`}
                </p>
              )}
            </>
          )}
        </div>

        {/* ---------- 8. PERDIDAS Y ROBOS ---------- */}
        <div className="glass-card" style={CARD}>
          <h3 style={{ marginBottom: '14px' }}>🚨 {es ? 'Pérdidas y robos' : 'Losses and theft'}</h3>
          {loss.totalLost === 0 ? (
            <Empty text={es
              ? `Sin pérdidas ni robos en ${fmtDays(loss.observationDays)} de operación. El ritmo empieza a medirse con el primer caso.`
              : `No losses or thefts over ${fmtDays(loss.observationDays)} of operation. Rate tracking starts with the first case.`} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '18px' }}>
              <Metric label={es ? 'Se pierde una cada' : 'One lost every'} value={fmtDays(loss.daysPerLoss)} tone="bad" />
              <Metric label={es ? 'Total perdidas' : 'Total lost'} value={`${loss.totalLost}`} hint={`${loss.lossRatePct}% ${es ? 'de la flota' : 'of fleet'}`} />
              <Metric label={es ? 'Valor perdido' : 'Value lost'} value={formatMoney(loss.lostValue)} tone="bad" />
              <Metric label={es ? 'Desde la última' : 'Since last one'} value={fmtDays(loss.daysSinceLastLoss)} />
            </div>
          )}
        </div>
      </div>

      {/* ---------- 9. CUENTAS DE REPARTO ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>🛵 {es ? 'Rentabilidad de cuentas de reparto' : 'Delivery account profitability'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {es
            ? 'Ingreso interno de la casa: estos cobros no se facturan, solo se contabilizan.'
            : 'Internal income: these collections are not invoiced, only accounted for.'}
        </p>
        {delivery.length === 0 ? (
          <Empty text={es ? 'No hay cuentas de reparto registradas.' : 'No delivery accounts registered.'} />
        ) : (
          <>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{es ? 'Cuenta' : 'Account'}</th>
                    <th>{es ? 'Plataforma' : 'Platform'}</th>
                    <th>{es ? 'Estado' : 'Status'}</th>
                    <th>{es ? 'Asignada' : 'Assigned'}</th>
                    <th>{es ? 'Tarifa sem.' : 'Weekly rate'}</th>
                    <th>{es ? 'Cobrado' : 'Collected'}</th>
                    <th>{es ? 'Cobros' : 'Payments'}</th>
                    <th>{es ? '€/semana' : '€/week'}</th>
                    <th>{es ? 'Último cobro' : 'Last payment'}</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.map(d => (
                    <tr key={d.accountId}>
                      <td style={{ fontWeight: 600 }}>{d.label}</td>
                      <td>{d.platform}</td>
                      <td style={{ fontSize: '11px', color: d.active ? '#34d399' : 'var(--text-muted)' }}>
                        {d.active ? (es ? 'Activa' : 'Active') : (es ? 'Inactiva' : 'Inactive')}
                      </td>
                      <td style={{ fontSize: '11px', color: d.assigned ? '#34d399' : '#fbbf24' }}>
                        {d.assigned ? (es ? 'Sí' : 'Yes') : (es ? 'Libre' : 'Free')}
                      </td>
                      <td>{formatMoney(d.weeklyRate)}</td>
                      <td style={{ fontWeight: 700, color: d.earnings > 0 ? '#34d399' : 'var(--text-muted)' }}>{formatMoney(d.earnings)}</td>
                      <td>{d.earningCount}</td>
                      <td>{d.perWeek > 0 ? formatMoney(d.perWeek) : '—'}</td>
                      <td style={{ fontSize: '12px' }}>{d.lastEarning ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {delivery.every(d => d.earningCount === 0) && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
                {es
                  ? 'Hay cuentas registradas pero ningún cobro cargado todavía, así que la rentabilidad aún no se puede calcular. Se llenará sola al registrar los cobros desde Cuentas de Reparto.'
                  : 'Accounts exist but no earnings have been logged yet, so profitability cannot be computed. It will fill in as earnings are recorded.'}
              </p>
            )}
          </>
        )}
      </div>

      {/* ---------- 10. CADENCIA DE VENTA ---------- */}
      <div className="glass-card" style={{ ...CARD, marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>🛒 {es ? 'Cada cuánto se vende cada producto' : 'How often each product sells'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {es
            ? 'Los más lentos arriba: ahí es donde hay margen de mejora. "Cada" es la media de días entre ventas consecutivas.'
            : 'Slowest first — that is where there is room to improve. "Every" is the mean gap between consecutive sales.'}
        </p>
        {cadence.length === 0 ? (
          <Empty text={es ? 'Aún no hay ventas registradas.' : 'No sales recorded yet.'} />
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>{es ? 'Producto' : 'Product'}</th>
                  <th>{es ? 'Vendidos' : 'Units sold'}</th>
                  <th>{es ? 'Se vende cada' : 'Sells every'}</th>
                  <th>{es ? 'Última venta hace' : 'Last sale'}</th>
                  <th>{es ? 'Precio medio' : 'Avg price'}</th>
                  <th>{es ? 'Facturado' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody>
                {cadence.map(c => (
                  <tr key={c.key}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.unitsSold}</td>
                    <td style={{ color: c.avgDaysBetweenSales === null ? 'var(--text-muted)' : undefined }}>
                      {c.avgDaysBetweenSales === null ? (es ? 'venta única' : 'single sale') : fmtDays(c.avgDaysBetweenSales)}
                    </td>
                    <td style={{ color: c.daysSinceLastSale > 90 ? '#f87171' : undefined }}>{fmtDays(c.daysSinceLastSale)}</td>
                    <td>{formatMoney(c.avgPrice)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- 11. DETALLE POR BICI ---------- */}
      <div className="glass-card" style={CARD}>
        <h3 style={{ marginBottom: '14px' }}>🔍 {es ? 'Detalle por bici' : 'Bike by bike'}</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{es ? 'Código' : 'Code'}</th>
                <th>{es ? 'Modelo' : 'Model'}</th>
                <th>{es ? 'Estado' : 'Segment'}</th>
                <th>{es ? 'Compra' : 'Cost'}</th>
                <th>{es ? 'Alquiler' : 'Rental'}</th>
                <th>{es ? 'Depósito' : 'Deposit'}</th>
                <th>{es ? 'Taller' : 'Repairs'}</th>
                <th>{es ? 'Resultado' : 'Result'}</th>
                <th>ROI</th>
                <th>{es ? '€/semana' : '€/week'}</th>
                <th>Payback</th>
              </tr>
            </thead>
            <tbody>
              {visibleBikes.map(b => (
                <tr key={b.productId}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{b.serial}</span></td>
                  <td style={{ fontSize: '12px' }}>{b.name}</td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {b.segment === 'activa_con_deposito' ? (es ? '🔒 Con depósito' : '🔒 With deposit')
                      : b.segment === 'activa_sin_deposito' ? (es ? '🔓 Sin depósito' : '🔓 No deposit')
                      : b.segment === 'inactiva' ? (es ? '💤 Inactiva' : '💤 Idle')
                      : b.segment === 'vendida' ? (es ? '💰 Vendida' : '💰 Sold')
                      : (es ? '🚨 Perdida' : '🚨 Lost')}
                  </td>
                  <td>{formatMoney(b.cost)}</td>
                  <td>{formatMoney(b.rentalIncome)}</td>
                  <td>{formatMoney(b.depositRetained)}</td>
                  <td>{formatMoney(b.maintenanceCost)}</td>
                  <td style={{ fontWeight: 700, color: b.profit >= 0 ? '#34d399' : '#f87171' }}>{formatMoney(b.profit)}</td>
                  <td style={{ color: b.roi >= 0 ? '#34d399' : '#f87171' }}>{b.roi}%</td>
                  <td>{formatMoney(b.perWeek)}</td>
                  <td>{fmtWeeks(b.paybackWeeks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bikeRows.length > 12 && (
          <button className="btn-secondary btn-xs" style={{ marginTop: '12px' }} onClick={() => setShowAllBikes(v => !v)}>
            {showAllBikes
              ? (es ? '▲ Ver menos' : '▲ Show less')
              : (es ? `▼ Ver las ${bikeRows.length} bicis` : `▼ Show all ${bikeRows.length} bikes`)}
          </button>
        )}
      </div>
    </>
  );
}
