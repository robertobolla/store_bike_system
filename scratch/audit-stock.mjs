import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();
const supabase = createClient(url, key);
const sum = (d) => Object.values(d || {}).reduce((a, b) => a + (Number(b) || 0), 0);
const SOLD = new Set(['Vendida', 'Financiada']);

const [{ data: products, error: e1 }, { data: sales, error: e2 }, { data: items, error: e3 }] = await Promise.all([
  supabase.from('products').select('id, serial_number, status, price_sold, sold_date, custom_field_values'),
  supabase.from('sales').select('id, sale_date, total_amount, status'),
  supabase.from('sale_items').select('id, sale_id, product_id, unit_price'),
]);
if (e1 || e2 || e3) { console.error(e1 || e2 || e3); process.exit(1); }

const pById = new Map(products.map(p => [p.id, p]));
const saleById = new Map(sales.map(s => [s.id, s]));
const itemsByProduct = new Map();
for (const it of items) {
  if (!itemsByProduct.has(it.product_id)) itemsByProduct.set(it.product_id, []);
  itemsByProduct.get(it.product_id).push(it);
}
const log = (arr, title) => {
  console.log(`\n=== ${title}: ${arr.length} ===`);
  arr.forEach(l => console.log('  ' + l));
};

console.log(`Products: ${products.length} | Sales: ${sales.length} | Sale items: ${items.length}`);

// 1. Orphan sale_items (product missing / null)
log(items.filter(it => !it.product_id || !pById.has(it.product_id))
  .map(it => `item ${it.id} sale=${it.sale_id} -> product_id=${it.product_id} (missing)`), '1. Orphan sale_items (producto inexistente)');

// 2. Sold/Financiada products WITHOUT a sale_item
log(products.filter(p => SOLD.has(p.status) && !itemsByProduct.has(p.id))
  .map(p => `${p.serial_number} [${p.status}] id=${p.id} sold_date=${p.sold_date} price=${p.price_sold}`), '2. Productos vendidos SIN sale_item');

// 3. Sold/Financiada rows que aún arrastran location_distribution con stock
log(products.filter(p => SOLD.has(p.status) && sum(p.custom_field_values?.location_distribution) > 0)
  .map(p => `${p.serial_number} [${p.status}] dist=${JSON.stringify(p.custom_field_values.location_distribution)}`), '3. Vendidos que arrastran distribucion de stock');

// 4. Sold products con price_sold o sold_date faltante
log(products.filter(p => SOLD.has(p.status) && (p.price_sold == null || !p.sold_date))
  .map(p => `${p.serial_number} [${p.status}] price_sold=${p.price_sold} sold_date=${p.sold_date}`), '4. Vendidos con precio/fecha faltante');

// 5. Disponibles con sold_date seteada (no deberian)
log(products.filter(p => p.status === 'Disponible' && p.sold_date)
  .map(p => `${p.serial_number} sold_date=${p.sold_date} price_sold=${p.price_sold}`), '5. Disponibles con sold_date (residuo)');

// 6. Distribuciones con cantidades <= 0
log(products.filter(p => {
  const d = p.custom_field_values?.location_distribution;
  return d && Object.values(d).some(v => Number(v) <= 0);
}).map(p => `${p.serial_number} dist=${JSON.stringify(p.custom_field_values.location_distribution)}`), '6. Distribuciones con cantidades <= 0');

// 7. Sale items apuntando a producto que NO esta vendido/financiado
log(items.filter(it => pById.has(it.product_id) && !SOLD.has(pById.get(it.product_id).status))
  .map(it => { const p = pById.get(it.product_id); return `item ${it.id} -> ${p.serial_number} [${p.status}] (deberia estar vendido)`; }),
  '7. Sale_items que apuntan a producto NO vendido');

// 8. Firma del bug punto 4: misma venta con >1 item del mismo serial (revisar manualmente)
const susp = [];
const itemsBySale = new Map();
for (const it of items) {
  if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
  itemsBySale.get(it.sale_id).push(it);
}
for (const [saleId, its] of itemsBySale) {
  const serials = {};
  for (const it of its) {
    const p = pById.get(it.product_id);
    if (!p) continue;
    serials[p.serial_number] = (serials[p.serial_number] || 0) + 1;
  }
  for (const [sn, n] of Object.entries(serials)) {
    if (n > 1) susp.push(`venta ${saleId} (${saleById.get(saleId)?.sale_date}) -> ${n}x "${sn}"`);
  }
}
log(susp, '8. Ventas con varias unidades del mismo serial (firma posible del bug, revisar)');

// 9. total_amount de la venta vs suma de sale_items
const mism = [];
for (const [saleId, its] of itemsBySale) {
  const s = saleById.get(saleId);
  if (!s) continue;
  const itemsSum = its.reduce((a, it) => a + Number(it.unit_price || 0), 0);
  if (Math.abs(itemsSum - Number(s.total_amount || 0)) > 0.5)
    mism.push(`venta ${saleId} (${s.sale_date}) total=${s.total_amount} vs suma_items=${itemsSum}`);
}
log(mism, '9. Ventas con total != suma de items');
