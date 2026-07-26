// Alarmas de stock: cuantas unidades hay de un articulo y cuales de sus
// alarmas hay que disparar.
//
// Vive fuera del componente porque es la parte que puede fallar en
// silencio: si el recuento se desvia, la alarma avisa cuando no toca o
// -peor- se queda callada cuando el articulo ya se agoto.

// Estados que significan "esta unidad ya no esta en stock". Vendida y
// Financiada salieron por venta; el resto se perdieron. Ninguna cuenta
// para el aviso: la gracia de la alarma es avisar de lo que queda.
const FUERA_DE_STOCK = [
  'Vendida', 'Financiada', 'Robada', 'Perdida', 'Perdida/Garda',
] as const;

export interface StockUnit {
  status: string;
  custom_field_values?: Record<string, unknown> | null;
}

export interface StockAlarmRecord {
  id: string;
  product_key: string;
  label: string;
  threshold: number;
  notify_email: string;
  active: boolean;
  last_notified_qty: number | null;
}

/**
 * Unidades que quedan de un articulo.
 *
 * Un articulo son varias filas que comparten serial_number. Hay dos
 * formas de contar segun como se dio de alta el lote:
 *
 *  - Consolidado: la fila lleva location_distribution, un reparto por
 *    ubicacion ({'Almacen': 3, 'Taller': 1}); la cantidad es la suma.
 *  - Suelto: cada fila es una unidad y se cuentan las filas.
 *
 * En los dos casos se descartan antes las unidades que ya no estan en
 * stock, que es lo que hace que vender una baje el numero.
 *
 * Ojo: un location_distribution vacio ({}) no es "una unidad sin
 * reparto", es un lote agotado. Cuenta 0, no 1.
 */
export function stockOnHand(group: StockUnit[]): number {
  const vivos = group.filter(u => !FUERA_DE_STOCK.includes(u.status as typeof FUERA_DE_STOCK[number]));

  // El formato lo marca el lote entero, incluidas las filas ya vendidas:
  // si se mira solo a las vivas, un lote consolidado cuyas unidades
  // vivas perdieron el campo se contaria como suelto y daria de mas.
  const esConsolidado = group.some(u => u.custom_field_values?.location_distribution != null);
  if (!esConsolidado) return vivos.length;

  let total = 0;
  for (const u of vivos) {
    const dist = u.custom_field_values?.location_distribution as Record<string, number> | undefined;
    if (dist != null) {
      total += Object.values(dist).reduce((a, b) => a + (Number(b) || 0), 0);
    } else if (u.custom_field_values?.location) {
      // Fila suelta dentro de un lote consolidado (p.ej. una unidad que
      // se separo del lote): vale por una.
      total += 1;
    }
  }
  return total;
}

/** Cantidad en stock por SKU, a partir de la lista completa de productos. */
export function stockBySku(products: (StockUnit & { serial_number: string })[]): Map<string, number> {
  const grupos = new Map<string, (StockUnit & { serial_number: string })[]>();
  for (const p of products) {
    if (!p.serial_number) continue;
    const g = grupos.get(p.serial_number);
    if (g) g.push(p);
    else grupos.set(p.serial_number, [p]);
  }
  const out = new Map<string, number>();
  for (const [sku, g] of grupos) out.set(sku, stockOnHand(g));
  return out;
}

export interface AlarmDecision {
  alarm: StockAlarmRecord;
  qty: number;
  /** Ha caido al umbral y la alarma esta armada: hay que avisar. */
  disparar: boolean;
  /** Se ha repuesto por encima del umbral: hay que volver a armarla. */
  rearmar: boolean;
}

/**
 * Decide, para cada alarma, si toca avisar o re-armar.
 *
 * Se avisa cuando la cantidad es <= umbral (con umbral 5, quedarse en 5
 * ya avisa) y la alarma esta armada. Armada significa que no se ha
 * avisado nunca, o que el ultimo aviso se dio con el stock por encima
 * del umbral, o sea que se repuso y ha vuelto a caer. Sin eso, el correo
 * saldria otra vez en cada recarga mientras el stock siga bajo.
 *
 * Un SKU sin ninguna unidad no se evalua: casi siempre significa que la
 * alarma quedo apuntando a un articulo que ya no existe, y avisar de
 * "quedan 0" de algo borrado seria ruido. Aparecen en skusDesconocidos
 * para poder señalarlo en la interfaz.
 */
export function evaluateAlarms(
  alarms: StockAlarmRecord[],
  cantidades: Map<string, number>,
): { decisiones: AlarmDecision[]; skusDesconocidos: string[] } {
  const decisiones: AlarmDecision[] = [];
  const desconocidos = new Set<string>();

  for (const alarm of alarms) {
    if (!alarm.active) continue;
    if (!cantidades.has(alarm.product_key)) {
      desconocidos.add(alarm.product_key);
      continue;
    }
    const qty = cantidades.get(alarm.product_key)!;
    const armada = alarm.last_notified_qty === null || alarm.last_notified_qty > alarm.threshold;
    decisiones.push({
      alarm,
      qty,
      disparar: qty <= alarm.threshold && armada,
      rearmar: qty > alarm.threshold && !armada,
    });
  }
  return { decisiones, skusDesconocidos: [...desconocidos] };
}
