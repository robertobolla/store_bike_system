// Capa de datos de facturacion. Mismo patron que src/db.ts: async sobre
// Supabase, sin cache local, los errores se propagan al llamador.

import { supabase } from '../supabaseClient';
import { round2, splitVatInclusive } from './money';
import type {
  CompanySettings,
  CustomerSnapshot,
  DocType,
  DocumentLine,
  Expense,
  ExpenseCategory,
  FinancingSnapshot,
  FiscalDocument,
  NewDocument,
} from './types';

// ================================================================
// DATOS DE LA EMPRESA
// ================================================================

export async function getCompanySettings(): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data as CompanySettings;
}

export async function updateCompanySettings(patch: Partial<CompanySettings>): Promise<void> {
  const { error } = await supabase.from('company_settings').update(patch).eq('id', 1);
  if (error) throw error;
}

// ================================================================
// EMISION
// ================================================================

// Emite un documento con su numeracion. Numero, cabecera y lineas se
// insertan en una sola transaccion del lado de Postgres: si algo falla no
// se consume numero y la secuencia no queda con huecos.
//
// El documento resultante es inmutable: un trigger bloquea cambios en
// numero, fechas e importes. Para corregirlo hay que emitir una nota de
// credito con createCreditNote().
export async function issueDocument(input: NewDocument): Promise<FiscalDocument> {
  const { data, error } = await supabase.rpc('issue_document', { p: input });
  if (error) throw error;
  return data as FiscalDocument;
}

// Nota de credito sobre una factura ya emitida. Los importes van en
// negativo, que es lo que hace que el neto del alquiler baje sin tocar la
// factura original: INV 70 + CN -20 = 50 (punto 9 del documento).
export async function createCreditNote(
  original: FiscalDocument,
  amount: number,
  description: string,
  opts: { issue_date?: string; created_by?: string | null } = {},
): Promise<FiscalDocument> {
  if (amount <= 0) {
    throw new Error('El importe de una nota de credito se indica en positivo; se guarda en negativo.');
  }
  if (amount > original.total) {
    throw new Error(
      `No se puede acreditar ${amount} sobre la factura ${original.number}, que es de ${original.total}.`,
    );
  }

  const breakdown = splitVatInclusive(amount, original.vat_rate);

  return issueDocument({
    doc_type: 'CN',
    issue_date: opts.issue_date ?? new Date().toISOString().slice(0, 10),
    status: 'issued',
    rental_id: original.rental_id,
    sale_id: original.sale_id,
    customer_id: original.customer_id,
    related_document_id: original.id,
    subtotal: -breakdown.subtotal,
    vat_rate: original.vat_rate,
    vat_amount: -breakdown.vat_amount,
    total: -breakdown.total,
    customer_snapshot: original.customer_snapshot as CustomerSnapshot,
    notes: `Credit note for ${original.number}`,
    created_by: opts.created_by ?? null,
    lines: [{
      description,
      quantity: 1,
      unit_price: -breakdown.total,
      line_total: -breakdown.total,
      vat_rate: original.vat_rate,
    }],
  });
}

// ----------------------------------------------------------------
// Copia de los datos del cliente para congelar en el documento.
// ----------------------------------------------------------------
async function buildCustomerSnapshot(customerId: string | null): Promise<CustomerSnapshot | undefined> {
  if (!customerId) return undefined;
  const { data, error } = await supabase
    .from('customers')
    .select('customer_code, first_name, last_name, email, phone, address')
    .eq('id', customerId)
    .single();
  if (error) throw error;
  return {
    name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
    email: data.email ?? '',
    address: data.address ?? '',
    phone: data.phone ?? '',
    customer_code: data.customer_code ?? '',
  };
}

// ================================================================
// ALQUILERES
// ================================================================

// Emite una factura por un cobro de alquiler registrado a mano. Es el
// "si paga el alquiler -> se genera la Invoice" del apartado 5, para los
// pagos que no vienen del cron semanal.
//
// NO pone billing_period_start, asi que nunca choca con el indice unico
// que protege a la facturacion automatica: una factura manual y una
// semanal pueden convivir sin bloquearse.
export async function issueRentalInvoice(opts: {
  rentalId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  description: string;
  createdBy?: string | null;
}): Promise<FiscalDocument> {
  const { data: rental, error: rErr } = await supabase
    .from('rentals').select('customer_id').eq('id', opts.rentalId).single();
  if (rErr) throw rErr;

  const breakdown = splitVatInclusive(opts.amount);

  return issueDocument({
    doc_type: 'INV',
    issue_date: opts.paymentDate,
    status: 'paid',
    rental_id: opts.rentalId,
    customer_id: rental.customer_id,
    subtotal: breakdown.subtotal,
    vat_rate: breakdown.vat_rate,
    vat_amount: breakdown.vat_amount,
    total: breakdown.total,
    payment_method: opts.paymentMethod,
    payment_date: opts.paymentDate,
    customer_snapshot: await buildCustomerSnapshot(rental.customer_id),
    company_snapshot: await getCompanySettings(),
    created_by: opts.createdBy ?? null,
    lines: [{
      description: opts.description,
      quantity: 1,
      unit_price: breakdown.total,
      line_total: breakdown.total,
      vat_rate: breakdown.vat_rate,
    }],
  });
}

// Documento manual y suelto: el operador escribe uno o varios conceptos
// con su importe y se emite una factura (INV) o una nota de credito (CN),
// opcionalmente ligada a un cliente. Sirve para cobros o correcciones que
// no salen del flujo de alquiler ni de venta.
//
// Los importes se introducen en positivo. En una nota de credito se
// guardan en NEGATIVO (una CN resta), igual que las que salen de
// createCreditNote. El importe de cada linea es CON VAT incluido.
export async function issueManualDocument(opts: {
  docType: 'INV' | 'CN';
  customerId?: string | null;
  customerName?: string;
  lines: Array<{ description: string; amount: number }>;
  issueDate: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  createdBy?: string | null;
}): Promise<FiscalDocument> {
  const sign = opts.docType === 'CN' ? -1 : 1;
  const gross = round2(opts.lines.reduce((s, l) => s + round2(l.amount), 0));
  const breakdown = splitVatInclusive(gross);

  let snapshot: CustomerSnapshot | undefined;
  if (opts.customerId) {
    snapshot = await buildCustomerSnapshot(opts.customerId);
  } else if (opts.customerName) {
    snapshot = { name: opts.customerName, email: '', address: '', phone: '', customer_code: '' };
  }

  return issueDocument({
    doc_type: opts.docType,
    issue_date: opts.issueDate,
    // Una nota de credito se emite ya asentada; no tiene estado de cobro.
    status: opts.docType === 'CN' ? 'issued' : opts.status,
    customer_id: opts.customerId ?? null,
    subtotal: sign * breakdown.subtotal,
    vat_rate: breakdown.vat_rate,
    vat_amount: sign * breakdown.vat_amount,
    total: sign * breakdown.total,
    payment_method: opts.paymentMethod ?? '',
    payment_date: opts.docType === 'INV' && opts.status === 'paid' ? opts.issueDate : null,
    customer_snapshot: snapshot,
    company_snapshot: await getCompanySettings(),
    created_by: opts.createdBy ?? null,
    lines: opts.lines.map(l => ({
      description: l.description,
      quantity: 1,
      unit_price: sign * round2(l.amount),
      line_total: sign * round2(l.amount),
      vat_rate: breakdown.vat_rate,
    })),
  });
}

// Recibo de deposito de seguridad (DEP). No es una factura y no lleva
// VAT: el deposito no es un ingreso, solo una garantia retenida.
export async function issueDepositReceipt(opts: {
  rentalId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  createdBy?: string | null;
}): Promise<FiscalDocument> {
  const { data: rental, error: rErr } = await supabase
    .from('rentals').select('customer_id').eq('id', opts.rentalId).single();
  if (rErr) throw rErr;

  const amount = round2(opts.amount);

  return issueDocument({
    doc_type: 'DEP',
    issue_date: opts.paymentDate,
    status: 'issued',
    rental_id: opts.rentalId,
    customer_id: rental.customer_id,
    subtotal: amount,
    vat_rate: 0,
    vat_amount: 0,
    total: amount,
    payment_method: opts.paymentMethod,
    payment_date: opts.paymentDate,
    customer_snapshot: await buildCustomerSnapshot(rental.customer_id),
    company_snapshot: await getCompanySettings(),
    created_by: opts.createdBy ?? null,
    lines: [{
      description: 'Security deposit',
      quantity: 1,
      unit_price: amount,
      line_total: amount,
      vat_rate: 0,
    }],
  });
}

// ================================================================
// VENTAS
// ================================================================

// Factura de venta por el importe total, con el VAT completo. Se emite
// en la entrega, tambien cuando la venta es financiada: el VAT de una
// venta de bienes se devenga entero en ese momento y no se reparte
// entre las cuotas.
export async function issueSaleInvoice(opts: {
  saleId: string;
  description?: string;
  paymentMethod?: string;
  paymentDate?: string | null;
  issueDate?: string;
  createdBy?: string | null;
}): Promise<FiscalDocument> {
  const { data: sale, error } = await supabase
    .from('sales')
    .select('*')
    .eq('id', opts.saleId)
    .single();
  if (error) throw error;

  const breakdown = splitVatInclusive(Number(sale.total_amount ?? 0));
  const description = opts.description ?? 'Sale';

  return issueDocument({
    doc_type: 'INV',
    issue_date: opts.issueDate ?? sale.sale_date,
    status: opts.paymentDate ? 'paid' : 'pending',
    sale_id: sale.id,
    customer_id: sale.customer_id,
    subtotal: breakdown.subtotal,
    vat_rate: breakdown.vat_rate,
    vat_amount: breakdown.vat_amount,
    total: breakdown.total,
    payment_method: opts.paymentMethod ?? '',
    payment_date: opts.paymentDate ?? null,
    customer_snapshot: await buildCustomerSnapshot(sale.customer_id),
    company_snapshot: await getCompanySettings(),
    created_by: opts.createdBy ?? null,
    lines: [{
      description,
      quantity: 1,
      unit_price: breakdown.total,
      line_total: breakdown.total,
      vat_rate: breakdown.vat_rate,
    }],
  });
}

// Recibo de una cuota de venta financiada. NO es una factura y no lleva
// VAT: el impuesto ya se declaro entero en el INV de la entrega, y
// repetirlo aqui lo declararia siete veces en una venta a 6 plazos.
//
// Muestra "Installment 1/6", el total de la venta, lo pagado hasta la
// fecha y el saldo restante. Lo pagado suma la entrada, las cuotas que
// ya tienen fecha de pago y esta. No asume que se paguen en orden: si
// alguna quedo pendiente en el medio, el saldo lo refleja.
export async function issueInstallmentReceipt(opts: {
  financingPaymentId: string;
  paymentMethod: string;
  paymentDate: string;
  description?: string;
  issueDate?: string;
  createdBy?: string | null;
}): Promise<FiscalDocument> {
  const { data: payment, error: payErr } = await supabase
    .from('financing_payments')
    .select('*')
    .eq('id', opts.financingPaymentId)
    .single();
  if (payErr) throw payErr;

  const { data: plan, error: planErr } = await supabase
    .from('financing_plans')
    .select('*')
    .eq('id', payment.financing_plan_id)
    .single();
  if (planErr) throw planErr;

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('*')
    .eq('id', plan.sale_id)
    .single();
  if (saleErr) throw saleErr;

  const { data: siblings, error: sibErr } = await supabase
    .from('financing_payments')
    .select('id, amount, paid_date')
    .eq('financing_plan_id', plan.id);
  if (sibErr) throw sibErr;

  const paidBefore = (siblings ?? [])
    .filter(p => p.id !== payment.id && p.paid_date)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const saleTotal = round2(Number(sale.total_amount ?? 0));
  const downPayment = round2(Number(sale.down_payment ?? 0));
  const installmentsPaid = round2(paidBefore + Number(payment.amount ?? 0));
  const paidToDate = round2(downPayment + installmentsPaid);
  const financing: FinancingSnapshot = {
    installment_number: payment.installment_number,
    num_installments: plan.num_installments,
    sale_total: saleTotal,
    down_payment: downPayment,
    installments_paid: installmentsPaid,
    paid_to_date: paidToDate,
    remaining_balance: round2(saleTotal - paidToDate),
  };

  // La factura de la entrega, para que el recibo la referencie.
  const { data: saleInvoice } = await supabase
    .from('documents')
    .select('id')
    .eq('sale_id', sale.id)
    .eq('doc_type', 'INV')
    .maybeSingle();

  const amount = round2(Number(payment.amount ?? 0));
  const label = opts.description ?? 'Financed purchase';

  return issueDocument({
    doc_type: 'RCP',
    issue_date: opts.issueDate ?? opts.paymentDate,
    status: 'issued',
    sale_id: sale.id,
    customer_id: sale.customer_id,
    related_document_id: saleInvoice?.id ?? null,
    // Sin VAT a proposito: ver el comentario de arriba.
    subtotal: amount,
    vat_rate: 0,
    vat_amount: 0,
    total: amount,
    payment_method: opts.paymentMethod,
    payment_date: opts.paymentDate,
    customer_snapshot: await buildCustomerSnapshot(sale.customer_id),
    company_snapshot: await getCompanySettings(),
    financing_snapshot: financing,
    created_by: opts.createdBy ?? null,
    lines: [{
      description: `${label} — Installment ${financing.installment_number}/${financing.num_installments}`,
      quantity: 1,
      unit_price: amount,
      line_total: amount,
      vat_rate: 0,
    }],
  });
}

// ================================================================
// CONSULTA
// ================================================================

export async function getDocuments(filter: {
  doc_type?: DocType;
  from?: string;
  to?: string;
} = {}): Promise<FiscalDocument[]> {
  let query = supabase.from('documents').select('*');
  if (filter.doc_type) query = query.eq('doc_type', filter.doc_type);
  if (filter.from) query = query.gte('issue_date', filter.from);
  if (filter.to) query = query.lte('issue_date', filter.to);
  const { data, error } = await query.order('issue_date', { ascending: false }).order('seq', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FiscalDocument[];
}

// Todos los documentos de un alquiler. Es la vista que pide el punto 3:
// abrir un alquiler y ver su factura, su recibo de deposito, su
// devolucion y sus notas de credito.
export async function getDocumentsByRental(rentalId: string): Promise<FiscalDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('rental_id', rentalId)
    .order('issue_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FiscalDocument[];
}

export async function getDocumentLines(documentId: string): Promise<DocumentLine[]> {
  const { data, error } = await supabase
    .from('document_lines')
    .select('*')
    .eq('document_id', documentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentLine[];
}

// El bucket de documentos es privado (lleva datos personales), asi que no
// hay URL fija: se pide una firmada y temporal cada vez que alguien quiere
// abrir el PDF. Una hora de validez es de sobra para verlo o descargarlo.
export async function getDocumentPdfUrl(pdfPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(pdfPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Dispara la Edge Function que genera el PDF, lo archiva y (opcional) lo
// envia. Se usa desde el boton "Generar/Enviar" del listado.
export async function generateDocumentPdf(
  documentId: string,
  sendEmail: boolean,
): Promise<{ pdf_url: string; emailed: boolean }> {
  const { data, error } = await supabase.functions.invoke('generate-document-pdf', {
    body: { document_id: documentId, send_email: sendEmail },
  });
  if (error) throw error;
  return data as { pdf_url: string; emailed: boolean };
}

// Igual que generateDocumentPdf, pero para varios documentos a la vez
// (p.ej. el deposito y la factura de la primera semana al dar de alta un
// alquiler): genera un PDF por documento pero manda UN solo email con
// todos los adjuntos, para no saturar al cliente con varios correos por
// la misma alta.
export async function generateDocumentPdfBatch(
  documentIds: string[],
  sendEmail: boolean,
): Promise<{ results: { document_id: string; pdf_url: string }[]; emailed: boolean }> {
  const { data, error } = await supabase.functions.invoke('generate-document-pdf', {
    body: { document_ids: documentIds, send_email: sendEmail },
  });
  if (error) throw error;
  return data as { results: { document_id: string; pdf_url: string }[]; emailed: boolean };
}

// ================================================================
// ESTADO Y ENVIOS
// El trigger de inmutabilidad deja pasar estos campos y solo estos.
// ================================================================

export async function markDocumentPaid(
  id: string,
  paymentMethod: string,
  paymentDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ status: 'paid', payment_method: paymentMethod, payment_date: paymentDate })
    .eq('id', id);
  if (error) throw error;
}

// Cuando se confirma el cobro semanal de un alquiler auto-facturado, la
// factura de esa semana ya existe (la emitio el cron en estado 'pending')
// y solo hay que marcarla pagada, no emitir una nueva. Si por lo que sea
// no hay ninguna pendiente (el cron aun no corrio, o esta es la primera
// semana y ya se emitio y pago al dar de alta el alquiler), se emite una
// factura nueva ya pagada para que el cobro nunca quede sin factura.
export async function markOldestPendingRentalInvoicePaid(opts: {
  rentalId: string;
  paymentMethod: string;
  paymentDate: string;
  fallbackAmount: number;
  fallbackDescription: string;
  createdBy?: string | null;
}): Promise<FiscalDocument> {
  const docs = await getDocumentsByRental(opts.rentalId);
  const pending = docs.find(d => d.doc_type === 'INV' && d.status === 'pending');

  if (pending) {
    await markDocumentPaid(pending.id, opts.paymentMethod, opts.paymentDate);
    return { ...pending, status: 'paid', payment_method: opts.paymentMethod, payment_date: opts.paymentDate };
  }

  return issueRentalInvoice({
    rentalId: opts.rentalId,
    amount: opts.fallbackAmount,
    paymentMethod: opts.paymentMethod,
    paymentDate: opts.paymentDate,
    description: opts.fallbackDescription,
    createdBy: opts.createdBy,
  });
}

// Solo para facturas emitidas por error que nunca llegaron al cliente.
// Si el cliente ya la recibio, la correccion va por nota de credito.
export async function cancelDocument(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ status: 'cancelled', notes: reason })
    .eq('id', id);
  if (error) throw error;
}

export async function attachDocumentPdf(id: string, pdfUrl: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ pdf_url: pdfUrl, pdf_generated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Avisa al cliente (con copia a facturacion) que el documento se cancelo.
// Best-effort: si no hay email o el envio falla, no frena el borrado.
export async function sendDocumentCancelledEmail(doc: FiscalDocument): Promise<boolean> {
  const customer = doc.customer_snapshot as CustomerSnapshot;
  const to = customer?.email;
  if (!to) return false;
  const company = await getCompanySettings();
  const label = doc.doc_type === 'CN' ? 'credit note'
    : doc.doc_type === 'DEP' ? 'deposit receipt'
    : doc.doc_type === 'REF' ? 'deposit refund'
    : doc.doc_type === 'RCP' ? 'payment receipt' : 'invoice';
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
            font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Hi,</p>
  <p>We're writing to let you know that ${label} <strong>${doc.number}</strong> has been
     <strong>cancelled</strong> and is no longer valid.</p>
  <p style="color:#555">If you have any questions, just reply to this email.</p>
  <p style="margin-top:28px;padding-top:14px;border-top:1px solid #e4e4e4;font-size:12px;color:#777">
    ${company.invoice_footer || company.legal_name}
  </p>
</div>`;
  const { error } = await supabase.functions.invoke('send-email', {
    body: {
      to,
      cc: company.accounting_email ? [company.accounting_email] : undefined,
      subject: `${label[0].toUpperCase() + label.slice(1)} ${doc.number} cancelled — ${company.legal_name}`,
      html,
    },
  });
  return !error;
}

// Borra un documento y, si era el ultimo numero de su tipo/anio, retrocede
// el contador para que el proximo lo reuse (ver delete_document en la
// migracion). Tambien borra el PDF archivado. Pensado para limpiar datos
// de prueba: un documento fiscal real no deberia borrarse.
export async function deleteDocument(id: string, pdfPath?: string | null): Promise<void> {
  if (pdfPath) {
    // El PDF puede no existir; el fallo al borrarlo no debe frenar el borrado.
    try { await supabase.storage.from('documents').remove([pdfPath]); } catch { /* noop */ }
  }
  const { error } = await supabase.rpc('delete_document', { p_id: id });
  if (error) throw error;
}

export async function markDocumentSent(
  id: string,
  target: 'customer' | 'accounting',
): Promise<void> {
  const field = target === 'customer' ? 'sent_to_customer_at' : 'sent_to_accounting_at';
  const { error } = await supabase
    .from('documents')
    .update({ [field]: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ================================================================
// GASTOS (punto 10)
// ================================================================

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export async function insertExpenseCategory(name: string, color: string): Promise<ExpenseCategory> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name, color })
    .select()
    .single();
  if (error) throw error;
  return data as ExpenseCategory;
}

export async function updateExpenseCategory(id: string, name: string, color: string): Promise<void> {
  const { error } = await supabase
    .from('expense_categories')
    .update({ name, color })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id);
  if (error) throw error;
}

export async function getBusinessExpenses(filter: { from?: string; to?: string } = {}): Promise<Expense[]> {
  let query = supabase.from('expenses').select('*');
  if (filter.from) query = query.gte('expense_date', filter.from);
  if (filter.to) query = query.lte('expense_date', filter.to);
  const { data, error } = await query.order('expense_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function insertBusinessExpense(e: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').insert(e).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function updateBusinessExpense(id: string, patch: Partial<Expense>): Promise<void> {
  const { error } = await supabase.from('expenses').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteBusinessExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// Registra la compra de N unidades como UN gasto y engancha las unidades
// creadas. Es el punto de entrada unico: si la compra se carga aqui,
// nadie vuelve a subir la misma factura desde Balance, y products.expense_id
// impide que una unidad cuelgue de dos gastos distintos.
export async function registerStockPurchase(
  expense: Omit<Expense, 'id' | 'created_at' | 'source' | 'source_id'>,
  productIds: string[],
): Promise<Expense> {
  const created = await insertBusinessExpense({
    ...expense,
    source: 'stock',
    source_id: null,
  } as Omit<Expense, 'id' | 'created_at'>);

  if (productIds.length > 0) {
    const { error } = await supabase
      .from('products')
      .update({ expense_id: created.id })
      .in('id', productIds);
    if (error) throw error;
  }

  return created;
}
