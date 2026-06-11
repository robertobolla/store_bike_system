import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function update() {
  console.log("Updating existing records to 'efectivo'...");

  // Update sales
  const { data: sData, error: sErr } = await supabase
    .from('sales')
    .update({ received_via: 'efectivo' })
    .is('received_via', null);
  if (sErr) console.error('Sales update error:', sErr);
  else console.log('Sales updated successfully.');

  // Update rentals
  const { data: rData, error: rErr } = await supabase
    .from('rentals')
    .update({ deposit_received_via: 'efectivo' })
    .is('deposit_received_via', null);
  if (rErr) console.error('Rentals update error:', rErr);
  else console.log('Rentals updated successfully.');

  // Update financing payments
  const { data: fData, error: fErr } = await supabase
    .from('financing_payments')
    .update({ received_via: 'efectivo' })
    .is('received_via', null)
    .eq('status', 'Pagada');
  if (fErr) console.error('Financing payments update error:', fErr);
  else console.log('Financing payments updated successfully.');

  // Update rental payments
  const { data: pData, error: pErr } = await supabase
    .from('rental_payments')
    .update({ received_via: 'efectivo' })
    .is('received_via', null);
  if (pErr) console.error('Rental payments update error:', pErr);
  else console.log('Rental payments updated successfully.');
}

update();
