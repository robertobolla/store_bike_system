// Tipos del sistema de facturacion. Espejo de las tablas creadas en
// supabase/migrations/20260724_facturacion.sql.

// RCP: recibo de pago de una cuota de venta financiada. No es una
// factura y no lleva VAT: el impuesto de la venta se devenga completo en
// la entrega, en el INV correspondiente.
export type DocType = 'INV' | 'DEP' | 'REF' | 'CN' | 'RCP';

// INV: pending | paid | cancelled
// DEP/REF: issued
// 'cancelled' es solo para facturas emitidas por error que nunca se
// enviaron. Cualquier correccion posterior va por nota de credito.
export type DocStatus = 'pending' | 'paid' | 'cancelled' | 'issued';

export type ExpenseSource = 'manual' | 'stock' | 'maintenance';

export interface CompanySettings {
  id: number;
  legal_name: string;
  address: string;
  vat_number: string;
  cro_number: string;
  email: string;
  phone: string;
  logo_url: string;
  accounting_email: string;
  default_vat_rate: number;
  invoice_footer: string;
}

// Copia congelada de los datos del cliente al emitir. Si manana cambia
// de direccion, la factura de ayer no se altera.
export interface CustomerSnapshot {
  name: string;
  email: string;
  address: string;
  phone: string;
  customer_code: string;
}

// Venta financiada: una factura por cuota. Estos numeros cambian con cada
// cuota, asi que se congelan al emitir. La factura de la cuota 1 debe
// seguir mostrando el saldo que habia entonces, no el de hoy.
export interface FinancingSnapshot {
  installment_number: number;   // 1
  num_installments: number;     // 6  -> se imprime "Installment 1/6"
  sale_total: number;           // importe total de la venta
  // La entrada y las cuotas se guardan por separado para poder
  // desglosarlas en el recibo. Sin eso, un recibo de una cuota de 400
  // que dice "pagado hasta la fecha 1000" no se entiende: faltaba ver
  // que 600 eran la entrada.
  down_payment: number;
  installments_paid: number;    // cuotas abonadas, incluida esta
  paid_to_date: number;         // down_payment + installments_paid
  remaining_balance: number;    // sale_total - paid_to_date
}

export interface DocumentLine {
  id: string;
  document_id: string;
  description: string;
  quantity: number;
  unit_price: number;   // con VAT incluido
  line_total: number;   // con VAT incluido
  vat_rate: number;
  sort_order: number;
}

export interface FiscalDocument {
  id: string;
  doc_type: DocType;
  number: string;       // INV-2026-1001
  year: number;
  seq: number;

  rental_id: string | null;
  sale_id: string | null;
  customer_id: string | null;
  related_document_id: string | null;

  issue_date: string;
  status: DocStatus;

  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;

  payment_method: string;
  payment_date: string | null;

  customer_snapshot: CustomerSnapshot | Record<string, never>;
  company_snapshot: CompanySettings | Record<string, never>;
  financing_snapshot: FinancingSnapshot | null;

  billing_period_start: string | null;
  billing_period_end: string | null;
  auto_generated: boolean;

  pdf_url: string | null;
  pdf_generated_at: string | null;
  sent_to_customer_at: string | null;
  sent_to_accounting_at: string | null;

  notes: string;
  created_at: string;
  created_by: string | null;
}

// Lo que se le pasa a issue_document(). El numero no viaja: lo asigna
// Postgres dentro de la transaccion.
export interface NewDocumentLine {
  description: string;
  quantity?: number;
  unit_price: number;
  line_total: number;
  vat_rate?: number;
}

export interface NewDocument {
  doc_type: DocType;
  issue_date: string;
  status?: DocStatus;

  rental_id?: string | null;
  sale_id?: string | null;
  customer_id?: string | null;
  related_document_id?: string | null;

  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;

  payment_method?: string;
  payment_date?: string | null;

  customer_snapshot?: CustomerSnapshot;
  company_snapshot?: CompanySettings;
  financing_snapshot?: FinancingSnapshot;

  billing_period_start?: string | null;
  billing_period_end?: string | null;
  auto_generated?: boolean;

  notes?: string;
  created_by?: string | null;

  lines?: NewDocumentLine[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

// Fila unificada para la pantalla Compras y Gastos. Junta las cuatro
// fuentes de egresos del Balance (compra de stock, mantenimiento en dos
// tablas, y gastos manuales) en una sola lista, para que los totales de
// las dos pantallas coincidan por construccion.
//   origin 'stock'       -> products.price_paid (no borrable desde aqui)
//   origin 'maintenance' -> mantenimiento (no borrable desde aqui)
//   origin 'manual'      -> tabla expenses, source manual (borrable)
export interface UnifiedExpenseRow {
  id: string;
  date: string;
  description: string;
  categoryName: string;
  amount: number;       // total con VAT si lo lleva
  origin: 'stock' | 'maintenance' | 'manual';
  // Ruta del comprobante en el bucket privado, si se adjunto uno. No es
  // una URL: para abrirlo hay que firmarla en el momento.
  receiptPath?: string | null;
}

export interface Expense {
  id: string;
  expense_date: string;
  category_id: string | null;
  supplier_id: string | null;
  description: string;

  quantity: number;
  amount: number;       // total pagado, con VAT
  vat_rate: number;
  vat_amount: number;
  net_amount: number;

  payment_method: string;

  // El numero de factura lo pone el proveedor: los gastos no consumen
  // nuestra numeracion. Ambos campos son opcionales porque sueldos o
  // alquiler del local no siempre traen factura.
  supplier_invoice_ref: string | null;
  invoice_file_url: string | null;

  source: ExpenseSource;
  source_id: string | null;

  created_at: string;
  created_by: string | null;
}
