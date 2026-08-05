// Motor de notificaciones.
//
// Dos ideas que gobiernan todo el modulo:
//
// 1. AGRUPAR. Cinco personas que pagan hoy son UNA notificacion que dice
//    "5 alquileres a cobrar hoy", no cinco lineas. Las cinco lineas no se
//    leen: se ignoran.
//
// 2. SOLO LO ACCIONABLE HOY. Avisar "falta 1 semana para cobrar" en un
//    alquiler que se cobra TODAS las semanas no informa nada; solo
//    entrena a ignorar la campanita. Los avisos con antelacion quedan
//    para lo que ocurre una sola vez (un service, un vencimiento).
//
// Las notificaciones son DERIVADAS: se calculan del estado actual, no se
// guardan. Lo unico que se persiste es cuales ya se vieron.

import type {
  Product, Customer, Rental, RentalPayment, CompanyEvent,
  FinancingPayment, FinancingPlan, Sale, SaleItem,
} from '../db';
import type { FiscalDocument } from '../invoicing/types';
import type { StockAlarmRecord } from '../stock/alarms';

export type NotificationKind =
  | 'rent_due_today'
  | 'rent_billing_overdue'
  | 'installment_due_today'
  | 'installment_overdue'
  | 'invoice_unpaid'
  | 'return_notice'
  | 'service_due'
  | 'service_km'
  | 'stock_low'
  | 'contract_unsigned'
  | 'no_deposit'
  | 'event_today';

export type Priority = 'high' | 'normal' | 'low';

/** Adonde lleva el click. Es una clave de pestaña de la app. */
export type TargetTab =
  | 'rental_wizard' | 'invoicing' | 'stock' | 'maintenance'
  | 'calendar' | 'balance' | 'profitability';

export interface NotificationItem {
  /** Entidad concreta detras de la linea (alquiler, bici, factura...). */
  id: string;
  label: string;
  detail?: string;
}

export interface AppNotification {
  /** Estable mientras el contenido no cambie: es la clave de "ya visto". */
  id: string;
  kind: NotificationKind;
  priority: Priority;
  icon: string;
  title: string;
  /** Linea secundaria: el importe, la fecha, el contexto. */
  detail?: string;
  count: number;
  target: TargetTab;
  date?: string;
  items: NotificationItem[];
}

const DAY = 86_400_000;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from.slice(0, 10));
  const b = Date.parse(to.slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / DAY);
}

/**
 * Hash corto y estable del contenido.
 *
 * El id lleva las entidades incluidas, no solo el tipo: si hoy son 5
 * alquileres y manana son otros 5, es una notificacion distinta y tiene
 * que volver a aparecer como nueva. Sin esto, marcar como leido un dia
 * silenciaria el aviso de todos los dias siguientes.
 */
function makeId(kind: string, dateKey: string, itemIds: string[]): string {
  const raw = `${kind}|${dateKey}|${[...itemIds].sort().join(',')}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${kind}-${(h >>> 0).toString(36)}`;
}

function fmtDMY(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function money(n: number): string {
  return `€${(Math.round(n * 100) / 100).toFixed(2)}`;
}

interface BuildInput {
  language: 'es' | 'en';
  bikeCategoryId: string;
  products: Product[];
  customers: Customer[];
  rentals: Rental[];
  payments: RentalPayment[];
  events: CompanyEvent[];
  financingPayments: FinancingPayment[];
  financingPlans: FinancingPlan[];
  sales: Sale[];
  saleItems: SaleItem[];
  documents: FiscalDocument[];
  stockAlarms: StockAlarmRecord[];
  stockQtyBySku: Map<string, number>;
  asOf?: string;
}

/**
 * Titulo de un grupo: con un solo elemento se nombra al implicado, que
 * es mas util que un "1 alquiler a cobrar hoy" que obliga a abrirlo.
 */
function groupTitle(one: string, many: string, items: NotificationItem[]): string {
  return items.length === 1 ? one.replace('{name}', items[0].label) : many.replace('{n}', String(items.length));
}

export function buildNotifications(input: BuildInput): AppNotification[] {
  const {
    language, bikeCategoryId, products, customers, rentals, payments, events,
    financingPayments, financingPlans, sales, saleItems, documents,
    stockAlarms, stockQtyBySku, asOf = todayISO(),
  } = input;

  const es = language === 'es';
  const out: AppNotification[] = [];

  const custName = (id: string | null): string => {
    const c = customers.find(x => x.id === id);
    return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || (es ? 'Cliente' : 'Customer') : (es ? 'Cliente' : 'Customer');
  };
  const bikeLabel = (id: string | null): string => {
    const p = products.find(x => x.id === id);
    return p ? p.serial_number : '';
  };

  const push = (n: Omit<AppNotification, 'id' | 'count'>) => {
    if (n.items.length === 0) return;
    out.push({
      ...n,
      id: makeId(n.kind, n.date ?? asOf, n.items.map(i => i.id)),
      count: n.items.length,
    });
  };

  const openRentals = rentals.filter(r => r.status !== 'Inactivo');

  // ----------------------------------------------------------------
  // COBRO DE ALQUILER
  //
  // El dia de cobro sale del ciclo del propio alquiler, no de un evento
  // de calendario. Los eventos "Pago Alquiler" se crean una sola vez al
  // dar de alta y quedan pendientes para siempre: por eso avisaban "en 1
  // semana" cada semana, de un cobro que se repite igual todas.
  // ----------------------------------------------------------------
  const collectedByRental = new Map<string, number>();
  for (const p of payments) {
    collectedByRental.set(p.rental_id, (collectedByRental.get(p.rental_id) ?? 0) + Number(p.amount || 0));
  }

  const dueToday: NotificationItem[] = [];
  const billingOverdue: NotificationItem[] = [];

  for (const r of openRentals) {
    const label = `${custName(r.customer_id)}${bikeLabel(r.bike_id) ? ` · ${bikeLabel(r.bike_id)}` : ''}`;
    const rate = Number(r.rental_rate || 0);

    // Fecha de cobro: la que lleva el motor de facturacion si existe; si
    // no, el ciclo semanal contado desde el inicio.
    let due: string | null = r.next_invoice_date ?? null;
    if (!due && r.rate_type === 'semanal') {
      const elapsed = daysBetween(r.start_date, asOf);
      if (elapsed >= 0) due = new Date(Date.parse(r.start_date.slice(0, 10)) + Math.ceil(elapsed / 7) * 7 * DAY).toISOString().slice(0, 10);
    }
    if (!due) continue;

    if (due === asOf) {
      dueToday.push({ id: r.id, label, detail: money(rate) });
    } else if (due < asOf) {
      const late = daysBetween(due, asOf);
      billingOverdue.push({
        id: r.id,
        label,
        detail: es ? `${late} días de atraso · ${money(rate)}` : `${late} days late · ${money(rate)}`,
      });
    }
  }

  push({
    kind: 'rent_due_today',
    priority: 'high',
    icon: '💶',
    target: 'rental_wizard',
    date: asOf,
    title: groupTitle(
      es ? 'Cobrar hoy el alquiler de {name}' : "Collect {name}'s rent today",
      es ? '{n} alquileres a cobrar hoy' : '{n} rents to collect today',
      dueToday,
    ),
    detail: dueToday.length > 1
      ? money(dueToday.reduce((s, i) => s + parseFloat((i.detail ?? '0').replace('€', '')), 0))
      : undefined,
    items: dueToday,
  });

  push({
    kind: 'rent_billing_overdue',
    priority: 'high',
    icon: '⏰',
    target: 'rental_wizard',
    date: asOf,
    title: groupTitle(
      es ? 'Cobro atrasado: {name}' : 'Overdue rent: {name}',
      es ? '{n} alquileres con el cobro atrasado' : '{n} rents past their collection date',
      billingOverdue,
    ),
    items: billingOverdue,
  });

  // ----------------------------------------------------------------
  // CUOTAS DE FINANCIACION
  // ----------------------------------------------------------------
  const instToday: NotificationItem[] = [];
  const instOverdue: NotificationItem[] = [];

  for (const pay of financingPayments) {
    if (pay.status !== 'Pendiente') continue;
    const plan = financingPlans.find(fp => fp.id === pay.financing_plan_id);
    const sale = plan ? sales.find(s => s.id === plan.sale_id) : null;
    const who = sale ? custName(sale.customer_id) : (es ? 'Cliente' : 'Customer');
    const serials = sale
      ? saleItems.filter(si => si.sale_id === sale.id).map(si => bikeLabel(si.product_id)).filter(Boolean).join(', ')
      : '';
    const num = `${pay.installment_number}/${plan?.num_installments ?? '?'}`;
    const diff = daysBetween(asOf, pay.due_date);

    if (diff === 0) {
      instToday.push({ id: pay.id, label: who, detail: `${es ? 'Cuota' : 'Installment'} ${num} · ${money(pay.amount)}${serials ? ` · ${serials}` : ''}` });
    } else if (diff < 0) {
      instOverdue.push({ id: pay.id, label: who, detail: `${es ? 'Cuota' : 'Installment'} ${num} · ${money(pay.amount)} · ${es ? `vencida hace ${Math.abs(diff)} días` : `${Math.abs(diff)} days overdue`}` });
    }
  }

  push({
    kind: 'installment_due_today',
    priority: 'high',
    icon: '💳',
    target: 'stock',
    date: asOf,
    title: groupTitle(
      es ? 'Vence hoy la cuota de {name}' : "{name}'s installment is due today",
      es ? '{n} cuotas de financiación vencen hoy' : '{n} financing installments due today',
      instToday,
    ),
    items: instToday,
  });

  push({
    kind: 'installment_overdue',
    priority: 'high',
    icon: '🚩',
    target: 'stock',
    date: asOf,
    title: groupTitle(
      es ? 'Cuota vencida de {name}' : "{name}'s installment is overdue",
      es ? '{n} cuotas de financiación vencidas' : '{n} overdue financing installments',
      instOverdue,
    ),
    items: instOverdue,
  });

  // ----------------------------------------------------------------
  // FACTURAS EMITIDAS Y SIN COBRAR
  // ----------------------------------------------------------------
  const unpaid = documents
    .filter(d => d.doc_type === 'INV' && d.status === 'pending' && daysBetween(d.issue_date, asOf) > 7)
    .map(d => ({
      id: d.id,
      label: d.number,
      detail: `${money(d.total)} · ${es ? 'emitida' : 'issued'} ${fmtDMY(d.issue_date)}`,
    }));

  push({
    kind: 'invoice_unpaid',
    priority: 'normal',
    icon: '🧾',
    target: 'invoicing',
    date: asOf,
    title: groupTitle(
      es ? 'Factura {name} sin cobrar' : 'Invoice {name} unpaid',
      es ? '{n} facturas llevan más de 7 días sin cobrar' : '{n} invoices unpaid for over 7 days',
      unpaid,
    ),
    detail: unpaid.length > 1 ? money(unpaid.reduce((s, u) => s + parseFloat(u.detail.replace('€', '')), 0)) : undefined,
    items: unpaid,
  });

  // ----------------------------------------------------------------
  // DEVOLUCIONES ANUNCIADAS
  // ----------------------------------------------------------------
  const returns = openRentals
    .filter(r => r.status === 'Devolución en Proceso' || !!r.return_notice_date)
    .map(r => ({
      id: r.id,
      label: `${custName(r.customer_id)}${bikeLabel(r.bike_id) ? ` · ${bikeLabel(r.bike_id)}` : ''}`,
      detail: r.return_notice_date ? `${es ? 'devuelve el' : 'returns on'} ${fmtDMY(r.return_notice_date)}` : undefined,
    }));

  push({
    kind: 'return_notice',
    priority: 'normal',
    icon: '🔄',
    target: 'rental_wizard',
    date: asOf,
    title: groupTitle(
      es ? '{name} anunció la devolución' : '{name} announced a return',
      es ? '{n} devoluciones anunciadas' : '{n} announced returns',
      returns,
    ),
    items: returns,
  });

  // ----------------------------------------------------------------
  // TALLER
  // ----------------------------------------------------------------
  const fleet = products.filter(p =>
    p.category_id === bikeCategoryId &&
    !['Vendida', 'Financiada', 'Robada', 'Perdida', 'Perdida/Garda'].includes(p.status),
  );

  const serviceDue: NotificationItem[] = [];
  const serviceKm: NotificationItem[] = [];

  for (const p of fleet) {
    if (p.next_service_date) {
      const diff = daysBetween(asOf, p.next_service_date);
      // Solo hoy o pasado. Un service a 7 dias vista no exige nada hoy.
      if (diff === 0) serviceDue.push({ id: p.id, label: p.serial_number, detail: es ? 'service hoy' : 'service today' });
      else if (diff < 0) serviceDue.push({ id: p.id, label: p.serial_number, detail: es ? `service vencido hace ${Math.abs(diff)} días` : `service ${Math.abs(diff)} days overdue` });
    }
    if (p.next_service_odometer) {
      const rem = p.next_service_odometer - p.odometer;
      if (rem <= 0) serviceKm.push({ id: p.id, label: p.serial_number, detail: es ? 'kilometraje excedido' : 'mileage exceeded' });
      else if (rem <= p.remind_service_odometer_threshold) serviceKm.push({ id: p.id, label: p.serial_number, detail: `${rem} km` });
    }
  }

  push({
    kind: 'service_due',
    priority: 'high',
    icon: '🔧',
    target: 'maintenance',
    date: asOf,
    title: groupTitle(
      es ? 'Service de {name}' : 'Service due for {name}',
      es ? '{n} bicis necesitan service' : '{n} bikes need service',
      serviceDue,
    ),
    items: serviceDue,
  });

  push({
    kind: 'service_km',
    priority: 'normal',
    icon: '🛞',
    target: 'maintenance',
    date: asOf,
    title: groupTitle(
      es ? '{name} llega al service por kilómetros' : '{name} is reaching its service mileage',
      es ? '{n} bicis cerca del service por kilómetros' : '{n} bikes near their service mileage',
      serviceKm,
    ),
    items: serviceKm,
  });

  // ----------------------------------------------------------------
  // STOCK BAJO
  // ----------------------------------------------------------------
  const lowStock: NotificationItem[] = [];
  for (const a of stockAlarms) {
    if (!a.active || !stockQtyBySku.has(a.product_key)) continue;
    const qty = stockQtyBySku.get(a.product_key)!;
    if (qty > a.threshold) continue;
    const prod = products.find(p => p.serial_number === a.product_key);
    lowStock.push({
      id: a.id,
      label: prod?.name || a.product_key,
      detail: es ? `quedan ${qty} (umbral ${a.threshold})` : `${qty} left (threshold ${a.threshold})`,
    });
  }

  push({
    kind: 'stock_low',
    priority: lowStock.some(i => (i.detail ?? '').includes(' 0 ')) ? 'high' : 'normal',
    icon: '📦',
    target: 'stock',
    date: asOf,
    title: groupTitle(
      es ? 'Stock bajo: {name}' : 'Low stock: {name}',
      es ? '{n} artículos con stock bajo' : '{n} items low on stock',
      lowStock,
    ),
    items: lowStock,
  });

  // ----------------------------------------------------------------
  // RIESGO: CONTRATOS SIN FIRMAR Y ALQUILERES SIN DEPOSITO
  //
  // Prioridad baja a proposito: importan, pero no son de hoy. Si
  // compartieran prioridad con un cobro que vence hoy, taparian lo
  // urgente todos los dias.
  // ----------------------------------------------------------------
  const unsigned = openRentals
    .filter(r => !r.contract_signed_at)
    .map(r => ({
      id: r.id,
      label: `${custName(r.customer_id)}${bikeLabel(r.bike_id) ? ` · ${bikeLabel(r.bike_id)}` : ''}`,
      detail: es ? `desde ${fmtDMY(r.start_date)}` : `since ${fmtDMY(r.start_date)}`,
    }));

  push({
    kind: 'contract_unsigned',
    priority: 'low',
    icon: '✍️',
    target: 'rental_wizard',
    date: asOf,
    title: groupTitle(
      es ? 'Contrato sin firmar: {name}' : 'Unsigned contract: {name}',
      es ? '{n} alquileres sin contrato firmado' : '{n} rentals without a signed contract',
      unsigned,
    ),
    items: unsigned,
  });

  const noDeposit = openRentals
    .filter(r => !(r.deposit_amount > 0))
    .map(r => ({
      id: r.id,
      label: `${custName(r.customer_id)}${bikeLabel(r.bike_id) ? ` · ${bikeLabel(r.bike_id)}` : ''}`,
      detail: es ? `${money(Number(r.rental_rate || 0))}/semana sin garantía` : `${money(Number(r.rental_rate || 0))}/week unsecured`,
    }));

  push({
    kind: 'no_deposit',
    priority: 'low',
    icon: '🔓',
    target: 'rental_wizard',
    date: asOf,
    title: groupTitle(
      es ? 'Alquiler sin depósito: {name}' : 'Rental without deposit: {name}',
      es ? '{n} alquileres activos sin depósito' : '{n} active rentals without deposit',
      noDeposit,
    ),
    items: noDeposit,
  });

  // ----------------------------------------------------------------
  // EVENTOS DE CALENDARIO DE HOY
  //
  // Se excluyen los de cobro de alquiler y de cuota: ya se derivan del
  // propio alquiler o del plan de financiacion, con la fecha real. Ese
  // evento se crea una vez y queda pendiente para siempre, asi que
  // avisaba de un cobro que ya se hizo.
  // ----------------------------------------------------------------
  const derived = ['🚲 Pago Alquiler', '💳 Cuota'];
  const todayEvents = events
    .filter(e => e.status === 'Pendiente' && e.event_date === asOf)
    .filter(e => !derived.some(p => e.title.startsWith(p)))
    .map(e => ({ id: e.id, label: e.title }));

  push({
    kind: 'event_today',
    priority: 'normal',
    icon: '📅',
    target: 'calendar',
    date: asOf,
    title: groupTitle(
      es ? 'Hoy: {name}' : 'Today: {name}',
      es ? '{n} eventos en el calendario para hoy' : '{n} calendar events today',
      todayEvents,
    ),
    items: todayEvents,
  });

  const rank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority] || b.count - a.count);
}

// ================================================================
// ESTADO DE "YA VISTO"
//
// Vive en localStorage y no en la base: es una preferencia de lectura
// por dispositivo, y no justifica una tabla ni una migracion.
// ================================================================

const SEEN_KEY = 'fast_sheep_seen_notifications';
/** Tope de ids guardados: evita que el registro crezca sin limite. */
const SEEN_MAX = 400;

export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.filter(x => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSeen(ids: Set<string>): void {
  try {
    // Se recorta por el final: los ids viejos ya no corresponden a
    // ninguna notificacion viva.
    const arr = [...ids].slice(-SEEN_MAX);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    // Sin localStorage (modo privado) se pierde el estado, no la app.
  }
}
