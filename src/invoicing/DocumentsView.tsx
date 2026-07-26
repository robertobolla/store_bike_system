// Listado de documentos fiscales (Facturacion). Es una vista propia que
// carga sus datos, para no engordar el loadData gigante de App.tsx.
//
// Muestra facturas, recibos de deposito, devoluciones, notas de credito y
// recibos de cuota, filtrables por tipo. Desde aqui se genera/reenvia el
// PDF, se abre el archivado y se marca una factura como pagada.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDocuments, getDocumentPdfUrl, generateDocumentPdf, markDocumentPaid,
  issueManualDocument, deleteDocument, sendDocumentCancelledEmail,
} from './api';
import { formatMoney, round2, splitVatInclusive } from './money';
import { formatDate as fmtDate } from '../utils/date';
import type { DocType, FiscalDocument } from './types';

const DOC_LABELS: Record<DocType, { es: string; en: string }> = {
  INV: { es: 'Factura', en: 'Invoice' },
  DEP: { es: 'Recibo de depósito', en: 'Deposit receipt' },
  REF: { es: 'Devolución de depósito', en: 'Deposit refund' },
  CN:  { es: 'Nota de crédito', en: 'Credit note' },
  RCP: { es: 'Recibo de pago', en: 'Payment receipt' },
};

const FILTERS: Array<{ key: 'all' | DocType; es: string; en: string }> = [
  { key: 'all', es: 'Todos', en: 'All' },
  { key: 'INV', es: 'Facturas', en: 'Invoices' },
  { key: 'DEP', es: 'Depósitos', en: 'Deposits' },
  { key: 'REF', es: 'Devoluciones', en: 'Refunds' },
  { key: 'CN',  es: 'Notas de crédito', en: 'Credit notes' },
  { key: 'RCP', es: 'Recibos', en: 'Receipts' },
];

function statusBadge(doc: FiscalDocument, lang: 'es' | 'en') {
  if (doc.doc_type !== 'INV') {
    return <span className="badge status-available">{lang === 'es' ? 'Emitido' : 'Issued'}</span>;
  }
  if (doc.status === 'paid') {
    return <span className="badge status-available">{lang === 'es' ? 'Pagada' : 'Paid'}</span>;
  }
  if (doc.status === 'cancelled') {
    return <span className="badge status-lost">{lang === 'es' ? 'Anulada' : 'Cancelled'}</span>;
  }
  return <span className="badge status-maintenance">{lang === 'es' ? 'Pendiente' : 'Unpaid'}</span>;
}

interface Props {
  language: 'es' | 'en';
  showToast: (msg: string, type?: 'success' | 'error') => void;
  // Codigo visible del alquiler por id, para la columna "Alquiler".
  rentalCodeById: Map<string, string>;
  // Clientes para el selector de la factura manual.
  customers: { id: string; name: string }[];
}

interface ManualLine { description: string; amount: string; }

export function DocumentsView({ language, showToast, rentalCodeById, customers }: Props) {
  const es = language === 'es';
  const [docs, setDocs] = useState<FiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | DocType>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Formulario de documento manual (factura o nota de credito).
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mType, setMType] = useState<'INV' | 'CN'>('INV');
  const [mCustomerId, setMCustomerId] = useState('');
  const [mCustomerName, setMCustomerName] = useState('');
  const [mStatus, setMStatus] = useState<'paid' | 'pending'>('paid');
  const [mLines, setMLines] = useState<ManualLine[]>([{ description: '', amount: '' }]);

  // showLoader: solo en la primera carga se muestra "Cargando..."; en las
  // recargas tras una accion no conviene vaciar la tabla.
  const load = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      setDocs(await getDocuments());
    } catch (e) {
      showToast(language === 'es' ? 'Error al cargar documentos.' : 'Error loading documents.', 'error');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [language, showToast]);

  // La regla set-state-in-effect da un falso positivo aqui: los setState
  // ocurren tras el await, no de forma sincrona. Cargar datos al montar es
  // el uso legitimo de un efecto.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (filter !== 'all' && d.doc_type !== filter) return false;
      if (!q) return true;
      const cust = (d.customer_snapshot as { name?: string })?.name ?? '';
      const rental = d.rental_id ? rentalCodeById.get(d.rental_id) ?? '' : '';
      return `${d.number} ${cust} ${rental}`.toLowerCase().includes(q);
    });
  }, [docs, filter, search, rentalCodeById]);

  const openPdf = async (doc: FiscalDocument) => {
    try {
      setBusyId(doc.id);
      let path = doc.pdf_url;
      if (!path) {
        // Aun sin PDF: se genera ahora, sin enviar email.
        const res = await generateDocumentPdf(doc.id, false);
        path = res.pdf_url;
        await load();
      }
      if (path) window.open(await getDocumentPdfUrl(path), '_blank');
    } catch (e) {
      showToast(language === 'es' ? 'No se pudo abrir el PDF.' : 'Could not open the PDF.', 'error');
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const sendToCustomer = async (doc: FiscalDocument) => {
    const cust = (doc.customer_snapshot as { email?: string })?.email;
    if (!cust) {
      showToast(language === 'es' ? 'El cliente no tiene email.' : 'Customer has no email.', 'error');
      return;
    }
    const ok = window.confirm(
      language === 'es'
        ? `¿Enviar ${doc.number} a ${cust} y a facturación?`
        : `Send ${doc.number} to ${cust} and accounting?`,
    );
    if (!ok) return;
    try {
      setBusyId(doc.id);
      const res = await generateDocumentPdf(doc.id, true);
      await load();
      showToast(
        res.emailed
          ? (language === 'es' ? `${doc.number} enviado.` : `${doc.number} sent.`)
          : (language === 'es' ? 'PDF generado, pero no se envió el email.' : 'PDF generated, email not sent.'),
        res.emailed ? 'success' : 'error',
      );
    } catch (e) {
      showToast(language === 'es' ? 'No se pudo enviar.' : 'Could not send.', 'error');
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (doc: FiscalDocument) => {
    try {
      setBusyId(doc.id);
      await markDocumentPaid(doc.id, doc.payment_method || 'transferencia', new Date().toISOString().slice(0, 10));
      // Se regenera el PDF (ya con el sello de pagada) y se reenvia por
      // email: el cliente tiene que recibir la actualizacion cuando se
      // confirma su pago (apartado 8). Si el envio falla, la factura ya
      // quedo marcada como pagada; se avisa aparte y se puede reintentar
      // con "Enviar".
      let emailed = false;
      try {
        const res = await generateDocumentPdf(doc.id, true);
        emailed = res.emailed;
      } catch (pdfErr) {
        console.error('No se pudo reenviar la factura pagada:', pdfErr);
      }
      await load();
      showToast(
        emailed
          ? (language === 'es' ? 'Factura marcada como pagada y actualización enviada.' : 'Invoice marked as paid and update sent.')
          : (language === 'es' ? 'Factura marcada como pagada, pero no se pudo enviar la actualización.' : 'Invoice marked as paid, but the update could not be sent.'),
        emailed ? 'success' : 'error',
      );
    } catch (e) {
      showToast(language === 'es' ? 'No se pudo actualizar.' : 'Could not update.', 'error');
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const removeDoc = async (doc: FiscalDocument) => {
    const ok = window.confirm(
      es
        ? `¿Eliminar ${doc.number}? Se enviará un aviso de cancelación al cliente. Si es el último número emitido, el próximo lo reutilizará.`
        : `Delete ${doc.number}? A cancellation notice will be emailed to the customer. If it is the last issued number, the next one will reuse it.`,
    );
    if (!ok) return;
    try {
      setBusyId(doc.id);
      // Aviso de cancelacion ANTES de borrar (despues ya no hay datos).
      const emailed = await sendDocumentCancelledEmail(doc);
      await deleteDocument(doc.id, doc.pdf_url);
      await load();
      showToast(
        emailed
          ? (es ? `${doc.number} eliminado y aviso enviado.` : `${doc.number} deleted, notice sent.`)
          : (es ? `${doc.number} eliminado (sin email: cliente sin correo).` : `${doc.number} deleted (no email on file).`),
        'success',
      );
    } catch (e) {
      showToast(es ? 'No se pudo eliminar.' : 'Could not delete.', 'error');
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const setLine = (i: number, patch: Partial<ManualLine>) =>
    setMLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const manualTotal = round2(mLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0));
  const manualBreakdown = manualTotal > 0 ? splitVatInclusive(manualTotal) : null;

  const resetManual = () => {
    setMType('INV'); setMCustomerId(''); setMCustomerName('');
    setMStatus('paid'); setMLines([{ description: '', amount: '' }]);
  };

  const createManual = async () => {
    const lines = mLines
      .map(l => ({ description: l.description.trim(), amount: parseFloat(l.amount) || 0 }))
      .filter(l => l.description && l.amount > 0);
    if (lines.length === 0) {
      showToast(es ? 'Agrega al menos un concepto con importe.' : 'Add at least one line with an amount.', 'error');
      return;
    }
    try {
      setCreating(true);
      const custName = mCustomerId ? (customers.find(c => c.id === mCustomerId)?.name ?? '') : mCustomerName.trim();
      const doc = await issueManualDocument({
        docType: mType,
        customerId: mCustomerId || null,
        customerName: custName || undefined,
        lines,
        issueDate: new Date().toISOString().slice(0, 10),
        status: mStatus,
      });
      // Genera el PDF de una vez; el envio se hace luego con el boton Enviar.
      await generateDocumentPdf(doc.id, false);
      await load();
      resetManual();
      setShowForm(false);
      showToast(
        (mType === 'CN' ? (es ? 'Nota de crédito emitida: ' : 'Credit note issued: ') : (es ? 'Factura emitida: ' : 'Invoice issued: ')) + doc.number,
        'success',
      );
    } catch (e) {
      showToast(es ? 'No se pudo emitir el documento.' : 'Could not issue the document.', 'error');
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="filter-row" style={{ justifyContent: 'space-between' }}>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? (es ? '✕ Cerrar' : '✕ Close') : (es ? '➕ Nueva factura / nota' : '➕ New invoice / note')}
        </button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button className={mType === 'INV' ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'} onClick={() => setMType('INV')}>
              🧾 {es ? 'Factura' : 'Invoice'}
            </button>
            <button className={mType === 'CN' ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'} onClick={() => setMType('CN')}>
              ➖ {es ? 'Nota de crédito' : 'Credit note'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">{es ? 'Cliente (opcional)' : 'Customer (optional)'}</label>
              <select className="form-control" value={mCustomerId} onChange={e => setMCustomerId(e.target.value)}>
                <option value="">{es ? '— Sin cliente / escribir nombre —' : '— No customer / type name —'}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!mCustomerId && (
              <div className="form-group">
                <label className="form-label">{es ? 'Nombre a facturar' : 'Bill to name'}</label>
                <input className="form-control" value={mCustomerName} onChange={e => setMCustomerName(e.target.value)}
                  placeholder={es ? 'Ej: cliente ocasional' : 'E.g. walk-in customer'} />
              </div>
            )}
            {mType === 'INV' && (
              <div className="form-group">
                <label className="form-label">{es ? 'Estado' : 'Status'}</label>
                <select className="form-control" value={mStatus} onChange={e => setMStatus(e.target.value as 'paid' | 'pending')}>
                  <option value="paid">{es ? 'Pagada' : 'Paid'}</option>
                  <option value="pending">{es ? 'Pendiente' : 'Unpaid'}</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ marginTop: '14px' }}>
            <label className="form-label">{es ? 'Conceptos' : 'Line items'}</label>
            {mLines.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input className="form-control" style={{ flex: 1 }} value={l.description}
                  placeholder={es ? 'Concepto (ej: reparación, accesorio...)' : 'Description'}
                  onChange={e => setLine(i, { description: e.target.value })} />
                <input className="form-control" style={{ width: '120px' }} type="number" step="0.01"
                  value={l.amount} placeholder="0.00" onChange={e => setLine(i, { amount: e.target.value })} />
                {mLines.length > 1 && (
                  <button className="btn-secondary btn-xs" onClick={() => setMLines(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn-secondary btn-xs" onClick={() => setMLines(prev => [...prev, { description: '', amount: '' }])}>
              ➕ {es ? 'Añadir concepto' : 'Add line'}
            </button>
          </div>

          {manualBreakdown && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <span>{es ? 'Base' : 'Net'}: {formatMoney(manualBreakdown.subtotal)}</span>
              <span>VAT: {formatMoney(manualBreakdown.vat_amount)}</span>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                {es ? 'Total' : 'Total'}: {mType === 'CN' ? '-' : ''}{formatMoney(manualBreakdown.total)}
              </span>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <button className="btn-primary" disabled={creating} onClick={createManual}>
              {creating ? (es ? 'Emitiendo...' : 'Issuing...')
                : (mType === 'CN' ? (es ? 'Emitir nota de crédito' : 'Issue credit note') : (es ? 'Emitir factura' : 'Issue invoice'))}
            </button>
          </div>
        </div>
      )}

      <div className="filter-row">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={filter === f.key ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
              onClick={() => setFilter(f.key)}
            >
              {language === 'es' ? f.es : f.en}
            </button>
          ))}
        </div>
        <input
          className="form-control filter-input"
          placeholder={language === 'es' ? 'Buscar por nº, cliente o alquiler...' : 'Search by no., customer or rental...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{language === 'es' ? 'Nº Documento' : 'Document No.'}</th>
                <th>{language === 'es' ? 'Tipo' : 'Type'}</th>
                <th>{language === 'es' ? 'Fecha' : 'Date'}</th>
                <th>{language === 'es' ? 'Cliente' : 'Customer'}</th>
                <th>{language === 'es' ? 'Alquiler' : 'Rental'}</th>
                <th style={{ textAlign: 'right' }}>{language === 'es' ? 'Total' : 'Total'}</th>
                <th>{language === 'es' ? 'Estado' : 'Status'}</th>
                <th>{language === 'es' ? 'Acciones' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  {language === 'es' ? 'Cargando...' : 'Loading...'}
                </td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  {language === 'es' ? 'No hay documentos todavía.' : 'No documents yet.'}
                </td></tr>
              ) : visible.map(doc => {
                const cust = (doc.customer_snapshot as { name?: string })?.name ?? '—';
                const rental = doc.rental_id ? rentalCodeById.get(doc.rental_id) ?? '—' : '—';
                const busy = busyId === doc.id;
                return (
                  <tr key={doc.id}>
                    <td><strong>{doc.number}</strong></td>
                    <td style={{ fontSize: '13px' }}>{language === 'es' ? DOC_LABELS[doc.doc_type].es : DOC_LABELS[doc.doc_type].en}</td>
                    <td style={{ fontSize: '13px' }}>{fmtDate(doc.issue_date)}</td>
                    <td style={{ fontSize: '13px' }}>{cust}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rental}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(doc.total)}</td>
                    <td>{statusBadge(doc, language)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button className="btn-secondary btn-xs" disabled={busy} onClick={() => openPdf(doc)}>
                          📄 PDF
                        </button>
                        <button className="btn-secondary btn-xs" disabled={busy} onClick={() => sendToCustomer(doc)}>
                          ✉️ {language === 'es' ? 'Enviar' : 'Send'}
                        </button>
                        {doc.doc_type === 'INV' && doc.status === 'pending' && (
                          <button className="btn-primary btn-xs" disabled={busy} onClick={() => markPaid(doc)}>
                            ✓ {language === 'es' ? 'Pagada' : 'Paid'}
                          </button>
                        )}
                        <button className="btn-secondary btn-xs" disabled={busy} onClick={() => removeDoc(doc)}
                          title={language === 'es' ? 'Eliminar' : 'Delete'}>🗑️</button>
                      </div>
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
