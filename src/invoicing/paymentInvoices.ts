// Enlace entre un cobro registrado y la factura que lo documenta.
//
// No hay clave foranea entre rental_payments y documents: la factura se
// emite en un paso aparte del registro del pago (y a veces la emitio el
// cron dias antes, quedando pendiente hasta que se confirma el cobro).
// El vinculo se reconstruye por los tres datos que ambos comparten:
// alquiler, fecha de cobro e importe.
//
// Vive fuera del componente para poder probarlo: es logica de
// emparejamiento, del tipo que falla en silencio cuando se rompe.

import type { FiscalDocument } from './types';

export interface PayableRecord {
  id: string;
  rental_id: string;
  payment_date: string;
  amount: number;
  // Enlace real, guardado al emitir. Los cobros anteriores a que se
  // empezara a escribir no lo tienen, y para esos sigue el emparejado
  // por importe y fecha.
  document_id?: string | null;
}

function clave(rentalId: string, date: string, amount: number): string {
  return `${rentalId}|${date.slice(0, 10)}|${Number(amount).toFixed(2)}`;
}

/**
 * Devuelve, por id de pago, la factura que lo documenta.
 *
 * Si el cobro trae document_id, manda ese: es el enlace real y funciona
 * aunque los importes no coincidan, que es justo lo que pasa cuando el
 * rider paga la semana y un casco en el mismo movimiento (cobro de 70,
 * factura de 120).
 *
 * Para los cobros historicos, que se registraron antes de que se guardara
 * el enlace, se sigue adivinando por alquiler, fecha e importe. Solo
 * entran facturas (INV) con fecha de cobro: una factura emitida y aun
 * pendiente no corresponde a ningun pago todavia.
 *
 * Cada factura se asigna a un unico pago. Sin eso, dos cobros del mismo
 * importe el mismo dia apuntarian los dos a la primera factura y el
 * segundo mostraria un numero que no le corresponde.
 */
export function matchInvoicesToPayments(
  documents: FiscalDocument[],
  payments: PayableRecord[],
): Map<string, FiscalDocument> {
  const porId = new Map(documents.map(d => [d.id, d]));

  const resultado = new Map<string, FiscalDocument>();
  const yaUsados = new Set<string>();
  for (const p of payments) {
    const doc = p.document_id ? porId.get(p.document_id) : undefined;
    if (doc) {
      resultado.set(p.id, doc);
      yaUsados.add(doc.id);
    }
  }

  const disponibles = new Map<string, FiscalDocument[]>();
  for (const d of documents) {
    if (d.doc_type !== 'INV' || !d.rental_id || !d.payment_date) continue;
    // Una factura ya enlazada a su cobro no puede volver a asignarse por
    // parecido a un cobro distinto.
    if (yaUsados.has(d.id)) continue;
    const k = clave(d.rental_id, d.payment_date, d.total);
    const lista = disponibles.get(k);
    if (lista) lista.push(d);
    else disponibles.set(k, [d]);
  }

  // Las candidatas de cada grupo se ordenan por numero para que el
  // reparto no dependa del orden en que la base devolvio las filas.
  for (const lista of disponibles.values()) {
    lista.sort((a, b) => a.number.localeCompare(b.number));
  }

  const ordenados = [...payments].sort(
    (a, b) => a.payment_date.localeCompare(b.payment_date) || a.id.localeCompare(b.id),
  );
  for (const p of ordenados) {
    if (resultado.has(p.id)) continue;
    const doc = disponibles.get(clave(p.rental_id, p.payment_date, p.amount))?.shift();
    if (doc) resultado.set(p.id, doc);
  }
  return resultado;
}
