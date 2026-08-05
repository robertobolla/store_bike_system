// Metricas de negocio del panel de Rentabilidad.
//
// Vive fuera del componente por dos razones: App.tsx ya es enorme, y
// esto es logica de dinero, del tipo que falla en silencio. Todas las
// funciones son puras: reciben los datos ya cargados y no tocan la red.
//
// Criterio de atribucion (el mismo que calculateProductROI): un cobro
// pertenece a la bici que estaba asignada el dia del cobro. No se
// prorratea: la semana ya cobrada queda entera para la bici que se uso.

import type {
  Product, Rental, RentalItem, RentalPayment,
  MaintenanceExpense, MaintenanceRecord, RentalBikeAssignment,
  Sale, FinancingPayment, AppAccount, AppAccountEarning, AppPlatform,
} from '../db';
import type { FiscalDocument } from '../invoicing/types';

const DAY = 86_400_000;

/** Dias entre dos fechas ISO (solo la parte yyyy-mm-dd). Nunca negativo. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from.slice(0, 10));
  const b = Date.parse(to.slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / DAY));
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type BikeSegment =
  | 'activa_con_deposito'
  | 'activa_sin_deposito'
  | 'inactiva'
  | 'vendida'
  | 'perdida';

export interface BikeProfit {
  productId: string;
  serial: string;
  name: string;
  segment: BikeSegment;

  cost: number;              // precio de compra
  rentalIncome: number;      // cobros de alquiler atribuidos
  depositRetained: number;   // deposito no devuelto (se queda la casa)
  maintenanceCost: number;
  soldPrice: number;

  profit: number;            // resultado neto CON deposito retenido
  profitNoDeposit: number;   // resultado neto SIN contar el deposito
  roi: number;               // % sobre el costo de compra

  daysOnRent: number;
  weeksOnRent: number;
  perWeek: number;           // ingreso de alquiler por semana alquilada
  paybackWeeks: number | null; // semanas para recuperar la compra; null si no gana
}

const LOST_STATUSES: ReadonlySet<string> = new Set(['Robada', 'Perdida', 'Perdida/Garda']);
const SOLD_STATUSES: ReadonlySet<string> = new Set(['Vendida', 'Financiada']);

/** Minimo de dias alquilada para que el ritmo semanal signifique algo. */
const MIN_DAYS_FOR_RATE = 7;

/**
 * Rentabilidad de cada bici de la flota, con el desglose que necesitan
 * los cortes por segmento (con deposito / sin deposito / inactivas).
 */
export function computeBikeProfits(opts: {
  products: Product[];
  bikeCategoryId: string;
  rentals: Rental[];
  rentalItems: RentalItem[];
  payments: RentalPayment[];
  expenses: MaintenanceExpense[];
  records: MaintenanceRecord[];
  assignments?: RentalBikeAssignment[];
  asOf?: string;
}): BikeProfit[] {
  const {
    products, bikeCategoryId, rentals, rentalItems,
    payments, expenses, records, assignments = [], asOf = today(),
  } = opts;

  // Tramos de asignacion por alquiler, ordenados. Con un solo tramo no
  // se filtra por fecha: cualquier cobro del alquiler es de esa bici,
  // asi un pago atrasado no se pierde.
  const spansByRental = new Map<string, RentalBikeAssignment[]>();
  for (const a of assignments) {
    const list = spansByRental.get(a.rental_id) ?? [];
    list.push(a);
    spansByRental.set(a.rental_id, list);
  }
  for (const list of spansByRental.values()) {
    list.sort((x, y) => x.from_date.localeCompare(y.from_date));
  }

  const bikes = products.filter(p => p.category_id === bikeCategoryId);

  return bikes.map(bike => {
    const productId = bike.id;

    const belongsHere = (rentalId: string, date: string): boolean => {
      const spans = spansByRental.get(rentalId);
      if (!spans || spans.length === 0) return true;
      if (spans.length === 1) return spans[0].product_id === productId;
      const idx = spans.findIndex((s, i) => {
        const startsBefore = i === 0 || date >= s.from_date;
        const endsAfter = i === spans.length - 1 || !s.to_date || date < s.to_date;
        return startsBefore && endsAfter;
      });
      return idx >= 0 && spans[idx].product_id === productId;
    };

    const rentalIds = new Set<string>();
    for (const r of rentals) if (r.bike_id === productId) rentalIds.add(r.id);
    for (const ri of rentalItems) if (ri.product_id === productId) rentalIds.add(ri.rental_id);
    for (const a of assignments) if (a.product_id === productId) rentalIds.add(a.rental_id);

    let rentalIncome = 0;
    for (const p of payments) {
      if (rentalIds.has(p.rental_id) && belongsHere(p.rental_id, p.payment_date)) {
        rentalIncome += p.amount;
      }
    }

    // Deposito retenido: solo cuenta como ganancia lo que NO se devolvio.
    // Mientras el alquiler sigue abierto el deposito es una garantia, no
    // un ingreso, asi que solo se imputa al cerrarse.
    let depositRetained = 0;
    let daysOnRent = 0;
    for (const r of rentals) {
      if (!rentalIds.has(r.id)) continue;

      const closingDate = r.end_date || r.scheduled_return_date || r.start_date;
      const closed = r.status === 'Inactivo' && !!r.end_date;
      if (closed) {
        const retained = (r.deposit_amount || 0) - (r.deposit_refunded || 0);
        if (retained > 0 && belongsHere(r.id, closingDate)) depositRetained += retained;
      }

      // Tiempo alquilado atribuido a esta bici.
      const spans = spansByRental.get(r.id);
      const rentalEnd = r.end_date || asOf;
      if (!spans || spans.length === 0) {
        if (r.bike_id === productId) daysOnRent += daysBetween(r.start_date, rentalEnd);
      } else {
        for (const s of spans) {
          if (s.product_id !== productId) continue;
          daysOnRent += daysBetween(s.from_date, s.to_date || rentalEnd);
        }
      }
    }

    let maintenanceCost = 0;
    for (const e of expenses) if (e.product_id === productId) maintenanceCost += e.cost;
    for (const rec of records) {
      if (rec.bike_id !== productId) continue;
      // Un service preventivo que aun no entro al taller no es gasto.
      if (bike.maintenance_status === 'Requiere Service' && rec.service_date === bike.next_service_date) continue;
      maintenanceCost += rec.cost;
    }

    const cost = bike.price_paid || 0;
    const soldPrice = SOLD_STATUSES.has(bike.status) ? (bike.price_sold || 0) : 0;

    const profit = rentalIncome + depositRetained + soldPrice - maintenanceCost - cost;
    const profitNoDeposit = rentalIncome + soldPrice - maintenanceCost - cost;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;

    // El ritmo semanal solo se calcula con al menos una semana alquilada.
    // Con menos, dividir por una fraccion de semana dispara el resultado:
    // un cobro de 70 el primer dia daria "490 por semana", que no es un
    // ritmo sino un artefacto de la division.
    const weeksOnRent = daysOnRent / 7;
    const hasRate = daysOnRent >= MIN_DAYS_FOR_RATE;
    const perWeek = hasRate ? rentalIncome / weeksOnRent : 0;
    const paybackWeeks = perWeek > 0 ? cost / perWeek : null;

    const activeRental = rentals.find(r => rentalIds.has(r.id) && r.status !== 'Inactivo' && r.bike_id === productId);
    let segment: BikeSegment;
    if (SOLD_STATUSES.has(bike.status)) segment = 'vendida';
    else if (LOST_STATUSES.has(bike.status)) segment = 'perdida';
    else if (activeRental) segment = (activeRental.deposit_amount || 0) > 0 ? 'activa_con_deposito' : 'activa_sin_deposito';
    else segment = 'inactiva';

    return {
      productId,
      serial: bike.serial_number,
      name: bike.name,
      segment,
      cost,
      rentalIncome: round2(rentalIncome),
      depositRetained: round2(depositRetained),
      maintenanceCost: round2(maintenanceCost),
      soldPrice,
      profit: round2(profit),
      profitNoDeposit: round2(profitNoDeposit),
      roi: Math.round(roi * 10) / 10,
      daysOnRent,
      weeksOnRent: Math.round(weeksOnRent * 10) / 10,
      perWeek: round2(perWeek),
      paybackWeeks: paybackWeeks === null ? null : Math.round(paybackWeeks * 10) / 10,
    };
  });
}

export interface SegmentStats {
  count: number;
  invested: number;
  rentalIncome: number;
  depositRetained: number;
  maintenanceCost: number;
  profit: number;
  profitNoDeposit: number;
  avgRoi: number;
  avgPerWeek: number;
  avgPaybackWeeks: number | null;
  avgWeeksOnRent: number;
}

/**
 * Agregado de un grupo de bicis.
 *
 * Los ritmos (€/semana, payback) se calculan AGRUPANDO: ingreso total
 * entre semanas totales, no como media de las medias de cada bici. La
 * media de medias le da el mismo peso a una bici con dos semanas que a
 * una con dos anios, y una sola bici con poco tiempo alquilado
 * desplazaria el promedio de toda la flota.
 */
export function summarize(rows: BikeProfit[]): SegmentStats {
  const n = rows.length;
  const sum = (f: (r: BikeProfit) => number) => rows.reduce((s, r) => s + f(r), 0);

  const withRoi = rows.filter(r => r.cost > 0);

  // Solo entra al ritmo el tiempo que de verdad genera ritmo.
  const rated = rows.filter(r => r.daysOnRent >= MIN_DAYS_FOR_RATE);
  const ratedWeeks = rated.reduce((s, r) => s + r.weeksOnRent, 0);
  const ratedIncome = rated.reduce((s, r) => s + r.rentalIncome, 0);
  const ratedInvested = rated.reduce((s, r) => s + r.cost, 0);

  // Payback de una bici tipica: lo que cuesta en promedio, dividido por
  // lo que rinde una semana alquilada. Dividir la inversion TOTAL por el
  // ritmo de UNA bici daria las semanas que tarda una sola en pagar toda
  // la flota, que no es la pregunta.
  const pooledPerWeek = ratedWeeks > 0 ? ratedIncome / ratedWeeks : 0;
  const avgCostRated = rated.length > 0 ? ratedInvested / rated.length : 0;
  const pooledPayback = pooledPerWeek > 0 ? avgCostRated / pooledPerWeek : null;

  return {
    count: n,
    invested: round2(sum(r => r.cost)),
    rentalIncome: round2(sum(r => r.rentalIncome)),
    depositRetained: round2(sum(r => r.depositRetained)),
    maintenanceCost: round2(sum(r => r.maintenanceCost)),
    profit: round2(sum(r => r.profit)),
    profitNoDeposit: round2(sum(r => r.profitNoDeposit)),
    avgRoi: withRoi.length ? Math.round((withRoi.reduce((s, r) => s + r.roi, 0) / withRoi.length) * 10) / 10 : 0,
    avgPerWeek: round2(pooledPerWeek),
    avgPaybackWeeks: pooledPayback === null ? null : Math.round(pooledPayback * 10) / 10,
    avgWeeksOnRent: n ? Math.round((sum(r => r.weeksOnRent) / n) * 10) / 10 : 0,
  };
}

export interface LossStats {
  totalLost: number;
  fleetEver: number;
  lossRatePct: number;
  /** Ritmo medio: 1 perdida cada X dias. null si aun no hubo ninguna. */
  daysPerLoss: number | null;
  daysSinceLastLoss: number | null;
  observationDays: number;
  lostValue: number;
}

/**
 * Cada cuanto se pierde/roba una bici.
 *
 * El ritmo se calcula como ventana / numero de perdidas, no como media
 * de intervalos: con una sola perdida la media de intervalos no existe,
 * y este negocio tiene pocos eventos.
 */
export function computeLossStats(opts: {
  products: Product[];
  bikeCategoryId: string;
  asOf?: string;
}): LossStats {
  const { products, bikeCategoryId, asOf = today() } = opts;
  const bikes = products.filter(p => p.category_id === bikeCategoryId);
  const lost = bikes.filter(p => LOST_STATUSES.has(p.status));

  // Ventana de observacion: desde la primera bici que entro a la flota.
  const starts = bikes
    .map(b => b.purchase_date || (b.date_added ? b.date_added.slice(0, 10) : ''))
    .filter(Boolean)
    .sort();
  const observationDays = starts.length ? daysBetween(starts[0], asOf) : 0;

  const lostDates = lost.map(b => b.lost_date).filter((d): d is string => !!d).sort();
  const daysSinceLastLoss = lostDates.length ? daysBetween(lostDates[lostDates.length - 1], asOf) : null;

  return {
    totalLost: lost.length,
    fleetEver: bikes.length,
    lossRatePct: bikes.length ? Math.round((lost.length / bikes.length) * 1000) / 10 : 0,
    daysPerLoss: lost.length > 0 && observationDays > 0 ? Math.round(observationDays / lost.length) : null,
    daysSinceLastLoss,
    observationDays,
    lostValue: round2(lost.reduce((s, b) => s + (b.price_paid || 0), 0)),
  };
}

export interface SalesCadence {
  key: string;
  name: string;
  unitsSold: number;
  firstSale: string;
  lastSale: string;
  /** Media de dias entre ventas consecutivas. null con una sola venta. */
  avgDaysBetweenSales: number | null;
  daysSinceLastSale: number;
  revenue: number;
  avgPrice: number;
}

/**
 * Cada cuanto se vende cada producto, agrupado por modelo.
 *
 * Se agrupa por nombre (marca + modelo) y no por fila de producto: cada
 * unidad vendida es una fila distinta, asi que por producto individual
 * el dato seria siempre "una venta" y no diria nada.
 */
export function computeSalesCadence(opts: {
  products: Product[];
  asOf?: string;
  excludeCategoryId?: string;
}): SalesCadence[] {
  const { products, asOf = today(), excludeCategoryId } = opts;

  const sold = products.filter(p =>
    SOLD_STATUSES.has(p.status) &&
    !!p.sold_date &&
    (!excludeCategoryId || p.category_id !== excludeCategoryId),
  );

  const groups = new Map<string, Product[]>();
  for (const p of sold) {
    const key = (p.name || p.serial_number || '—').trim();
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const rows: SalesCadence[] = [];
  for (const [key, items] of groups) {
    const dates = items.map(i => (i.sold_date as string).slice(0, 10)).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];

    // Media de intervalos entre ventas consecutivas.
    const avgGap = dates.length >= 2 ? Math.round(daysBetween(first, last) / (dates.length - 1)) : null;

    const revenue = items.reduce((s, i) => s + (i.price_sold || 0), 0);

    rows.push({
      key,
      name: key,
      unitsSold: items.length,
      firstSale: first,
      lastSale: last,
      avgDaysBetweenSales: avgGap,
      daysSinceLastSale: daysBetween(last, asOf),
      revenue: round2(revenue),
      avgPrice: round2(revenue / items.length),
    });
  }

  // Los mas lentos primero: es donde hay algo que mejorar.
  return rows.sort((a, b) => {
    const av = a.avgDaysBetweenSales ?? Number.POSITIVE_INFINITY;
    const bv = b.avgDaysBetweenSales ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return bv - av;
    return b.daysSinceLastSale - a.daysSinceLastSale;
  });
}

// ================================================================
// OCUPACION DE FLOTA E INGRESO RECURRENTE
// ================================================================

export interface OccupancyStats {
  usable: number;         // flota que puede alquilarse hoy
  rented: number;
  idle: number;
  occupancyPct: number;
  /** Tarifa semanal que dejan de generar las bicis paradas. */
  idleCostPerWeek: number;
  /** Ingreso semanal comprometido por los alquileres abiertos. */
  runRatePerWeek: number;
  neverRented: number;
}

/** Tarifa llevada a base semanal, sea cual sea el tipo de tarifa. */
function weeklyRate(r: Pick<Rental, 'rental_rate' | 'rate_type'>): number {
  const amount = Number(r.rental_rate || 0);
  if (r.rate_type === 'mensual') return amount / 4.345;
  if (r.rate_type === 'diario') return amount * 7;
  return amount;
}

export function computeOccupancy(opts: {
  products: Product[];
  bikeCategoryId: string;
  rentals: Rental[];
  rentalItems?: RentalItem[];
  assignments?: RentalBikeAssignment[];
}): OccupancyStats {
  const { products, bikeCategoryId, rentals, rentalItems = [], assignments = [] } = opts;

  const bikes = products.filter(p => p.category_id === bikeCategoryId);
  // Una bici vendida, perdida o robada ya no es flota: incluirla hundiria
  // la ocupacion con activos que ni existen.
  const usable = bikes.filter(b => !SOLD_STATUSES.has(b.status) && !LOST_STATUSES.has(b.status));

  const openRentals = rentals.filter(r => r.status !== 'Inactivo');
  const rentedIds = new Set(openRentals.map(r => r.bike_id));
  const rented = usable.filter(b => rentedIds.has(b.id));
  const idle = usable.length - rented.length;

  // Tarifa de referencia para el lucro cesante: la mediana de lo que se
  // cobra hoy. Usar una constante inventada daria un numero sin anclaje.
  const rates = openRentals.map(weeklyRate).filter(v => v > 0).sort((a, b) => a - b);
  const medianRate = rates.length ? rates[Math.floor(rates.length / 2)] : 0;

  // Bicis que jamas generaron un alquiler, en toda su vida.
  const everRented = new Set<string>();
  for (const r of rentals) if (r.bike_id) everRented.add(r.bike_id);
  for (const ri of rentalItems) everRented.add(ri.product_id);
  for (const a of assignments) everRented.add(a.product_id);

  return {
    usable: usable.length,
    rented: rented.length,
    idle,
    occupancyPct: usable.length ? Math.round((rented.length / usable.length) * 1000) / 10 : 0,
    idleCostPerWeek: round2(idle * medianRate),
    runRatePerWeek: round2(openRentals.reduce((s, r) => s + weeklyRate(r), 0)),
    neverRented: usable.filter(b => !everRented.has(b.id)).length,
  };
}

// ================================================================
// INGRESO POR ALQUILER COMPLETO (de principio a fin)
// ================================================================

export interface RentalLifecycle {
  /** Alquileres terminados que duraron al menos un dia. */
  closedCount: number;
  avgWeeksClosed: number;
  /** Media de tarifa x duracion: lo que el alquiler debio generar. */
  avgBilledClosed: number;
  /** Media de lo realmente cobrado y registrado. */
  avgCollectedClosed: number;
  totalBilledClosed: number;
  totalCollectedClosed: number;
  /** Deposito que no se devolvio, aparte de la renta. */
  avgDepositKeptClosed: number;

  /** En curso: lo acumulado hasta hoy, todavia sin cerrar. */
  openCount: number;
  avgWeeksOpen: number;
  avgBilledOpen: number;
  avgCollectedOpen: number;

  /** Alquileres descartados por durar cero dias (pruebas o cancelados). */
  skippedZeroLength: number;
}

/**
 * Cuanto deja un alquiler entero, de principio a fin.
 *
 * Distinto del ritmo semanal: aqui la unidad es el alquiler completo.
 * Un alquiler de 4 semanas a 100 deja 400, y uno de 8 semanas a 150 deja
 * 1200; la media de esos dos es 800.
 *
 * Los cerrados y los abiertos van por separado a proposito: mezclarlos
 * hundiria la media, porque un alquiler que empezo ayer todavia no
 * genero lo que va a generar.
 */
export function computeRentalLifecycle(opts: {
  rentals: Rental[];
  payments: RentalPayment[];
  asOf?: string;
}): RentalLifecycle {
  const { rentals, payments, asOf = today() } = opts;

  const collectedBy = new Map<string, number>();
  for (const p of payments) {
    collectedBy.set(p.rental_id, (collectedBy.get(p.rental_id) ?? 0) + Number(p.amount || 0));
  }

  const measure = (r: Rental, endDate: string) => {
    const weeks = daysBetween(r.start_date, endDate) / 7;
    return {
      weeks,
      billed: weeks * weeklyRate(r),
      collected: collectedBy.get(r.id) ?? 0,
      depositKept: Math.max(0, (r.deposit_amount || 0) - (r.deposit_refunded || 0)),
    };
  };

  const closedAll = rentals.filter(r => r.status === 'Inactivo' && !!r.end_date);
  const closed = closedAll
    .map(r => measure(r, r.end_date as string))
    .filter(m => m.weeks > 0);

  const open = rentals
    .filter(r => r.status !== 'Inactivo')
    .map(r => measure(r, asOf))
    .filter(m => m.weeks > 0);

  const avg = (list: { [k: string]: number }[], key: string) =>
    list.length ? round2(list.reduce((s, m) => s + m[key], 0) / list.length) : 0;

  return {
    closedCount: closed.length,
    avgWeeksClosed: closed.length ? Math.round((closed.reduce((s, m) => s + m.weeks, 0) / closed.length) * 10) / 10 : 0,
    avgBilledClosed: avg(closed, 'billed'),
    avgCollectedClosed: avg(closed, 'collected'),
    totalBilledClosed: round2(closed.reduce((s, m) => s + m.billed, 0)),
    totalCollectedClosed: round2(closed.reduce((s, m) => s + m.collected, 0)),
    avgDepositKeptClosed: avg(closed, 'depositKept'),

    openCount: open.length,
    avgWeeksOpen: open.length ? Math.round((open.reduce((s, m) => s + m.weeks, 0) / open.length) * 10) / 10 : 0,
    avgBilledOpen: avg(open, 'billed'),
    avgCollectedOpen: avg(open, 'collected'),

    skippedZeroLength: closedAll.length - closed.length,
  };
}

// ================================================================
// MIX DE INGRESOS
// ================================================================

export interface RevenueMix {
  rental: number;
  depositRetained: number;
  saleCash: number;
  financing: number;
  deliveryApps: number;
  total: number;
}

/**
 * De donde viene el dinero que entro de verdad.
 *
 * Es una vista de CAJA, no de facturacion: de una venta financiada solo
 * cuenta la entrada mas las cuotas ya pagadas, no el total de la venta.
 * Sumar el total y ademas las cuotas contaria el mismo dinero dos veces.
 */
export function computeRevenueMix(opts: {
  payments: RentalPayment[];
  rentals: Rental[];
  sales: Sale[];
  financingPayments: FinancingPayment[];
  accountEarnings: AppAccountEarning[];
}): RevenueMix {
  const { payments, rentals, sales, financingPayments, accountEarnings } = opts;

  const rental = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const depositRetained = rentals.reduce((s, r) => {
    if (r.status !== 'Inactivo' || !r.end_date) return s;
    return s + Math.max(0, (r.deposit_amount || 0) - (r.deposit_refunded || 0));
  }, 0);

  let saleCash = 0;
  let financing = 0;
  for (const s of sales) {
    if (s.payment_type === 'financiado') financing += Number(s.down_payment || 0);
    else saleCash += Number(s.total_amount || 0);
  }
  for (const fp of financingPayments) {
    if (fp.paid_date) financing += Number(fp.amount || 0);
  }

  const deliveryApps = accountEarnings.reduce((s, e) => s + Number(e.amount || 0), 0);

  const total = rental + depositRetained + saleCash + financing + deliveryApps;
  return {
    rental: round2(rental),
    depositRetained: round2(depositRetained),
    saleCash: round2(saleCash),
    financing: round2(financing),
    deliveryApps: round2(deliveryApps),
    total: round2(total),
  };
}

// ================================================================
// FACTURAS EMITIDAS VS COBRADAS
// ================================================================

export interface InvoiceStatus {
  issuedCount: number;
  issuedTotal: number;
  paidCount: number;
  paidTotal: number;
  pendingCount: number;
  pendingTotal: number;
  collectedPct: number;
  /** Facturas pendientes que ya pasaron de 7 dias desde su emision. */
  overdueCount: number;
  overdueTotal: number;
}

export function computeInvoiceStatus(opts: {
  documents: FiscalDocument[];
  asOf?: string;
  overdueDays?: number;
}): InvoiceStatus {
  const { documents, asOf = today(), overdueDays = 7 } = opts;

  // Solo facturas: los recibos de deposito y las notas de credito no son
  // cobro pendiente de nadie.
  const invoices = documents.filter(d => d.doc_type === 'INV' && d.status !== 'cancelled');
  const paid = invoices.filter(d => d.status === 'paid');
  const pending = invoices.filter(d => d.status === 'pending');
  const overdue = pending.filter(d => daysBetween(d.issue_date, asOf) > overdueDays);

  const sum = (list: FiscalDocument[]) => list.reduce((s, d) => s + Number(d.total || 0), 0);
  const issuedTotal = sum(invoices);
  const paidTotal = sum(paid);

  return {
    issuedCount: invoices.length,
    issuedTotal: round2(issuedTotal),
    paidCount: paid.length,
    paidTotal: round2(paidTotal),
    pendingCount: pending.length,
    pendingTotal: round2(sum(pending)),
    collectedPct: issuedTotal > 0 ? Math.round((paidTotal / issuedTotal) * 1000) / 10 : 0,
    overdueCount: overdue.length,
    overdueTotal: round2(sum(overdue)),
  };
}

// ================================================================
// ANTIGUEDAD DE FLOTA
// ================================================================

export interface FleetAge {
  count: number;
  avgDays: number;
  oldestDays: number;
  newestDays: number;
  buckets: { label: string; count: number; value: number }[];
  /** Sin fecha de compra ni alta: no se les puede calcular la edad. */
  unknown: number;
}

export function computeFleetAge(opts: {
  products: Product[];
  bikeCategoryId: string;
  asOf?: string;
}): FleetAge {
  const { products, bikeCategoryId, asOf = today() } = opts;

  const fleet = products.filter(p =>
    p.category_id === bikeCategoryId &&
    !SOLD_STATUSES.has(p.status) &&
    !LOST_STATUSES.has(p.status),
  );

  const aged = fleet
    .map(b => {
      const start = b.purchase_date || (b.date_added ? b.date_added.slice(0, 10) : '');
      return start ? { days: daysBetween(start, asOf), value: b.price_paid || 0 } : null;
    })
    .filter((x): x is { days: number; value: number } => x !== null);

  const defs: { label: string; min: number; max: number }[] = [
    { label: '< 6 meses', min: 0, max: 183 },
    { label: '6–12 meses', min: 183, max: 365 },
    { label: '1–2 años', min: 365, max: 730 },
    { label: '> 2 años', min: 730, max: Number.POSITIVE_INFINITY },
  ];

  return {
    count: fleet.length,
    avgDays: aged.length ? Math.round(aged.reduce((s, a) => s + a.days, 0) / aged.length) : 0,
    oldestDays: aged.length ? Math.max(...aged.map(a => a.days)) : 0,
    newestDays: aged.length ? Math.min(...aged.map(a => a.days)) : 0,
    buckets: defs.map(d => {
      const inB = aged.filter(a => a.days >= d.min && a.days < d.max);
      return { label: d.label, count: inB.length, value: round2(inB.reduce((s, a) => s + a.value, 0)) };
    }),
    unknown: fleet.length - aged.length,
  };
}

// ================================================================
// EFECTIVIDAD DEL DEPOSITO
// ================================================================

export interface DepositStats {
  withDeposit: number;
  withoutDeposit: number;
  avgDeposit: number;
  /** En garantia ahora mismo: es un pasivo, no un ingreso. */
  heldNow: number;
  closedCount: number;
  refunded: number;
  retained: number;
  retainedPct: number;
  damagedCount: number;
  /** Alquileres abiertos sin deposito: exposicion si el rider desaparece. */
  openWithoutDeposit: number;
  exposure: number;
}

export function computeDepositStats(opts: {
  rentals: Rental[];
}): DepositStats {
  const { rentals } = opts;

  const withDeposit = rentals.filter(r => (r.deposit_amount || 0) > 0);
  const open = rentals.filter(r => r.status !== 'Inactivo');
  const closed = rentals.filter(r => r.status === 'Inactivo' && !!r.end_date);

  const refunded = closed.reduce((s, r) => s + (r.deposit_refunded || 0), 0);
  const retained = closed.reduce((s, r) => s + Math.max(0, (r.deposit_amount || 0) - (r.deposit_refunded || 0)), 0);
  const closedDepositTotal = closed.reduce((s, r) => s + (r.deposit_amount || 0), 0);

  const openNoDep = open.filter(r => (r.deposit_amount || 0) === 0);

  return {
    withDeposit: withDeposit.length,
    withoutDeposit: rentals.length - withDeposit.length,
    avgDeposit: withDeposit.length
      ? round2(withDeposit.reduce((s, r) => s + (r.deposit_amount || 0), 0) / withDeposit.length)
      : 0,
    heldNow: round2(open.reduce((s, r) => s + (r.deposit_amount || 0), 0)),
    closedCount: closed.length,
    refunded: round2(refunded),
    retained: round2(retained),
    retainedPct: closedDepositTotal > 0 ? Math.round((retained / closedDepositTotal) * 1000) / 10 : 0,
    damagedCount: closed.filter(r => !!r.damage_report).length,
    openWithoutDeposit: openNoDep.length,
    // Una semana de tarifa es lo minimo que se pierde si desaparece.
    exposure: round2(openNoDep.reduce((s, r) => s + weeklyRate(r), 0)),
  };
}

// ================================================================
// RENTABILIDAD POR MODELO
// ================================================================

export interface ModelStats {
  model: string;
  units: number;
  invested: number;
  rentalIncome: number;
  soldValue: number;
  maintenanceCost: number;
  profit: number;
  roi: number;
  unitsSold: number;
  unitsActive: number;
  unitsLost: number;
  avgPerWeek: number;
}

/** Agrupa la rentabilidad por modelo: dice que conviene volver a comprar. */
export function computeModelStats(rows: BikeProfit[]): ModelStats[] {
  const groups = new Map<string, BikeProfit[]>();
  for (const r of rows) {
    const key = (r.name || '—').trim() || '—';
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const out: ModelStats[] = [];
  for (const [model, list] of groups) {
    const s = summarize(list);
    out.push({
      model,
      units: list.length,
      invested: s.invested,
      rentalIncome: s.rentalIncome,
      soldValue: round2(list.reduce((a, r) => a + r.soldPrice, 0)),
      maintenanceCost: s.maintenanceCost,
      profit: s.profit,
      roi: s.invested > 0 ? Math.round((s.profit / s.invested) * 1000) / 10 : 0,
      unitsSold: list.filter(r => r.segment === 'vendida').length,
      unitsActive: list.filter(r => r.segment === 'activa_con_deposito' || r.segment === 'activa_sin_deposito').length,
      unitsLost: list.filter(r => r.segment === 'perdida').length,
      avgPerWeek: s.avgPerWeek,
    });
  }
  return out.sort((a, b) => b.profit - a.profit);
}

// ================================================================
// CUENTAS DE REPARTO
//
// Ojo: estos ingresos NO se facturan a proposito. Son ingreso interno de
// la casa, no una venta a un cliente. Aqui solo se contabilizan.
// ================================================================

export interface DeliveryAccountStats {
  accountId: string;
  label: string;
  platform: string;
  active: boolean;
  assigned: boolean;
  weeklyRate: number;
  earnings: number;
  earningCount: number;
  lastEarning: string | null;
  weeksActive: number;
  perWeek: number;
}

export function computeDeliveryAccounts(opts: {
  accounts: AppAccount[];
  earnings: AppAccountEarning[];
  platforms: AppPlatform[];
  asOf?: string;
}): DeliveryAccountStats[] {
  const { accounts, earnings, platforms, asOf = today() } = opts;
  const platformById = new Map(platforms.map(p => [p.id, p.name]));

  return accounts.map(acc => {
    const mine = earnings.filter(e => e.account_id === acc.id);
    const dates = mine.map(e => e.date.slice(0, 10)).sort();
    const total = mine.reduce((s, e) => s + Number(e.amount || 0), 0);

    const from = acc.start_date || (dates.length ? dates[0] : null);
    const to = acc.end_date || asOf;
    const weeks = from ? daysBetween(from, to) / 7 : 0;

    return {
      accountId: acc.id,
      label: acc.platform_account_number || acc.username || acc.owner_name || acc.id.slice(0, 8),
      platform: platformById.get(acc.platform_id) ?? '—',
      active: acc.status === 'Activa',
      assigned: !!acc.current_renter_id,
      weeklyRate: Number(acc.weekly_rate || 0),
      earnings: round2(total),
      earningCount: mine.length,
      lastEarning: dates.length ? dates[dates.length - 1] : null,
      weeksActive: Math.round(weeks * 10) / 10,
      perWeek: weeks >= 1 ? round2(total / weeks) : 0,
    };
  }).sort((a, b) => b.earnings - a.earnings);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
