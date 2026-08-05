// Dias de cobro de los alquileres, para pintarlos en el calendario.
//
// Estos dias NO se guardan como eventos. El intento anterior si lo hacia
// -- un "🚲 Pago Alquiler" creado al dar de alta el alquiler -- y fallaba
// de las dos maneras posibles: se creaba UNO solo, el del primer
// vencimiento, y nunca se actualizaba, asi que seguia diciendo
// "Pendiente" despues de veinte semanas cobradas. El motor de
// notificaciones ya lo daba por perdido y lo filtraba a mano.
//
// Aca se derivan del estado actual, igual que las notificaciones. Para
// saber si un periodo esta cobrado se mira, en este orden:
//
//   1. La factura de ese periodo: documents INV con billing_period_start
//      igual al dia de cobro. Es el dato fiscal, y si dice 'paid' esta
//      cobrado, haya o no un rental_payment (el dinero pudo entrar por
//      otro camino y marcarse sobre la factura).
//   2. Si el alquiler no se factura solo -- auto_invoice apagado, tarifa
//      diaria o mensual, o la facturacion todavia sin migrar -- el cobro
//      registrado dentro del periodo.
//
// Vive fuera del componente para poder probarlo: son cuentas de fechas y
// de dinero, del tipo que falla en silencio cuando se rompe.

import type { Customer, Product, Rental, RentalPayment } from '../db';
import type { FiscalDocument } from '../invoicing/types';

const DAY = 86_400_000;

/** Tope de periodos proyectados por alquiler. Un start_date corrupto no
 *  puede poner al navegador a generar fechas para siempre. */
const MAX_PERIODS = 500;

export type RateType = 'diario' | 'semanal' | 'mensual';

export type RentalPaymentStatus =
  /** Cobrado: hay factura pagada, o un cobro dentro del periodo. */
  | 'paid'
  /** Impago: la fecha ya paso y no hay ni factura pagada ni cobro. */
  | 'overdue'
  /** Todavia no toca: vence hoy o mas adelante. */
  | 'upcoming';

export interface RentalPaymentDay {
  /** Estable: identifica el cobro concreto, alquiler + dia. */
  id: string;
  rental_id: string;
  /** Dia de cobro, ISO yyyy-mm-dd. */
  date: string;
  amount: number;
  status: RentalPaymentStatus;
  rider: string;
  bike: string;
  /** Numero de la factura del periodo, si ya se emitio. */
  invoice_number: string | null;
  /** Dia en que entro el dinero, si entro. */
  paid_on: string | null;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Suma un periodo a una fecha.
 *
 * El mensual usa aritmetica de calendario y no 30 dias: un alquiler que
 * arranca el 31 de enero vence el 28 de febrero, no el 2 de marzo. Y el
 * mes siguiente vuelve al 31, no se queda pegado en el 28.
 */
export function addPeriod(date: string, rate: RateType, anchorDay?: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (rate !== 'mensual') {
    return iso(new Date(Date.UTC(y, m - 1, d) + (rate === 'diario' ? 1 : 7) * DAY));
  }
  const target = anchorDay ?? d;
  const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(target, lastOfNext))));
}

/**
 * Los dias de cobro de un alquiler que caen dentro de [from, to].
 *
 * La serie arranca en el inicio del alquiler y avanza de periodo en
 * periodo, pero se engancha a next_invoice_date en cuanto la alcanza:
 * esa columna es la que mira el cron, y salta hacia adelante cuando se
 * reanuda un alquiler que estuvo parado por un aviso de devolucion. Sin
 * el enganche, los dias futuros quedarian corridos respecto de lo que la
 * facturacion va a hacer de verdad.
 */
function dueDates(
  r: Rental,
  rate: RateType,
  invoiceDates: string[],
  from: string,
  to: string,
): string[] {
  // Las fechas ya facturadas son hechos, no proyecciones: entran siempre.
  const out = new Set(invoiceDates.filter(d => d >= from && d <= to));

  // Un alquiler terminado no genera vencimientos nuevos. Solo queda lo
  // que efectivamente se facturo mientras estuvo vivo.
  if (r.status === 'Inactivo') return [...out].sort();

  // Un alquiler con fin pactado tampoco se proyecta mas alla de esa fecha.
  const limit = r.end_date && r.end_date.slice(0, 10) < to ? r.end_date.slice(0, 10) : to;

  const anchor = r.next_invoice_date ? r.next_invoice_date.slice(0, 10) : null;
  const anchorDay = Number((anchor ?? r.start_date).slice(8, 10));

  let d = r.start_date.slice(0, 10);
  let snapped = false;

  for (let i = 0; i < MAX_PERIODS && d <= limit; i++) {
    if (anchor && !snapped && d >= anchor) {
      snapped = true;
      d = anchor;
    }
    if (d >= from) out.add(d);
    d = addPeriod(d, rate, anchorDay);
  }

  return [...out].sort();
}

export interface BuildRentalPaymentDaysInput {
  rentals: Rental[];
  customers: Customer[];
  products: Product[];
  payments: RentalPayment[];
  documents: FiscalDocument[];
  /** Rango visible del calendario, ambos inclusive. */
  from: string;
  to: string;
  asOf?: string;
}

export function buildRentalPaymentDays(input: BuildRentalPaymentDaysInput): RentalPaymentDay[] {
  const { rentals, customers, products, payments, documents, from, to, asOf = todayISO() } = input;

  const out: RentalPaymentDay[] = [];

  for (const r of rentals) {
    const rate = (r.rate_type ?? 'semanal') as RateType;

    // Facturas del alquiler indexadas por el dia que cubren. Una anulada
    // no representa ningun cobro ni ninguna obligacion.
    const invoices = new Map<string, FiscalDocument>();
    for (const doc of documents) {
      if (doc.doc_type !== 'INV') continue;
      if (doc.rental_id !== r.id) continue;
      if (!doc.billing_period_start) continue;
      if (doc.status === 'cancelled') continue;
      invoices.set(doc.billing_period_start.slice(0, 10), doc);
    }

    // Cobros que son de la renta. Un casco o una reparacion se registran
    // en la misma tabla con el concepto "Otro: ..." y no cancelan la
    // semana: si contaran, un rider que compro una luz apareceria al dia.
    const rentPayments = payments.filter(p =>
      p.rental_id === r.id && !String(p.payment_method ?? '').startsWith('Otro:'),
    );

    const cust = customers.find(c => c.id === r.customer_id);
    const rider = cust ? `${cust.first_name ?? ''} ${cust.last_name ?? ''}`.trim() : '';
    const bike = products.find(p => p.id === r.bike_id)?.serial_number ?? '';
    const anchorDay = Number((r.next_invoice_date ?? r.start_date).slice(8, 10));

    for (const date of dueDates(r, rate, [...invoices.keys()], from, to)) {
      const periodEnd = addPeriod(date, rate, anchorDay);
      const inv = invoices.get(date) ?? null;

      let status: RentalPaymentStatus;
      let paidOn: string | null = null;

      if (inv && inv.status === 'paid') {
        status = 'paid';
        paidOn = inv.payment_date ? inv.payment_date.slice(0, 10) : null;
      } else {
        const hit = rentPayments.find(p => {
          const pd = String(p.payment_date ?? '').slice(0, 10);
          return pd >= date && pd < periodEnd;
        });
        if (hit) {
          status = 'paid';
          paidOn = String(hit.payment_date).slice(0, 10);
        } else {
          status = date < asOf ? 'overdue' : 'upcoming';
        }
      }

      out.push({
        id: `rent-${r.id}-${date}`,
        rental_id: r.id,
        date,
        amount: inv ? Number(inv.total ?? 0) : Number(r.rental_rate ?? 0),
        status,
        rider,
        bike,
        invoice_number: inv?.number ?? null,
        paid_on: paidOn,
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.rider.localeCompare(b.rider));
}
