// Documento PDF. Es la version que recibe el cliente, generada con
// @react-pdf/renderer en vez de HTML porque las Edge Functions de
// Supabase corren sobre Deno, sin navegador que convierta HTML a PDF.
//
// Mismo diseno que la vista previa HTML de template.ts. Si se toca uno,
// hay que tocar el otro: son dos representaciones del mismo papel y no
// pueden divergir, o la vista previa mentiria sobre lo que se envia.
//
// react-pdf soporta un subconjunto de CSS: flexbox si, grid no, y las
// unidades van en puntos. De ahi que los estilos no sean identicos a los
// del HTML aunque el resultado lo sea.

import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer';
// Extensiones explicitas a proposito: este archivo tambien lo importa la
// Edge Function, y Deno no resuelve imports relativos sin extension. El
// front lo acepta igual gracias a allowImportingTsExtensions del
// tsconfig, asi que un solo archivo sirve para los dos lados y no hay
// dos copias del documento que puedan divergir.
import { formatMoney } from './money.ts';
import { formatDate } from '../utils/date.ts';
import type {
  CompanySettings, CustomerSnapshot, DocType,
  DocumentLine, FinancingSnapshot, FiscalDocument,
} from './types.ts';

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

const s = StyleSheet.create({
  page: {
    paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40,
    fontSize: 9, lineHeight: 1.45, color: '#1a1a1a',
    fontFamily: 'Helvetica', backgroundColor: '#ffffff',
  },

  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headLeft: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: '68%' },
  logo: { width: 44, height: 44, marginRight: 12, objectFit: 'contain' },
  companyName: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  companyMeta: { color: '#555555', fontSize: 7.5, lineHeight: 1.5 },
  headRight: { alignItems: 'flex-end' },
  docNumber: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  headLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginTop: 8 },
  headValue: { color: '#555555', fontSize: 7.5 },

  rule: { height: 3, backgroundColor: ACCENT, marginTop: 16, marginBottom: 20 },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 21 },
  badge: {
    marginLeft: 12, fontSize: 7, fontFamily: 'Helvetica-Bold',
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8,
  },

  cols: { flexDirection: 'row', marginBottom: 22 },
  col: { flex: 1, borderTopWidth: 1, borderTopColor: '#d8d8d8', paddingTop: 8, marginRight: 18 },
  colLast: { flex: 1, borderTopWidth: 1, borderTopColor: '#d8d8d8', paddingTop: 8 },
  colTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginBottom: 5 },
  colBody: { color: '#444444', fontSize: 8, lineHeight: 1.55 },

  thead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d8d8d8', paddingBottom: 7 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, textAlign: 'right' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#efefef', paddingVertical: 9 },
  cell: { fontSize: 8.5, textAlign: 'right' },
  colDesc: { flex: 1, textAlign: 'left' },
  colQty: { width: 50 },
  colPrice: { width: 80 },
  colAmount: { width: 80 },

  totals: { marginTop: 12, marginLeft: 'auto', width: '62%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, fontSize: 8.5 },
  grand: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1.5, borderTopColor: '#1a1a1a',
    marginTop: 6, paddingTop: 10,
  },
  grandText: { fontFamily: 'Helvetica-Bold', fontSize: 13 },

  panel: {
    marginTop: 22, borderWidth: 1, borderColor: '#e4e4e4', borderRadius: 6,
    padding: 12, backgroundColor: '#fafafa',
  },
  panelTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginBottom: 6 },
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, fontSize: 8.5 },
  panelSubtotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#e8e8e8', marginTop: 4, paddingTop: 5, fontSize: 8.5,
  },
  panelTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#d0d0d0', marginTop: 4, paddingTop: 6,
  },
  panelTotalText: { fontFamily: 'Helvetica-Bold', fontSize: 8.5 },

  note: { marginTop: 18, fontSize: 8, color: '#555555' },

  footer: {
    position: 'absolute', bottom: 24, left: 40, right: 40,
    borderTopWidth: 1, borderTopColor: '#e4e4e4', paddingTop: 7,
    fontSize: 6.5, color: '#777777', textAlign: 'center',
  },
});

const BADGE_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  paid:      { backgroundColor: '#d1fae5', color: '#065f46' },
  cancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
  pending:   { backgroundColor: '#fef3c7', color: '#92400e' },
};

const BADGE_LABELS: Record<string, string> = {
  paid: 'PAID', cancelled: 'CANCELLED', pending: 'UNPAID',
};

export interface PdfInput {
  doc: FiscalDocument;
  lines: DocumentLine[];
  company: CompanySettings;
  customer: CustomerSnapshot;
  // Codigo visible del alquiler (RNT-2026-0001). Es lo que enlaza todos
  // los documentos de un mismo alquiler entre si.
  rentalCode?: string | null;
  // Numero del documento que corrige, para las notas de credito.
  relatedNumber?: string | null;
}

export function DocumentPdf({ doc, lines, company, customer, rentalCode, relatedNumber }: PdfInput) {
  const showsVat = SHOWS_VAT[doc.doc_type];
  const badgeKey = doc.doc_type === 'INV'
    ? (BADGE_LABELS[doc.status] ? doc.status : 'pending')
    : null;

  return (
    <Document title={doc.number} author={company.legal_name}>
      <Page size="A4" style={s.page}>

        <View style={s.head}>
          <View style={s.headLeft}>
            {company.logo_url ? <Image style={s.logo} src={company.logo_url} /> : null}
            <View>
              <Text style={s.companyName}>{company.legal_name}</Text>
              <Text style={s.companyMeta}>{company.address}</Text>
              <Text style={s.companyMeta}>
                {company.vat_number ? `VAT ${company.vat_number}` : ''}
                {company.cro_number ? ` · CRO ${company.cro_number}` : ''}
              </Text>
              {company.email ? <Text style={s.companyMeta}>{company.email}</Text> : null}
            </View>
          </View>
          <View style={s.headRight}>
            <Text style={s.docNumber}>{doc.number}</Text>
            <Text style={s.headLabel}>Issue date</Text>
            <Text style={s.headValue}>{formatDate(doc.issue_date)}</Text>
          </View>
        </View>

        <View style={s.rule} />

        <View style={s.titleRow}>
          <Text style={s.title}>{TITLES[doc.doc_type]}</Text>
          {badgeKey ? (
            <Text style={[s.badge, BADGE_STYLES[badgeKey]]}>{BADGE_LABELS[badgeKey]}</Text>
          ) : null}
        </View>

        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.colTitle}>Bill to</Text>
            <Text style={s.colBody}>{customer.name || '—'}</Text>
            {customer.address ? <Text style={s.colBody}>{customer.address}</Text> : null}
            {customer.email ? <Text style={s.colBody}>{customer.email}</Text> : null}
            {customer.phone ? <Text style={s.colBody}>{customer.phone}</Text> : null}
          </View>
          <View style={s.col}>
            <Text style={s.colTitle}>Details</Text>
            <Text style={s.colBody}>Document: {doc.number}</Text>
            <Text style={s.colBody}>Date: {formatDate(doc.issue_date)}</Text>
            {rentalCode ? <Text style={s.colBody}>Rental ref: {rentalCode}</Text> : null}
            {relatedNumber ? <Text style={s.colBody}>Refers to: {relatedNumber}</Text> : null}
            {doc.billing_period_start ? (
              <Text style={s.colBody}>
                Period: {formatDate(doc.billing_period_start)} – {formatDate(doc.billing_period_end)}
              </Text>
            ) : null}
          </View>
          <View style={s.colLast}>
            <Text style={s.colTitle}>Payment</Text>
            {doc.payment_date ? <Text style={s.colBody}>Paid on: {formatDate(doc.payment_date)}</Text> : null}
            <Text style={[s.colBody, { fontFamily: 'Helvetica-Bold' }]}>{formatMoney(doc.total)}</Text>
          </View>
        </View>

        <View style={s.thead}>
          <Text style={[s.th, s.colDesc, { textAlign: 'left' }]}>Description</Text>
          <Text style={[s.th, s.colQty]}>Qty</Text>
          <Text style={[s.th, s.colPrice]}>Unit price</Text>
          <Text style={[s.th, s.colAmount]}>Amount</Text>
        </View>

        {lines.map(line => (
          <View style={s.row} key={line.id}>
            <Text style={[s.cell, s.colDesc]}>{line.description}</Text>
            <Text style={[s.cell, s.colQty]}>{line.quantity}</Text>
            <Text style={[s.cell, s.colPrice]}>{formatMoney(line.unit_price)}</Text>
            <Text style={[s.cell, s.colAmount]}>{formatMoney(line.line_total)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          {showsVat ? (
            <>
              <View style={s.totalsRow}>
                <Text>Subtotal (excl. VAT)</Text>
                <Text>{formatMoney(doc.subtotal)}</Text>
              </View>
              <View style={s.totalsRow}>
                <Text>VAT {doc.vat_rate}%</Text>
                <Text>{formatMoney(doc.vat_amount)}</Text>
              </View>
            </>
          ) : null}
          <View style={s.grand}>
            <Text style={s.grandText}>Total</Text>
            <Text style={s.grandText}>{formatMoney(doc.total)}</Text>
          </View>
        </View>

        <FinancingPanel financing={doc.financing_snapshot} />
        <VatNote type={doc.doc_type} />

        {doc.notes ? <Text style={s.note}>{doc.notes}</Text> : null}

        <Text style={s.footer} fixed>
          {company.invoice_footer
            || `${company.legal_name} · CRO ${company.cro_number} · VAT ${company.vat_number}`}
        </Text>

      </Page>
    </Document>
  );
}

// Bloque de cuota. Desglosa entrada y cuotas por separado: si solo se
// mostrara "pagado hasta la fecha", un recibo de una cuota de 400 que
// dice 1000 pagados no se entiende sin ver que 600 eran la entrada.
function FinancingPanel({ financing }: { financing: FinancingSnapshot | null }) {
  if (!financing) return null;
  const f = financing;
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>
        Installment {f.installment_number} of {f.num_installments}
      </Text>
      <View style={s.panelRow}>
        <Text>Total purchase price</Text><Text>{formatMoney(f.sale_total)}</Text>
      </View>
      <View style={s.panelRow}>
        <Text>Down payment</Text><Text>{formatMoney(f.down_payment)}</Text>
      </View>
      <View style={s.panelRow}>
        <Text>Installments paid ({f.installment_number} of {f.num_installments})</Text>
        <Text>{formatMoney(f.installments_paid)}</Text>
      </View>
      <View style={s.panelSubtotal}>
        <Text>Paid to date</Text><Text>{formatMoney(f.paid_to_date)}</Text>
      </View>
      <View style={s.panelTotal}>
        <Text style={s.panelTotalText}>Outstanding balance</Text>
        <Text style={s.panelTotalText}>{formatMoney(f.remaining_balance)}</Text>
      </View>
    </View>
  );
}

// Un documento sin desglose de VAT tiene que decir por que, o parece que
// se olvidaron de cobrarlo.
function VatNote({ type }: { type: DocType }) {
  if (type === 'DEP' || type === 'REF') {
    return <Text style={s.note}>Security deposit. Not a taxable supply — no VAT applies.</Text>;
  }
  if (type === 'RCP') {
    return (
      <Text style={s.note}>
        Payment receipt. This is not a VAT invoice: VAT on this sale was charged in full
        on the original invoice.
      </Text>
    );
  }
  return null;
}
