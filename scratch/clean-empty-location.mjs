import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();
const supabase = createClient(url, key);

const APPLY = process.argv.includes('--apply');

const sum = (d) => Object.values(d || {}).reduce((a, b) => a + (Number(b) || 0), 0);

const { data, error } = await supabase.from('products').select('id, serial_number, custom_field_values, status');
if (error) { console.error('Fetch error:', error); process.exit(1); }

const targets = (data || []).filter(p => {
  const cfv = p.custom_field_values || {};
  const dist = cfv.location_distribution;
  const hasDistField = dist !== undefined && dist !== null;       // emptied consolidated row
  const isEmpty = hasDistField && sum(dist) <= 0;                 // no real stock
  const hasLocation = !!cfv.location;                             // but still carries a location
  return isEmpty && hasLocation;
});

console.log(`Total products: ${data.length}`);
console.log(`Rows with empty stock but a stale location: ${targets.length}\n`);
for (const p of targets) {
  console.log(`  ${p.serial_number}  [${p.status}]  location="${p.custom_field_values.location}"  dist=${JSON.stringify(p.custom_field_values.location_distribution)}`);
}

if (!APPLY) {
  console.log('\n(DRY RUN — no changes written. Re-run with --apply to clean.)');
  process.exit(0);
}

console.log('\nApplying cleanup...');
let ok = 0;
for (const p of targets) {
  const newCfv = { ...p.custom_field_values, location: null, location_distribution: {} };
  const { error: upErr } = await supabase.from('products').update({ custom_field_values: newCfv }).eq('id', p.id);
  if (upErr) { console.error(`  FAIL ${p.serial_number}:`, upErr.message); }
  else { ok++; }
}
console.log(`Cleaned ${ok}/${targets.length} rows.`);
