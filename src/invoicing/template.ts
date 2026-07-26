// Plantilla HTML de los documentos. Se convierte a PDF en la Edge
// Function, asi que es una funcion pura: sin React, sin DOM, sin acceso
// a red. Todo lo que imprime viene de los snapshots congelados en el
// documento, nunca de consultar las tablas vivas. Reimprimir una factura
// de hace seis meses tiene que dar exactamente el mismo papel.
//
// La maqueta sigue la de Square (cabecera, franja de color, tres
// columnas, tabla de articulos, totales) con lo que alli no existe y
// aqui es obligatorio: desglose de VAT, VAT number y CRO, referencia al
// alquiler y el detalle de cuotas.

import { formatMoney } from './money';
import { formatDate as formatDateDMY } from '../utils/date';
import type {
  CompanySettings,
  CustomerSnapshot,
  DocType,
  DocumentLine,
  FinancingSnapshot,
  FiscalDocument,
} from './types';

const ACCENT = '#10b981';

const TITLES: Record<DocType, string> = {
  INV: 'INVOICE',
  DEP: 'DEPOSIT RECEIPT',
  REF: 'DEPOSIT REFUND',
  CN:  'CREDIT NOTE',
  RCP: 'PAYMENT RECEIPT',
};

// Solo la factura y la nota de credito desglosan VAT. El deposito no es
// un ingreso, y el recibo de cuota no lo lleva porque el impuesto ya se
// declaro entero en la factura de la entrega.
const SHOWS_VAT: Record<DocType, boolean> = {
  INV: true, CN: true, DEP: false, REF: false, RCP: false,
};

// El metodo de pago NO se imprime, por decision del cliente. El dato se
// sigue guardando en documents.payment_method para la contabilidad
// interna; simplemente no aparece en el papel que recibe el cliente.
// (El documento de requisitos lo pedia en los apartados 4, 7 y 8, asi
// que si algun dia se reclama, es volver a poner la linea en el bloque
// Payment y traducir el valor: efectivo -> Cash, transferencia ->
// Bank transfer, mixto -> Cash + bank transfer.)

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Los saltos de linea de la direccion se guardan como \n en la base.
function nl2br(value: string): string {
  return esc(value).replace(/\n/g, '<br>');
}

function formatDate(value: string | null | undefined): string {
  return esc(formatDateDMY(value));
}

export interface RenderInput {
  doc: FiscalDocument;
  lines: DocumentLine[];
  company: CompanySettings;
  customer: CustomerSnapshot;
  // Codigo visible del alquiler (RNT-2026-0001), si el documento cuelga
  // de uno. Es lo que enlaza todos los documentos entre si.
  rentalCode?: string | null;
  // Numero del documento que corrige, para las notas de credito.
  relatedNumber?: string | null;
}

export function renderDocumentHtml(input: RenderInput): string {
  const { doc, lines, company, customer } = input;
  const showsVat = SHOWS_VAT[doc.doc_type];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(doc.number)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  /* Un documento fiscal es blanco siempre. Sin esto, el navegador o el
     renderizador de PDF aplican su tema oscuro y sale texto negro sobre
     fondo negro. color-scheme: light desactiva esa inversion. */
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* El documento se dibuja como una hoja A4 centrada. Sin ancho maximo
     se estira hasta el borde de la ventana y en pantallas anchas las
     columnas quedan separadas por medio metro de blanco. */
  .page {
    max-width: 186mm;
    margin: 0 auto;
    padding: 16mm 14mm;
    background: #ffffff;
    border: 1px solid #e4e4e4;
  }

  /* Al imprimir manda @page: la hoja ya tiene sus margenes fisicos y el
     contenedor tiene que soltar los suyos para no duplicarlos. */
  @media print {
    body { background: #ffffff; }
    .page { max-width: none; margin: 0; padding: 0; border: 0; }
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .head-left { display: flex; gap: 14px; align-items: flex-start; }
  .logo { width: 54px; height: 54px; object-fit: contain; border-radius: 8px; }
  .company-name { font-weight: 700; font-size: 11pt; }
  .company-meta { color: #555; font-size: 8.5pt; line-height: 1.5; }
  .head-right { text-align: right; white-space: nowrap; }
  .doc-number { font-weight: 700; font-size: 11pt; }
  .head-label { font-weight: 700; font-size: 8.5pt; margin-top: 8px; }
  .head-value { color: #555; font-size: 8.5pt; }

  .rule { height: 4px; background: ${ACCENT}; border-radius: 2px; margin: 16px 0 22px; }

  .title-row { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  h1 { font-size: 24pt; margin: 0; font-weight: 700; letter-spacing: -0.4px; }
  .badge {
    font-size: 8pt; font-weight: 700; letter-spacing: 0.6px;
    padding: 4px 10px; border-radius: 999px; text-transform: uppercase;
  }
  .badge-paid      { background: #d1fae5; color: #065f46; }
  .badge-pending   { background: #fef3c7; color: #92400e; }
  .badge-cancelled { background: #fee2e2; color: #991b1b; }

  .cols { display: flex; gap: 26px; margin-bottom: 24px; }
  .col { flex: 1; border-top: 1px solid #d8d8d8; padding-top: 10px; }
  .col-title { font-weight: 700; font-size: 8.5pt; margin-bottom: 6px; }
  .col-body { color: #444; font-size: 9pt; line-height: 1.55; }

  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: right; font-size: 8.5pt; font-weight: 700;
    border-bottom: 1px solid #d8d8d8; padding: 0 0 8px;
  }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 11px 0; border-bottom: 1px solid #efefef; text-align: right; font-size: 9.5pt; }

  .totals { margin-top: 14px; margin-left: auto; width: 62%; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 9.5pt; }
  .totals-row.grand {
    border-top: 2px solid #1a1a1a; margin-top: 8px; padding-top: 12px;
    font-size: 15pt; font-weight: 700;
  }

  .panel {
    margin-top: 24px; border: 1px solid #e4e4e4; border-radius: 8px;
    padding: 14px 16px; background: #fafafa;
  }
  .panel-title { font-weight: 700; font-size: 9pt; margin-bottom: 8px; }
  .panel-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 9.5pt; }
  .panel-row.subtotal { border-top: 1px solid #e8e8e8; margin-top: 5px; padding-top: 6px; }
  .panel-row.total { border-top: 1px solid #d0d0d0; margin-top: 5px; padding-top: 8px; font-weight: 700; }

  .note { margin-top: 20px; font-size: 9pt; color: #555; }

  /* En pantalla el pie va al final del documento; al imprimir se fija
     abajo para que se repita en todas las paginas. */
  footer {
    margin-top: 36px; border-top: 1px solid #e4e4e4; padding-top: 8px;
    font-size: 7.5pt; color: #777; text-align: center;
  }
  @media print {
    footer { position: fixed; bottom: 0; left: 0; right: 0; margin-top: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="head">
    <div class="head-left">
      ${company.logo_url ? `<img class="logo" src="${esc(company.logo_url)}" alt="">` : ''}
      <div>
        <div class="company-name">${esc(company.legal_name)}</div>
        <div class="company-meta">
          ${nl2br(company.address)}<br>
          ${company.vat_number ? `VAT ${esc(company.vat_number)}` : ''}
          ${company.cro_number ? ` · CRO ${esc(company.cro_number)}` : ''}
          ${company.email ? `<br>${esc(company.email)}` : ''}
        </div>
      </div>
    </div>
    <div class="head-right">
      <div class="doc-number">${esc(doc.number)}</div>
      <div class="head-label">Issue date</div>
      <div class="head-value">${formatDate(doc.issue_date)}</div>
    </div>
  </div>

  <div class="rule"></div>

  <div class="title-row">
    <h1>${TITLES[doc.doc_type]}</h1>
    ${renderBadge(doc)}
  </div>

  <div class="cols">
    <div class="col">
      <div class="col-title">Bill to</div>
      <div class="col-body">
        ${esc(customer.name) || '—'}
        ${customer.address ? `<br>${nl2br(customer.address)}` : ''}
        ${customer.email ? `<br>${esc(customer.email)}` : ''}
        ${customer.phone ? `<br>${esc(customer.phone)}` : ''}
      </div>
    </div>
    <div class="col">
      <div class="col-title">Details</div>
      <div class="col-body">
        Document: ${esc(doc.number)}<br>
        Date: ${formatDate(doc.issue_date)}
        ${input.rentalCode ? `<br>Rental ref: ${esc(input.rentalCode)}` : ''}
        ${input.relatedNumber ? `<br>Refers to: ${esc(input.relatedNumber)}` : ''}
        ${doc.billing_period_start
          ? `<br>Period: ${formatDate(doc.billing_period_start)} – ${formatDate(doc.billing_period_end)}`
          : ''}
      </div>
    </div>
    <div class="col">
      <div class="col-title">Payment</div>
      <div class="col-body">
        ${doc.payment_date ? `Paid on: ${formatDate(doc.payment_date)}<br>` : ''}
        <strong>${formatMoney(doc.total)}</strong>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map(renderLine).join('')}
    </tbody>
  </table>

  <div class="totals">
    ${showsVat ? `
    <div class="totals-row">
      <span>Subtotal (excl. VAT)</span>
      <span>${formatMoney(doc.subtotal)}</span>
    </div>
    <div class="totals-row">
      <span>VAT ${doc.vat_rate}%</span>
      <span>${formatMoney(doc.vat_amount)}</span>
    </div>` : ''}
    <div class="totals-row grand">
      <span>Total</span>
      <span>${formatMoney(doc.total)}</span>
    </div>
  </div>

  ${renderFinancing(doc.financing_snapshot)}
  ${renderVatNote(doc.doc_type)}
  ${doc.notes ? `<div class="note">${nl2br(doc.notes)}</div>` : ''}

  <footer>
    ${esc(company.invoice_footer || `${company.legal_name} · CRO ${company.cro_number} · VAT ${company.vat_number}`)}
  </footer>

</div>
</body>
</html>`;
}

function renderBadge(doc: FiscalDocument): string {
  if (doc.doc_type !== 'INV') return '';
  if (doc.status === 'paid')      return '<span class="badge badge-paid">Paid</span>';
  if (doc.status === 'cancelled') return '<span class="badge badge-cancelled">Cancelled</span>';
  return '<span class="badge badge-pending">Unpaid</span>';
}

function renderLine(line: DocumentLine): string {
  return `<tr>
    <td>${esc(line.description)}</td>
    <td>${line.quantity}</td>
    <td>${formatMoney(line.unit_price)}</td>
    <td>${formatMoney(line.line_total)}</td>
  </tr>`;
}

// Bloque de cuota: "Installment 1/6", total de la venta, pagado y saldo.
// Los importes salen del snapshot congelado, no del plan vivo: el recibo
// de la cuota 1 debe seguir mostrando el saldo que habia entonces.
function renderFinancing(f: FinancingSnapshot | null): string {
  if (!f) return '';
  return `<div class="panel">
    <div class="panel-title">Installment ${f.installment_number} of ${f.num_installments}</div>
    <div class="panel-row"><span>Total purchase price</span><span>${formatMoney(f.sale_total)}</span></div>
    <div class="panel-row"><span>Down payment</span><span>${formatMoney(f.down_payment)}</span></div>
    <div class="panel-row"><span>Installments paid (${f.installment_number} of ${f.num_installments})</span><span>${formatMoney(f.installments_paid)}</span></div>
    <div class="panel-row subtotal"><span>Paid to date</span><span>${formatMoney(f.paid_to_date)}</span></div>
    <div class="panel-row total"><span>Outstanding balance</span><span>${formatMoney(f.remaining_balance)}</span></div>
  </div>`;
}

// Un documento sin desglose de VAT tiene que decir por que, o parece que
// se olvidaron de cobrarlo.
function renderVatNote(type: DocType): string {
  if (type === 'DEP' || type === 'REF') {
    return `<div class="note">Security deposit. Not a taxable supply — no VAT applies.</div>`;
  }
  if (type === 'RCP') {
    return `<div class="note">Payment receipt. This is not a VAT invoice: VAT on this sale was charged in full on the original invoice.</div>`;
  }
  return '';
}
