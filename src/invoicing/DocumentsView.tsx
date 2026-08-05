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
import type { ManualDocType } from './api';
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

// Alquiler con codigo visible. Solo entran los que tienen RNT: ligar un
// documento a un alquiler sin codigo no se veria ni en la tabla ni en el PDF.
export interface RentalOption {
  id: string;
  code: string;          // RNT-2026-0024
  customerId: string;
  active: boolean;
}

interface Props {
  language: 'es' | 'en';
  showToast: (msg: string, type?: 'success' | 'error') => void;
  // Alquileres con RNT: dan la columna "Alquiler" de la tabla y el selector
  // con el que un documento manual se liga a su alquiler.
  rentals: RentalOption[];
  // Clientes para el selector de la factura manual. El email se usa para
  // proponer el destinatario cuando se elige enviar el documento.
  customers: { id: string; name: string; email?: string }[];
}

interface ManualLine { description: string; amount: string; }

export function DocumentsView({ language, showToast, rentals, customers }: Props) {
  const es = language === 'es';
  const [docs, setDocs] = useState<FiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | DocType>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Regenerado en lote de los PDF que quedaron sin archivo. Pasa sobre
  // todo despues de reordenar la numeracion: al cambiar el numero, el PDF
  // archivado queda mintiendo y se suelta la referencia.
  const [regen, setRegen] = useState<{ hechos: number; total: number; fallos: number } | null>(null);

  // Formulario de documento manual: factura, nota de credito, recibo de
  // deposito y devolucion de deposito.
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mType, setMType] = useState<ManualDocType>('INV');
  const [mCustomerId, setMCustomerId] = useState('');
  const [mCustomerName, setMCustomerName] = useState('');
  // Alquiler al que se liga el documento. Es lo que hace que un cobro suelto
  // (una reparacion, un deposito, una nota de credito) aparezca junto al
  // resto de papeles del alquiler y se imprima como "Rental ref:".
  const [mRentalId, setMRentalId] = useState('');
  const [mStatus, setMStatus] = useState<'paid' | 'pending'>('paid');
  const [mIssueDate, setMIssueDate] = useState(new Date().toISOString().slice(0, 10));
  // Envio del documento. Arranca apagado a proposito: emitir no deberia
  // disparar un correo por sorpresa. Al encenderlo se propone el email
  // del cliente elegido, pero se puede escribir cualquier otro.
  const [mSendEmail, setMSendEmail] = useState(false);
  const [mEmail, setMEmail] = useState('');
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

  const rentalCodeById = useMemo(
    () => new Map(rentals.map(r => [r.id, r.code])),
    [rentals],
  );

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
        ? `¿Eliminar ${doc.number}? Se enviará un aviso de cancelación al cliente. El número queda como hueco en la numeración: no lo reutiliza nadie.`
        : `Delete ${doc.number}? A cancellation notice will be emailed to the customer. Its number stays as a gap in the sequence: nothing reuses it.`,
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

  // Documentos sin PDF archivado. Se cuenta sobre TODOS, no sobre los
  // visibles: el filtro de arriba no debe cambiar cuantos hay que rehacer.
  const sinPdf = useMemo(() => docs.filter(d => !d.pdf_url), [docs]);

  // De a UNO, con reintentos y una pausa entre llamadas.
  //
  // La Edge Function renderiza el PDF con @react-pdf/renderer dentro del
  // propio worker, que es caro en CPU y memoria. Pedirle varios por
  // invocacion, y encadenar invocaciones sin respirar, agota los limites
  // del worker: en la primera prueba paso un lote de cinco y fallaron los
  // otros diecinueve. Uno por llamada tarda mas pero llega al final, y un
  // documento que falle se identifica por su numero en vez de arrastrar a
  // otros cuatro.
  const regenerarPdfs = async () => {
    const pendientes = sinPdf.map(d => ({ id: d.id, number: d.number }));
    if (pendientes.length === 0) return;
    const ok = window.confirm(
      es
        ? `¿Regenerar ${pendientes.length} PDF? No se envía ningún email: solo se vuelven a archivar. Puede tardar unos minutos.`
        : `Regenerate ${pendientes.length} PDFs? No email is sent, they are only re-archived. It may take a few minutes.`,
    );
    if (!ok) return;

    const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

    setRegen({ hechos: 0, total: pendientes.length, fallos: 0 });
    let hechos = 0;
    const fallidos: string[] = [];
    let primerError = '';

    for (const doc of pendientes) {
      let logrado = false;
      // Tres intentos con espera creciente: la mayoria de los fallos aqui
      // son del worker saturado, y eso se cura esperando.
      for (let intento = 0; intento < 3 && !logrado; intento++) {
        if (intento > 0) await dormir(1000 * intento);
        try {
          await generateDocumentPdf(doc.id, false);
          logrado = true;
        } catch (e) {
          if (!primerError) primerError = (e as Error)?.message ?? String(e);
          console.error(`No se pudo regenerar ${doc.number} (intento ${intento + 1}):`, e);
        }
      }
      if (logrado) hechos++; else fallidos.push(doc.number);
      setRegen({ hechos, total: pendientes.length, fallos: fallidos.length });
      // Respiro entre documentos para no encadenar invocaciones.
      await dormir(150);
    }

    await load();
    setRegen(null);
    if (fallidos.length === 0) {
      showToast(es ? `${hechos} PDF regenerados.` : `${hechos} PDFs regenerated.`, 'success');
    } else {
      console.error('Documentos sin regenerar:', fallidos.join(', '));
      showToast(
        es
          ? `${hechos} regenerados, ${fallidos.length} fallaron. ${primerError}`
          : `${hechos} regenerated, ${fallidos.length} failed. ${primerError}`,
        'error',
      );
    }
  };

  const setLine = (i: number, patch: Partial<ManualLine>) =>
    setMLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Un deposito y su devolucion no llevan VAT: no son una entrega sujeta
  // a impuesto, son una garantia que se retiene y se devuelve.
  const isVatFree = mType === 'DEP' || mType === 'REF';
  const isNegative = mType === 'CN' || mType === 'REF';
  const manualTotal = round2(mLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0));
  const manualBreakdown = manualTotal > 0 && !isVatFree ? splitVatInclusive(manualTotal) : null;

  const emailOf = (customerId: string) => customers.find(c => c.id === customerId)?.email ?? '';
  const nameOf = (customerId: string) => customers.find(c => c.id === customerId)?.name ?? '';

  // Alquileres ofrecidos: los del cliente elegido, o todos si aun no hay
  // ninguno. Los activos primero y, dentro de cada grupo, el RNT mas alto
  // arriba: el alquiler en curso es casi siempre el que se busca.
  const rentalOptions = useMemo(() => {
    const list = mCustomerId ? rentals.filter(r => r.customerId === mCustomerId) : rentals;
    return [...list].sort((a, b) =>
      (Number(b.active) - Number(a.active)) || b.code.localeCompare(a.code));
  }, [rentals, mCustomerId]);

  // "RNT-2026-0024 — Silas Scalcon (finalizado)". El nombre solo hace falta
  // mientras no haya cliente elegido: en cuanto lo hay, la lista ya es suya.
  const rentalLabel = (r: RentalOption) =>
    r.code
    + (mCustomerId ? '' : ` — ${nameOf(r.customerId)}`)
    + (r.active ? '' : (es ? ' (finalizado)' : ' (ended)'));

  // Al cambiar de cliente se propone su email. Se hace aqui y no en un
  // efecto para que el valor propuesto sea consecuencia directa de la
  // eleccion, y no algo que aparece solo despues de renderizar.
  const pickCustomer = (id: string) => {
    setMCustomerId(id);
    setMEmail(id ? emailOf(id) : '');
    // Un alquiler de otro cliente no puede quedar enganchado: el documento
    // saldria facturado a uno y referenciando el alquiler de otro.
    if (id && mRentalId && !rentals.some(r => r.id === mRentalId && r.customerId === id)) {
      setMRentalId('');
    }
  };

  // Elegir alquiler fija tambien su titular: un documento que cuelga de un
  // alquiler es de quien lo tiene, no de quien se elija a mano.
  const pickRental = (id: string) => {
    setMRentalId(id);
    const owner = rentals.find(r => r.id === id)?.customerId;
    if (owner && owner !== mCustomerId && customers.some(c => c.id === owner)) {
      setMCustomerId(owner);
      setMEmail(emailOf(owner));
    }
  };

  const toggleSendEmail = (on: boolean) => {
    setMSendEmail(on);
    // Al encenderlo se rellena con el email del cliente si aun no hay uno,
    // sin pisar lo que se haya escrito a mano.
    if (on && !mEmail.trim() && mCustomerId) setMEmail(emailOf(mCustomerId));
  };

  const resetManual = () => {
    setMType('INV'); setMCustomerId(''); setMCustomerName(''); setMRentalId('');
    setMStatus('paid'); setMIssueDate(new Date().toISOString().slice(0, 10));
    setMSendEmail(false); setMEmail('');
    setMLines([{ description: '', amount: '' }]);
  };

  const createManual = async () => {
    const lines = mLines
      .map(l => ({ description: l.description.trim(), amount: parseFloat(l.amount) || 0 }))
      .filter(l => l.description && l.amount > 0);
    if (lines.length === 0) {
      showToast(es ? 'Agrega al menos un concepto con importe.' : 'Add at least one line with an amount.', 'error');
      return;
    }
    // Marcar "enviar" sin destinatario emitiria el documento y no lo
    // mandaria a ningun lado, en silencio.
    const destino = mEmail.trim();
    if (mSendEmail && !destino) {
      showToast(es ? 'Indica el email al que enviarlo.' : 'Enter the email to send it to.', 'error');
      return;
    }
    try {
      setCreating(true);
      const custName = mCustomerId ? (customers.find(c => c.id === mCustomerId)?.name ?? '') : mCustomerName.trim();
      const doc = await issueManualDocument({
        docType: mType,
        customerId: mCustomerId || null,
        customerName: custName || undefined,
        customerEmail: destino || undefined,
        rentalId: mRentalId || null,
        lines,
        issueDate: mIssueDate || new Date().toISOString().slice(0, 10),
        status: mStatus,
      });
      // El PDF se genera siempre; el email solo si se pidio.
      const res = await generateDocumentPdf(doc.id, mSendEmail);
      await load();
      const tipo = es ? DOC_LABELS[mType].es : DOC_LABELS[mType].en;
      resetManual();
      setShowForm(false);
      showToast(
        mSendEmail
          ? (res.emailed
              ? `${tipo}: ${doc.number} — ${es ? `enviado a ${destino}` : `sent to ${destino}`}`
              : `${tipo}: ${doc.number} — ${es ? 'emitido, pero el email no salió' : 'issued, but the email failed'}`)
          : `${tipo}: ${doc.number}`,
        mSendEmail && !res.emailed ? 'error' : 'success',
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
          {showForm ? (es ? '✕ Cerrar' : '✕ Close') : (es ? '➕ Nuevo documento' : '➕ New document')}
        </button>

        {/* Solo aparece si hay algo que rehacer. Si todos los documentos
            tienen su PDF archivado, el boton no pinta nada. */}
        {(sinPdf.length > 0 || regen) && (
          <button className="btn-secondary" disabled={!!regen} onClick={regenerarPdfs}>
            {regen
              ? `⏳ ${regen.hechos}/${regen.total}${regen.fallos > 0 ? ` · ${regen.fallos} ${es ? 'fallaron' : 'failed'}` : ''}`
              : `🔄 ${es ? `Regenerar ${sinPdf.length} PDF` : `Regenerate ${sinPdf.length} PDFs`}`}
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {([
              { key: 'INV', icon: '🧾' },
              { key: 'CN', icon: '➖' },
              { key: 'DEP', icon: '🏦' },
              { key: 'REF', icon: '↩️' },
            ] as Array<{ key: ManualDocType; icon: string }>).map(t => (
              <button
                key={t.key}
                className={mType === t.key ? 'btn-primary btn-xs' : 'btn-secondary btn-xs'}
                onClick={() => setMType(t.key)}
              >
                {t.icon} {es ? DOC_LABELS[t.key].es : DOC_LABELS[t.key].en}
              </button>
            ))}
          </div>

          {isVatFree && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 0, marginBottom: '12px' }}>
              {es
                ? 'Un depósito es una garantía, no una venta: no lleva VAT y no se desglosa. La devolución se registra en negativo.'
                : 'A deposit is a guarantee, not a sale: no VAT applies and nothing is broken down. A refund is recorded as negative.'}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">{es ? 'Cliente (opcional)' : 'Customer (optional)'}</label>
              <select className="form-control" value={mCustomerId} onChange={e => pickCustomer(e.target.value)}>
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
            <div className="form-group">
              <label className="form-label">{es ? 'Alquiler (opcional)' : 'Rental (optional)'}</label>
              <select className="form-control" value={mRentalId} onChange={e => pickRental(e.target.value)}>
                <option value="">{es ? '— Sin alquiler —' : '— No rental —'}</option>
                {rentalOptions.map(r => (
                  <option key={r.id} value={r.id}>{rentalLabel(r)}</option>
                ))}
              </select>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                {mRentalId
                  ? (es
                      ? 'Quedará junto al resto de documentos del alquiler y se imprimirá como "Rental ref:".'
                      : 'It will sit with the rest of the rental documents and print as "Rental ref:".')
                  : (es
                      ? 'Elegí el alquiler si el cobro sale de uno: reparación, depósito, corrección...'
                      : 'Pick the rental if the charge comes from one: repair, deposit, correction...')}
              </p>
            </div>
            {mType === 'INV' && (
              <div className="form-group">
                <label className="form-label">{es ? 'Estado' : 'Status'}</label>
                <select className="form-control" value={mStatus} onChange={e => setMStatus(e.target.value as 'paid' | 'pending')}>
                  <option value="paid">{es ? 'Pagada' : 'Paid'}</option>
                  <option value="pending">{es ? 'Pendiente' : 'Unpaid'}</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">{es ? 'Fecha del documento' : 'Document date'}</label>
              <input className="form-control" type="date" value={mIssueDate}
                onChange={e => setMIssueDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label className="form-label">{es ? 'Conceptos' : 'Line items'}</label>
            {/* El ejemplo va en ingles aunque la app este en espanol: esto no
                es texto de pantalla, es lo que se imprime en la factura que
                recibe el cliente, y el resto del documento esta en ingles. */}
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {es
                ? 'Se imprime tal cual en la factura: escribilo en inglés.'
                : 'Printed on the invoice exactly as typed.'}
            </p>
            {mLines.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input className="form-control" style={{ flex: 1 }} value={l.description}
                  placeholder={isVatFree
                    ? 'Description (e.g. security deposit)'
                    : 'Description (e.g. repair, accessory...)'}
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
                {es ? 'Total' : 'Total'}: {isNegative ? '-' : ''}{formatMoney(manualBreakdown.total)}
              </span>
            </div>
          )}

          {isVatFree && manualTotal > 0 && (
            <div style={{ marginTop: '12px', fontSize: '13px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>{es ? 'Sin VAT' : 'No VAT'}</span>
              <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                {es ? 'Total' : 'Total'}: {isNegative ? '-' : ''}{formatMoney(manualTotal)}
              </span>
            </div>
          )}

          {/* Envio del documento por email. */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={mSendEmail}
                onChange={e => toggleSendEmail(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              {es
                ? `Enviar ${(DOC_LABELS[mType].es).toLowerCase()} por email`
                : `Send ${(DOC_LABELS[mType].en).toLowerCase()} by email`}
            </label>

            {mSendEmail && (
              <div className="form-group" style={{ marginTop: '10px', maxWidth: '420px' }}>
                <label className="form-label">{es ? 'Enviar a' : 'Send to'}</label>
                <input
                  className="form-control"
                  type="email"
                  value={mEmail}
                  onChange={e => setMEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  {mCustomerId && mEmail === emailOf(mCustomerId) && mEmail
                    ? (es ? 'Email del cliente seleccionado. Podés cambiarlo.' : "Selected customer's email. You can change it.")
                    : (es ? 'Se enviará a esta dirección, con copia a administración.' : 'It will be sent to this address, with a copy to accounting.')}
                </p>
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <button className="btn-primary" disabled={creating} onClick={createManual}>
              {creating
                ? (es ? 'Emitiendo...' : 'Issuing...')
                : `${es ? 'Emitir' : 'Issue'} ${(es ? DOC_LABELS[mType].es : DOC_LABELS[mType].en).toLowerCase()}`}
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
