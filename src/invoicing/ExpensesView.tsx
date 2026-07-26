// Compras y gastos (apartado 10). Todo el dinero que sale de la cuenta en
// un solo sitio: compras de stock, mantenimiento y gastos generales.
//
// Es presentacional: recibe la lista unificada desde App (que la calcula
// de las MISMAS fuentes que el Balance Financiero, para que los totales de
// las dos pantallas coincidan). Solo los gastos manuales se pueden crear y
// borrar desde aqui; stock y mantenimiento se gestionan en sus pantallas.

import { useMemo, useState } from 'react';
import { addVat, formatMoney, noVat, round2 } from './money';
import { formatDate as fmtDate } from '../utils/date';
import type { UnifiedExpenseRow } from './types';

const ORIGIN_LABELS: Record<string, { es: string; en: string; color: string }> = {
  manual:      { es: 'Gasto', en: 'Expense', color: '#3b82f6' },
  stock:       { es: 'Compra de stock', en: 'Stock purchase', color: '#8b5cf6' },
  maintenance: { es: 'Mantenimiento', en: 'Maintenance', color: '#14b8a6' },
};

type TimeRange = 'all' | 'day' | 'week' | 'month' | 'year' | 'custom';

// Devuelve [desde, hasta] en 'YYYY-MM-DD' para el rango elegido, o null si
// es "todo el tiempo". Misma logica de periodos que el Balance, para que
// los dos coincidan cuando se filtra por la misma fecha.
function rangeBounds(range: TimeRange, customFrom: string, customTo: string): [string, string] | null {
  if (range === 'all') return null;
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (range === 'custom') return [customFrom || '0000-01-01', customTo || '9999-12-31'];
  let start = new Date(today);
  if (range === 'day') start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  else if (range === 'week') { const day = today.getDay() || 7; start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1); }
  else if (range === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (range === 'year') start = new Date(today.getFullYear(), 0, 1);
  return [iso(start), iso(today)];
}

export interface NewManualExpense {
  date: string;
  categoryId: string;
  description: string;
  amount: number;
  hasVat: boolean;
  invoiceRef: string;
}

interface Props {
  language: 'es' | 'en';
  showToast: (msg: string, type?: 'success' | 'error') => void;
  expenses: UnifiedExpenseRow[];
  categories: { id: string; name: string; color: string }[];
  onAddExpense: (data: NewManualExpense) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export function ExpensesView({ language, showToast, expenses, categories, onAddExpense, onDeleteExpense }: Props) {
  const es = language === 'es';
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'manual' | 'stock' | 'maintenance'>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fCategory, setFCategory] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fHasVat, setFHasVat] = useState(false);
  const [fInvoiceRef, setFInvoiceRef] = useState('');

  const visible = useMemo(() => {
    const bounds = rangeBounds(timeRange, customFrom, customTo);
    return expenses.filter(e => {
      if (filter !== 'all' && e.origin !== filter) return false;
      if (bounds && e.date) {
        const d = e.date.slice(0, 10);
        if (d < bounds[0] || d > bounds[1]) return false;
      }
      return true;
    });
  }, [expenses, filter, timeRange, customFrom, customTo]);

  const total = useMemo(
    () => round2(visible.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)),
    [visible],
  );

  // Vista previa del desglose. En compras el VAT se suma encima del coste,
  // no se saca del total (convencion opuesta a las ventas).
  const preview = useMemo(() => {
    const n = parseFloat(fAmount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return fHasVat ? addVat(n) : noVat(n);
  }, [fAmount, fHasVat]);

  const submit = async () => {
    const n = parseFloat(fAmount);
    if (!Number.isFinite(n) || n <= 0) {
      showToast(es ? 'Indica un importe válido.' : 'Enter a valid amount.', 'error');
      return;
    }
    try {
      setSaving(true);
      await onAddExpense({
        date: fDate,
        categoryId: fCategory,
        description: fDesc,
        amount: n,
        hasVat: fHasVat,
        invoiceRef: fInvoiceRef,
      });
      setFDesc(''); setFAmount(''); setFInvoiceRef(''); setFHasVat(false);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="filter-row" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? (es ? '✕ Cerrar' : '✕ Close') : (es ? '➕ Nuevo gasto' : '➕ New expense')}
          </button>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'manual', 'stock', 'maintenance'] as const).map(k => (
              <button
                key={k}
                className={filter === k ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
                onClick={() => setFilter(k)}
              >
                {k === 'all' ? (es ? 'Todos' : 'All') : (es ? ORIGIN_LABELS[k].es : ORIGIN_LABELS[k].en)}
              </button>
            ))}
          </div>
          <select
            className="form-control"
            style={{ width: 'auto', fontSize: '13px' }}
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as TimeRange)}
          >
            <option value="all">{es ? 'Todo el tiempo' : 'All time'}</option>
            <option value="day">{es ? 'Hoy' : 'Today'}</option>
            <option value="week">{es ? 'Esta semana' : 'This week'}</option>
            <option value="month">{es ? 'Este mes' : 'This month'}</option>
            <option value="year">{es ? 'Este año' : 'This year'}</option>
            <option value="custom">{es ? 'Personalizado...' : 'Custom...'}</option>
          </select>
          {timeRange === 'custom' && (
            <>
              <input type="date" className="form-control" style={{ width: 'auto', fontSize: '13px', colorScheme: 'dark' }}
                value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span style={{ color: 'var(--text-muted)' }}>–</span>
              <input type="date" className="form-control" style={{ width: 'auto', fontSize: '13px', colorScheme: 'dark' }}
                value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
        </div>
        <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
          {es ? 'Total' : 'Total'}:{' '}
          <strong style={{ color: 'var(--text-bright)' }}>{formatMoney(total)}</strong>
        </div>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">{es ? 'Fecha' : 'Date'}</label>
              <input type="date" className="form-control" value={fDate} onChange={e => setFDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{es ? 'Categoría' : 'Category'}</label>
              <select className="form-control" value={fCategory} onChange={e => setFCategory(e.target.value)}>
                <option value="">{es ? '(sin categoría)' : '(no category)'}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{es ? 'Importe pagado (€)' : 'Amount paid (€)'}</label>
              <input type="number" step="0.01" className="form-control" value={fAmount}
                onChange={e => setFAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">{es ? 'Ref. factura proveedor' : 'Supplier invoice ref.'}</label>
              <input className="form-control" value={fInvoiceRef} onChange={e => setFInvoiceRef(e.target.value)}
                placeholder={es ? 'Opcional' : 'Optional'} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label">{es ? 'Descripción' : 'Description'}</label>
            <input className="form-control" value={fDesc} onChange={e => setFDesc(e.target.value)}
              placeholder={es ? 'Ej: alquiler local julio' : 'E.g. July shop rent'} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer', fontSize: '13px' }}>
            <input type="checkbox" checked={fHasVat} onChange={e => setFHasVat(e.target.checked)}
              style={{ width: '16px', height: '16px' }} />
            {es ? 'El importe lleva VAT (23%) por encima' : 'Amount has VAT (23%) added on top'}
          </label>
          {preview && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <span>{es ? 'Base' : 'Net'}: {formatMoney(preview.net_amount)}</span>
              <span>VAT: {formatMoney(preview.vat_amount)}</span>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{es ? 'Total' : 'Total'}: {formatMoney(preview.amount)}</span>
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <button className="btn-primary" disabled={saving} onClick={submit}>
              {saving ? (es ? 'Guardando...' : 'Saving...') : (es ? 'Guardar gasto' : 'Save expense')}
            </button>
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{es ? 'Fecha' : 'Date'}</th>
                <th>{es ? 'Descripción' : 'Description'}</th>
                <th>{es ? 'Categoría' : 'Category'}</th>
                <th>{es ? 'Origen' : 'Source'}</th>
                <th style={{ textAlign: 'right' }}>{es ? 'Total' : 'Total'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  {es ? 'No hay gastos.' : 'No expenses.'}
                </td></tr>
              ) : visible.map(exp => {
                const o = ORIGIN_LABELS[exp.origin];
                return (
                  <tr key={exp.id}>
                    <td style={{ fontSize: '13px' }}>{fmtDate(exp.date)}</td>
                    <td style={{ fontSize: '13px' }}>{exp.description || '—'}</td>
                    <td style={{ fontSize: '13px' }}>{exp.categoryName || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: `${o.color}22`, color: o.color, fontSize: '11px' }}>
                        {es ? o.es : o.en}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(exp.amount)}</td>
                    <td>
                      {exp.origin === 'manual' && (
                        <button className="btn-secondary btn-xs" onClick={async () => {
                          if (window.confirm(es ? '¿Eliminar este gasto?' : 'Delete this expense?')) {
                            await onDeleteExpense(exp.id);
                          }
                        }}>🗑️</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
