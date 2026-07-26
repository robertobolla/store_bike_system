// Bloque de documentos de un alquiler (punto 3 del documento del cliente:
// abrir un alquiler y ver todos sus documentos). Se incrusta en la ficha
// del alquiler. Carga bajo demanda, cuando se expande la seccion.

import { useCallback, useEffect, useState } from 'react';
import { getDocumentsByRental, getDocumentPdfUrl, generateDocumentPdf } from './api';
import { formatMoney } from './money';
import { formatDate as fmtDate } from '../utils/date';
import type { DocType, FiscalDocument } from './types';

const DOC_LABELS: Record<DocType, { es: string; en: string; icon: string }> = {
  INV: { es: 'Factura', en: 'Invoice', icon: '🧾' },
  DEP: { es: 'Depósito', en: 'Deposit', icon: '🔒' },
  REF: { es: 'Devolución', en: 'Refund', icon: '↩️' },
  CN:  { es: 'Nota de crédito', en: 'Credit note', icon: '➖' },
  RCP: { es: 'Recibo', en: 'Receipt', icon: '💶' },
};

interface Props {
  rentalId: string;
  language: 'es' | 'en';
  showToast: (msg: string, type?: 'success' | 'error') => void;
  // Sube en cada carga cuando el padre quiere forzar recarga (p.ej. tras
  // emitir un documento nuevo desde la ficha).
  reloadKey?: number;
}

export function RentalDocuments({ rentalId, language, showToast, reloadKey }: Props) {
  const es = language === 'es';
  const [docs, setDocs] = useState<FiscalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await getDocumentsByRental(rentalId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  // La regla set-state-in-effect da un falso positivo aqui: los setState
  // ocurren tras el await, no de forma sincrona. Cargar datos al montar es
  // el uso legitimo de un efecto.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load, reloadKey]);

  const openPdf = async (doc: FiscalDocument) => {
    try {
      setBusyId(doc.id);
      let path = doc.pdf_url;
      if (!path) {
        const res = await generateDocumentPdf(doc.id, false);
        path = res.pdf_url;
        await load();
      }
      if (path) window.open(await getDocumentPdfUrl(path), '_blank');
    } catch (e) {
      showToast(es ? 'No se pudo abrir el PDF.' : 'Could not open the PDF.', 'error');
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
      {es ? 'Cargando documentos...' : 'Loading documents...'}
    </div>;
  }

  if (docs.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
      {es ? 'Sin documentos todavía.' : 'No documents yet.'}
    </div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {docs.map(doc => {
        const label = DOC_LABELS[doc.doc_type];
        return (
          <div key={doc.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '10px', padding: '8px 10px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span>{label.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{doc.number}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {es ? label.es : label.en} · {fmtDate(doc.issue_date)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatMoney(doc.total)}</span>
              <button className="btn-secondary btn-xs" disabled={busyId === doc.id} onClick={() => openPdf(doc)}>
                📄 PDF
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
