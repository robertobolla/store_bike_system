// Carga masiva de productos desde CSV / Excel / Google Sheets.
//
// Este modulo es puro: recibe filas ya leidas (por la libreria xlsx en el
// componente) y las valida contra el inventario. No toca red ni DOM.
// Vive aparte y con pruebas porque es la parte que falla en silencio: una
// columna mal mapeada o una fecha mal interpretada mete decenas de
// productos torcidos de una sola vez, y deshacerlo a mano es peor que el
// trabajo que la carga masiva venia a ahorrar.

// ================================================================
// COLUMNAS DE LA PLANTILLA
// El encabezado canonico es el español. Se aceptan variantes y el ingles
// como alias, porque un Excel exportado o traducido no tiene por que
// traer el texto exacto.
// ================================================================
export interface ColumnSpec {
  key: string;          // nombre interno
  header: string;       // encabezado canonico que se escribe en la plantilla
  aliases: string[];    // otros encabezados que se aceptan al leer
  required?: boolean;
  help: string;         // se imprime en la hoja de instrucciones
  example: string;      // valor de ejemplo en la plantilla
}

export const COLUMNS: ColumnSpec[] = [
  { key: 'serial',   header: 'Código',        aliases: ['codigo', 'code', 'serial', 'serial number', 'sku'], required: true,
    help: 'Código único del artículo (ej. B-021). Para bicicletas, uno por unidad.', example: 'B-101' },
  { key: 'category', header: 'Categoría',     aliases: ['categoria', 'category', 'rubro'], required: true,
    help: 'Debe coincidir con una categoría existente (Bicicleta, Batería, Candado, Accesorios…).', example: 'Bicicleta' },
  { key: 'brand',    header: 'Marca',         aliases: ['marca', 'brand'],
    help: 'Marca del artículo.', example: 'ENGWE' },
  { key: 'model',    header: 'Modelo',        aliases: ['modelo', 'model'],
    help: 'Modelo del artículo.', example: 'M20' },
  { key: 'quantity', header: 'Cantidad',      aliases: ['cantidad', 'qty', 'quantity', 'unidades'],
    help: 'Cantidad. Por defecto 1. Si es mayor a 1, se crea como stock consolidado (accesorios). Las bicicletas van de a una por fila con su código.', example: '1' },
  { key: 'price',    header: 'Precio compra', aliases: ['precio compra', 'precio', 'price', 'purchase price', 'costo', 'coste'],
    help: 'Precio de compra por unidad, en euros. Acepta coma o punto decimal.', example: '650' },
  { key: 'status',   header: 'Estado',        aliases: ['estado', 'status'],
    help: 'Disponible, Rentada, Mantenimiento, Vendida, Perdida, Financiada, Robada, Uso Interno. Por defecto Disponible.', example: 'Disponible' },
  { key: 'odometer', header: 'Odómetro (km)', aliases: ['odometro (km)', 'odometro', 'odometer', 'km', 'kilometraje'],
    help: 'Kilómetros del odómetro. Por defecto 0.', example: '0' },
  { key: 'color',    header: 'Color',         aliases: ['color', 'colour'],
    help: 'Color en texto o en formato #RRGGBB.', example: 'Negro' },
  { key: 'purchase', header: 'Fecha compra',  aliases: ['fecha compra', 'purchase date', 'fecha de compra'],
    help: 'Fecha de compra en formato dd/mm/aaaa.', example: '15/01/2026' },
  { key: 'arrival',  header: 'Fecha llegada', aliases: ['fecha llegada', 'arrival date', 'fecha de llegada'],
    help: 'Fecha de llegada en formato dd/mm/aaaa.', example: '' },
  { key: 'weekly',   header: 'Tarifa semanal sug.', aliases: ['tarifa semanal sug.', 'tarifa semanal', 'weekly rate', 'suggested weekly rate'],
    help: 'Tarifa semanal sugerida de alquiler, en euros.', example: '70' },
  { key: 'deposit',  header: 'Depósito sug.', aliases: ['deposito sug.', 'deposito', 'deposit', 'suggested deposit'],
    help: 'Depósito sugerido, en euros.', example: '100' },
  { key: 'location', header: 'Ubicación',     aliases: ['ubicacion', 'location', 'almacen', 'almacén'],
    help: 'Ubicación del stock. Solo se usa cuando la cantidad es mayor a 1. Por defecto Almacén Central.', example: 'Almacén Central' },
  { key: 'notes',    header: 'Notas',         aliases: ['notas', 'notes', 'observaciones'],
    help: 'Notas libres.', example: '' },
];

const ALLOWED_STATUS = [
  'Disponible', 'Rentada', 'Mantenimiento', 'Vendida',
  'Perdida', 'Financiada', 'Robada', 'Perdida/Garda', 'Uso Interno',
];

// Alias de estado en ingles y variantes, hacia el valor canonico español.
const STATUS_ALIASES: Record<string, string> = {
  available: 'Disponible', disponible: 'Disponible',
  rented: 'Rentada', rentada: 'Rentada', alquilada: 'Rentada',
  maintenance: 'Mantenimiento', mantenimiento: 'Mantenimiento',
  sold: 'Vendida', vendida: 'Vendida',
  lost: 'Perdida', perdida: 'Perdida',
  financed: 'Financiada', financiada: 'Financiada',
  stolen: 'Robada', robada: 'Robada',
  'internal use': 'Uso Interno', 'uso interno': 'Uso Interno',
};

export interface CategoryLite { id: string; name_es: string; name_en: string; }

export interface ProductDraft {
  serial: string;
  categoryId: string;
  categoryName: string;
  brand: string;
  model: string;
  quantity: number;
  price: number;
  status: string;
  odometer: number;
  color: string;
  purchaseDate: string | null;   // yyyy-mm-dd
  arrivalDate: string | null;
  weeklyRate: number;
  deposit: number;
  location: string;
  notes: string;
}

export interface RowIssue {
  row: number;        // numero de fila tal como lo ve el usuario (1 = primera fila de datos)
  serial: string;
  message: string;
}

export interface ParseResult {
  drafts: ProductDraft[];
  issues: RowIssue[];
}

// El BOM se quita a proposito: Excel guarda los CSV con marca de orden de
// bytes, y esa marca invisible se pega al PRIMER encabezado. Sin quitarla,
// "Código" llega como "﻿Código" y la primera columna —que es la
// obligatoria— no se reconoce, con un error que no se ve en pantalla.
function norm(s: unknown): string {
  return String(s ?? '').replace(/^﻿/, '').trim().toLowerCase();
}

// Empareja cada encabezado del archivo con una columna conocida.
export function mapHeaders(headers: string[]): Map<number, string> {
  const out = new Map<number, string>();
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    const col = COLUMNS.find(c => norm(c.header) === n || c.aliases.some(a => norm(a) === n));
    if (col) out.set(i, col.key);
  });
  return out;
}

// Convierte a numero tolerando '€', espacios y coma decimal. Devuelve null
// si el texto no es un numero; el llamador decide si eso es un error o un
// campo opcional vacio.
export function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/[€$\s]/g, '');
  if (s === '') return null;
  // Coma como decimal solo si no hay punto (formato español "60,50"). Si
  // hay ambos, se asume el punto como decimal y la coma como miles.
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

// Normaliza una fecha a 'yyyy-mm-dd'. Acepta objetos Date (los que da la
// libreria de Excel), 'dd/mm/aaaa', 'dd-mm-aaaa' y 'aaaa-mm-dd'.
export function coerceDate(value: unknown): { value: string | null; ok: boolean } {
  if (value === null || value === undefined || value === '') return { value: null, ok: true };

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return { value: null, ok: false };
    return { value: `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`, ok: true };
  }

  const s = String(value).trim();
  // yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return validDate(+y, +mo, +d);
  }
  // dd/mm/yyyy o dd-mm-yyyy
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return validDate(+y, +mo, +d);
  }
  return { value: null, ok: false };
}

function validDate(y: number, mo: number, d: number): { value: string | null; ok: boolean } {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { value: null, ok: false };
  return { value: `${y}-${pad2(mo)}-${pad2(d)}`, ok: true };
}

function coerceStatus(value: unknown): string | null {
  const n = norm(value);
  if (!n) return 'Disponible';
  const exact = ALLOWED_STATUS.find(s => norm(s) === n);
  if (exact) return exact;
  return STATUS_ALIASES[n] ?? null;
}

/**
 * Valida y normaliza filas ya leidas del archivo.
 *
 * Cada fila es un objeto {encabezado: valor}. Se resuelve la categoria
 * contra las existentes (por nombre ES o EN), se rechazan los codigos
 * repetidos —dentro del archivo y contra el inventario actual— y se
 * comprueban numeros, fechas y estado. Las filas con problemas se
 * devuelven en issues y NO entran en drafts: la importacion nunca mete a
 * medias una fila dudosa.
 */
export function parseProductRows(
  rows: Record<string, unknown>[],
  ctx: { categories: CategoryLite[]; existingSerials: string[] },
): ParseResult {
  const drafts: ProductDraft[] = [];
  const issues: RowIssue[] = [];

  const catByName = new Map<string, CategoryLite>();
  ctx.categories.forEach(c => {
    if (c.name_es) catByName.set(norm(c.name_es), c);
    if (c.name_en) catByName.set(norm(c.name_en), c);
  });

  const yaExiste = new Set(ctx.existingSerials.map(s => norm(s)));
  const enEsteArchivo = new Set<string>();

  rows.forEach((raw, idx) => {
    const numeroFila = idx + 1;
    // Se leen las celdas por cualquiera de los alias del encabezado.
    const get = (key: string): unknown => {
      const col = COLUMNS.find(c => c.key === key)!;
      for (const k of Object.keys(raw)) {
        const n = norm(k);
        if (n === norm(col.header) || col.aliases.some(a => norm(a) === n)) return raw[k];
      }
      return undefined;
    };

    const serial = String(get('serial') ?? '').trim();
    const categoryRaw = String(get('category') ?? '').trim();

    // Fila completamente vacia: se ignora en silencio (colas de hojas).
    const algo = COLUMNS.some(c => String(get(c.key) ?? '').trim() !== '');
    if (!algo) return;

    const problemas: string[] = [];

    if (!serial) problemas.push('falta el Código');
    else if (enEsteArchivo.has(norm(serial))) problemas.push(`Código repetido en el archivo: ${serial}`);
    else if (yaExiste.has(norm(serial))) problemas.push(`el Código ${serial} ya existe en el inventario`);

    let category: CategoryLite | undefined;
    if (!categoryRaw) {
      problemas.push('falta la Categoría');
    } else {
      category = catByName.get(norm(categoryRaw));
      if (!category) problemas.push(`Categoría desconocida: "${categoryRaw}"`);
    }

    const qtyN = coerceNumber(get('quantity'));
    let quantity = 1;
    if (qtyN !== null) {
      if (!Number.isInteger(qtyN) || qtyN < 1) problemas.push('la Cantidad debe ser un entero mayor o igual a 1');
      else quantity = qtyN;
    }

    const priceN = coerceNumber(get('price'));
    if (get('price') !== undefined && get('price') !== '' && priceN === null) problemas.push('Precio compra no es un número');

    const odoN = coerceNumber(get('odometer'));
    if (get('odometer') !== undefined && get('odometer') !== '' && odoN === null) problemas.push('Odómetro no es un número');

    const weeklyN = coerceNumber(get('weekly'));
    const depositN = coerceNumber(get('deposit'));

    const status = coerceStatus(get('status'));
    if (status === null) problemas.push(`Estado no válido: "${String(get('status'))}"`);

    const purchase = coerceDate(get('purchase'));
    if (!purchase.ok) problemas.push('Fecha compra no válida (usar dd/mm/aaaa)');
    const arrival = coerceDate(get('arrival'));
    if (!arrival.ok) problemas.push('Fecha llegada no válida (usar dd/mm/aaaa)');

    if (serial) enEsteArchivo.add(norm(serial));

    if (problemas.length > 0) {
      issues.push({ row: numeroFila, serial, message: problemas.join('; ') });
      return;
    }

    drafts.push({
      serial,
      categoryId: category!.id,
      categoryName: category!.name_es || category!.name_en,
      brand: String(get('brand') ?? '').trim(),
      model: String(get('model') ?? '').trim(),
      quantity,
      price: priceN ?? 0,
      status: status!,
      odometer: odoN ?? 0,
      color: String(get('color') ?? '').trim(),
      purchaseDate: purchase.value,
      arrivalDate: arrival.value,
      weeklyRate: weeklyN ?? 0,
      deposit: depositN ?? 0,
      location: String(get('location') ?? '').trim() || 'Almacén Central',
      notes: String(get('notes') ?? '').trim(),
    });
  });

  return { drafts, issues };
}

// ================================================================
// LECTURA DE CSV
//
// El CSV se parsea aqui y no con la libreria de Excel a proposito. Su
// parser de CSV tipa las celdas por su cuenta y con formato español se
// equivoca: "650,50" lo lee como el numero 65050, tomando la coma por
// separador de miles. Un precio de 650,50 entrando como 65050 es
// corrupcion silenciosa, y en una carga masiva se multiplica por cada
// fila del archivo.
//
// Aca todo sale como texto y lo convierten coerceNumber/coerceDate, que
// si distinguen la coma decimal del separador de miles.
// ================================================================

// Coma o punto y coma. Excel en configuracion regional española exporta
// los CSV separados por punto y coma, no por coma: se decide por cual de
// los dos aparece mas veces en la linea de encabezados.
function detectSeparator(firstLine: string): string {
  let comas = 0, puntoYComa = 0, dentroDeComillas = false;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') dentroDeComillas = !dentroDeComillas;
    else if (!dentroDeComillas && c === ',') comas++;
    else if (!dentroDeComillas && c === ';') puntoYComa++;
  }
  return puntoYComa > comas ? ';' : ',';
}

/**
 * Parsea un CSV a filas {encabezado: texto}.
 *
 * Respeta los campos entre comillas, las comas y saltos de linea dentro
 * de ellos, y las comillas escapadas ("").  Todo se devuelve como string:
 * la conversion a numero o fecha la hace el validador, que conoce el
 * formato español.
 */
export function parseCsv(text: string): Record<string, unknown>[] {
  const limpio = text.replace(/^﻿/, '');
  if (limpio.trim() === '') return [];

  const sep = detectSeparator(limpio.split(/\r?\n/, 1)[0] ?? '');

  const filas: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];

    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; }  // comilla escapada
        else enComillas = false;
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') { enComillas = true; continue; }
    if (c === sep) { fila.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue; }
    campo += c;
  }
  // Ultima celda / ultima fila si el archivo no termina en salto de linea.
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila); }

  if (filas.length === 0) return [];
  const headers = filas[0].map(h => h.trim());
  return filas.slice(1).map(f => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = (f[i] ?? '').trim(); });
    return obj;
  });
}

// ================================================================
// PLANTILLA
//
// Los ejemplos y la lista de categorias validas se construyen con las
// categorias REALES del proyecto, no con nombres fijos. Las categorias
// las edita el usuario ("Accesorio" y no "Accesorios", y puede haber
// otras propias), asi que una plantilla con nombres inventados se
// descargaria con un ejemplo que la propia importacion rechaza.
// ================================================================

// Elige la categoria que mejor encaja con un patron, o la primera que
// haya. Sirve para que los ejemplos usen nombres que existen de verdad.
function pickCategory(names: string[], pattern: RegExp): string {
  return names.find(n => pattern.test(n)) ?? names[0] ?? '';
}

export function buildTemplateAoA(categoryNames: string[] = []): (string | number)[][] {
  const headers = COLUMNS.map(c => c.header);
  const catBici = pickCategory(categoryNames, /bici|bicycle|bike/i);
  const catAcc = pickCategory(categoryNames, /accesor|accessor/i);

  // Primer ejemplo: una unidad con codigo propio (caso bicicleta).
  const ejemplo1 = COLUMNS.map(c => (c.key === 'category' ? catBici : c.example));
  // Segundo ejemplo: stock con cantidad (caso accesorio).
  const ejemplo2 = COLUMNS.map(c => {
    switch (c.key) {
      case 'serial': return 'APA-050';
      case 'category': return catAcc;
      case 'brand': return 'Genérico';
      case 'model': return 'Casco';
      case 'quantity': return '20';
      case 'price': return '15';
      case 'status': return 'Disponible';
      case 'location': return 'Almacén Central';
      default: return '';
    }
  });
  return [headers, ejemplo1, ejemplo2];
}

// Filas de la hoja de instrucciones de la plantilla.
export function buildInstructionsAoA(categoryNames: string[] = []): string[][] {
  const filas: string[][] = [
    ['Carga masiva de productos — instrucciones'],
    [''],
    ['1. Completá la hoja "Productos". Una fila por artículo.'],
    ['2. Borrá las filas de ejemplo antes de subir.'],
    ['3. Guardá como Excel o CSV y subilo, o compartí el Google Sheet por link.'],
    ['4. Las columnas Código y Categoría son obligatorias.'],
    ['5. Un Código que ya exista en el inventario se rechaza; no se sobrescribe nada.'],
    [''],
    ['Categorías válidas (escribilas igual):'],
    ...(categoryNames.length > 0 ? categoryNames.map(n => [n]) : [['(no hay categorías cargadas)']]),
    [''],
    ['Columna', 'Obligatoria', 'Detalle'],
  ];
  COLUMNS.forEach(c => filas.push([c.header, c.required ? 'Sí' : 'No', c.help]));
  return filas;
}
