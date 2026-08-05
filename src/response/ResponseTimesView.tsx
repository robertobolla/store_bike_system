// Calculador de respuestas: registro de cuanto se tarda en contestarle a
// cada cliente y por que medio, con los promedios para poder decidir.
//
// El tiempo se guarda siempre en minutos. En el formulario se carga en la
// unidad que resulte comoda (minutos, horas o dias) y se convierte al
// guardar: asi se pueden promediar filas cargadas de formas distintas.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResponseLog, ResponseChannel } from '../db';
import { getResponseLogs, upsertResponseLog, deleteResponseLog } from '../db';

interface Props {
  language: 'es' | 'en';
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type Unit = 'min' | 'h' | 'd';

const UNIT_MINUTES: Record<Unit, number> = { min: 1, h: 60, d: 1440 };

const CHANNELS: { key: ResponseChannel; es: string; en: string; icon: string; color: string }[] = [
  { key: 'email', es: 'Email', en: 'Email', icon: '✉️', color: '#60a5fa' },
  { key: 'whatsapp', es: 'WhatsApp', en: 'WhatsApp', icon: '💬', color: '#34d399' },
  { key: 'instagram', es: 'Instagram', en: 'Instagram', icon: '📷', color: '#f472b6' },
  { key: 'otro', es: 'Otro', en: 'Other', icon: '📌', color: '#fbbf24' },
];

/** Minutos a texto legible: 45 min, 3.5 h, 2.1 d. */
function fmtMinutes(min: number, es: boolean): string {
  if (!Number.isFinite(min) || min <= 0) return es ? '0 min' : '0 min';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} ${es ? 'd' : 'd'}`;
}

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

export function ResponseTimesView({ language, showToast }: Props) {
  const es = language === 'es';

  const [rows, setRows] = useState<ResponseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Formulario
  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fChannel, setFChannel] = useState<ResponseChannel>('whatsapp');
  const [fDetail, setFDetail] = useState('');
  const [fTime, setFTime] = useState('');
  const [fUnit, setFUnit] = useState<Unit>('min');
  const [fNotes, setFNotes] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      setRows(await getResponseLogs());
    } catch (e) {
      console.error(e);
      showToast(es ? 'No se pudieron cargar los registros.' : 'Could not load records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [es, showToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setFName(''); setFPhone(''); setFEmail('');
    setFChannel('whatsapp'); setFDetail('');
    setFTime(''); setFUnit('min'); setFNotes('');
    setFDate(new Date().toISOString().slice(0, 10));
  };

  const save = async () => {
    const name = fName.trim();
    const raw = parseFloat(fTime);
    if (!name) {
      showToast(es ? 'Falta el nombre del cliente.' : 'Customer name is required.', 'error');
      return;
    }
    if (!Number.isFinite(raw) || raw < 0) {
      showToast(es ? 'Indica el tiempo de respuesta.' : 'Enter the response time.', 'error');
      return;
    }
    try {
      setSaving(true);
      await upsertResponseLog({
        id: editingId ?? crypto.randomUUID(),
        customer_name: name,
        phone: fPhone.trim(),
        email: fEmail.trim(),
        channel: fChannel,
        channel_detail: fDetail.trim(),
        response_minutes: Math.round(raw * UNIT_MINUTES[fUnit]),
        notes: fNotes.trim(),
        logged_at: fDate || new Date().toISOString().slice(0, 10),
      });
      await load();
      resetForm();
      showToast(es ? 'Registro guardado.' : 'Record saved.', 'success');
    } catch (e) {
      console.error(e);
      showToast(es ? 'No se pudo guardar.' : 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: ResponseLog) => {
    setEditingId(r.id);
    setFName(r.customer_name);
    setFPhone(r.phone);
    setFEmail(r.email);
    setFChannel(r.channel);
    setFDetail(r.channel_detail);
    // Se reabre en la unidad que mejor represente el valor guardado.
    const m = r.response_minutes;
    if (m >= 1440 && m % 1440 === 0) { setFTime(String(m / 1440)); setFUnit('d'); }
    else if (m >= 60 && m % 60 === 0) { setFTime(String(m / 60)); setFUnit('h'); }
    else { setFTime(String(m)); setFUnit('min'); }
    setFNotes(r.notes);
    setFDate(r.logged_at);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (r: ResponseLog) => {
    if (!window.confirm(es ? `¿Eliminar el registro de ${r.customer_name}?` : `Delete the record for ${r.customer_name}?`)) return;
    try {
      setBusyId(r.id);
      await deleteResponseLog(r.id);
      if (editingId === r.id) resetForm();
      await load();
      showToast(es ? 'Registro eliminado.' : 'Record deleted.', 'success');
    } catch (e) {
      console.error(e);
      showToast(es ? 'No se pudo eliminar.' : 'Could not delete.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.customer_name} ${r.phone} ${r.email} ${r.channel} ${r.channel_detail} ${r.notes}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Promedio general y por medio. El promedio se calcula sobre TODAS las
  // filas guardadas, no sobre las que deja ver el buscador: si no, filtrar
  // cambiaria el promedio y daria una lectura falsa.
  const stats = useMemo(() => {
    const n = rows.length;
    if (n === 0) return null;
    const mins = rows.map(r => r.response_minutes);
    const total = mins.reduce((s, m) => s + m, 0);
    const sorted = [...mins].sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

    const byChannel = CHANNELS.map(c => {
      const list = rows.filter(r => r.channel === c.key);
      return {
        ...c,
        count: list.length,
        avg: list.length ? list.reduce((s, r) => s + r.response_minutes, 0) / list.length : 0,
      };
    }).filter(c => c.count > 0).sort((a, b) => a.avg - b.avg);

    return {
      count: n,
      avg: total / n,
      median,
      fastest: sorted[0],
      slowest: sorted[sorted.length - 1],
      byChannel,
    };
  }, [rows]);

  const chan = (key: ResponseChannel) => CHANNELS.find(c => c.key === key) ?? CHANNELS[3];

  return (
    <>
      {/* ---------- FORMULARIO ---------- */}
      <div className="glass-card" style={{ padding: '18px', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '14px' }}>
          {editingId
            ? `✏️ ${es ? 'Editando registro' : 'Editing record'}`
            : `➕ ${es ? 'Nuevo registro de respuesta' : 'New response record'}`}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">{es ? 'Cliente' : 'Customer'}</label>
            <input className="form-control" value={fName} onChange={e => setFName(e.target.value)}
              placeholder={es ? 'Nombre y apellido' : 'Full name'} />
          </div>
          <div className="form-group">
            <label className="form-label">{es ? 'Teléfono' : 'Phone'}</label>
            <input className="form-control" value={fPhone} onChange={e => setFPhone(e.target.value)}
              placeholder="+353 ..." />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={fEmail} onChange={e => setFEmail(e.target.value)}
              placeholder="cliente@email.com" />
          </div>
          <div className="form-group">
            <label className="form-label">{es ? 'Fecha' : 'Date'}</label>
            <input className="form-control" type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: '14px' }}>
          <label className="form-label">{es ? 'Medio de la respuesta' : 'Response channel'}</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            {CHANNELS.map(c => (
              <button
                key={c.key}
                className={fChannel === c.key ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
                onClick={() => setFChannel(c.key)}
              >
                {c.icon} {es ? c.es : c.en}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px' }}>
          <div className="form-group">
            <label className="form-label">
              {fChannel === 'otro'
                ? (es ? 'Especificar medio' : 'Specify channel')
                : (es ? 'Detalle del medio (opcional)' : 'Channel detail (optional)')}
            </label>
            <input className="form-control" value={fDetail} onChange={e => setFDetail(e.target.value)}
              placeholder={fChannel === 'otro'
                ? (es ? 'Ej: llamada, presencial, Telegram...' : 'e.g. call, in person, Telegram...')
                : (es ? 'Ej: grupo, historia, DM...' : 'e.g. group, story, DM...')} />
          </div>
          <div className="form-group">
            <label className="form-label">{es ? 'Tardé en responder' : 'Time to respond'}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="form-control" style={{ flex: 1 }} type="number" min="0" step="1"
                value={fTime} onChange={e => setFTime(e.target.value)} placeholder="0" />
              <select className="form-control" style={{ width: '110px' }} value={fUnit} onChange={e => setFUnit(e.target.value as Unit)}>
                <option value="min">{es ? 'minutos' : 'minutes'}</option>
                <option value="h">{es ? 'horas' : 'hours'}</option>
                <option value="d">{es ? 'días' : 'days'}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{es ? 'Notas (opcional)' : 'Notes (optional)'}</label>
            <input className="form-control" value={fNotes} onChange={e => setFNotes(e.target.value)}
              placeholder={es ? 'Contexto de la consulta...' : 'Context of the enquiry...'} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? (es ? 'Guardando...' : 'Saving...') : editingId ? (es ? '💾 Guardar cambios' : '💾 Save changes') : (es ? '➕ Agregar registro' : '➕ Add record')}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}>{es ? 'Cancelar' : 'Cancel'}</button>
          )}
        </div>
      </div>

      {/* ---------- PROMEDIOS ---------- */}
      <div className="glass-card" style={{ padding: '18px', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '4px' }}>📊 {es ? 'Promedios' : 'Averages'}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {es
            ? 'Calculados sobre todos los registros guardados, sin importar el filtro de búsqueda.'
            : 'Computed over every saved record, regardless of the search filter.'}
        </p>

        {!stats ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            {es ? 'Todavía no hay registros. Agregá el primero arriba.' : 'No records yet. Add the first one above.'}
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '18px' }}>
              <Metric label={es ? 'Promedio general' : 'Overall average'} value={fmtMinutes(stats.avg, es)} hint={`${stats.count} ${es ? 'registros' : 'records'}`} />
              <Metric label={es ? 'Mediana' : 'Median'} value={fmtMinutes(stats.median, es)} hint={es ? 'menos sensible a extremos' : 'less sensitive to outliers'} />
              <Metric label={es ? 'La más rápida' : 'Fastest'} value={fmtMinutes(stats.fastest, es)} tone="good" />
              <Metric label={es ? 'La más lenta' : 'Slowest'} value={fmtMinutes(stats.slowest, es)} tone="bad" />
            </div>

            {stats.byChannel.length > 0 && (
              <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.04em', marginBottom: '12px' }}>
                  {es ? 'PROMEDIO POR MEDIO · más rápido primero' : 'AVERAGE BY CHANNEL · fastest first'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats.byChannel.map(c => {
                    const max = Math.max(...stats.byChannel.map(x => x.avg), 1);
                    return (
                      <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: '120px', fontSize: '12px', fontWeight: 600 }}>{c.icon} {es ? c.es : c.en}</span>
                        <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(c.avg / max) * 100}%`, background: c.color, borderRadius: '4px' }} />
                        </div>
                        <span style={{ width: '80px', textAlign: 'right', fontSize: '12px', fontWeight: 700 }}>{fmtMinutes(c.avg, es)}</span>
                        <span style={{ width: '70px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {c.count} {es ? 'reg.' : 'rec.'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- TABLA ---------- */}
      <div className="glass-card" style={{ padding: '18px' }}>
        <div className="filter-row" style={{ marginBottom: '14px' }}>
          <input
            className="form-control filter-input"
            placeholder={es ? 'Buscar por cliente, teléfono, email o medio...' : 'Search by customer, phone, email or channel...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{es ? 'Fecha' : 'Date'}</th>
                <th>{es ? 'Cliente' : 'Customer'}</th>
                <th>{es ? 'Contacto' : 'Contact'}</th>
                <th>{es ? 'Medio' : 'Channel'}</th>
                <th>{es ? 'Tiempo' : 'Time'}</th>
                <th>{es ? 'Notas' : 'Notes'}</th>
                <th>{es ? 'Acciones' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>{es ? 'Cargando...' : 'Loading...'}</td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {search.trim()
                      ? (es ? 'No hay registros que coincidan.' : 'No matching records.')
                      : (es ? 'Todavía no hay registros.' : 'No records yet.')}
                  </td>
                </tr>
              ) : (
                visible.map(r => {
                  const c = chan(r.channel);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: '12px' }}>{r.logged_at}</td>
                      <td style={{ fontWeight: 600 }}>{r.customer_name}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {r.phone && <div>📞 {r.phone}</div>}
                        {r.email && <div>✉️ {r.email}</div>}
                        {!r.phone && !r.email && '—'}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        <span style={{ color: c.color, fontWeight: 600 }}>{c.icon} {es ? c.es : c.en}</span>
                        {r.channel_detail && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.channel_detail}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{fmtMinutes(r.response_minutes, es)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }} title={r.notes}>
                        {r.notes.length > 40 ? r.notes.slice(0, 40) + '…' : r.notes || '—'}
                      </td>
                      <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="btn-secondary btn-xs" onClick={() => startEdit(r)}>
                          ✏️ {es ? 'Editar' : 'Edit'}
                        </button>
                        <button className="btn-secondary btn-xs" disabled={busyId === r.id} onClick={() => remove(r)}
                          style={{ color: '#f87171' }}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
            {es
              ? `Mostrando ${visible.length} de ${rows.length} registros.`
              : `Showing ${visible.length} of ${rows.length} records.`}
          </p>
        )}
      </div>
    </>
  );
}
