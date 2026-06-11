import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking tables...");
  
  // Test sales
  const { data: sales, error: sErr } = await supabase.from('sales').select('*').limit(1);
  if (sErr) console.error('Sales query error:', sErr);
  else console.log('Sales fields:', sales[0] ? Object.keys(sales[0]) : 'No sales records found');

  // Test rentals
  const { data: rentals, error: rErr } = await supabase.from('rentals').select('*').limit(1);
  if (rErr) console.error('Rentals query error:', rErr);
  else console.log('Rentals fields:', rentals[0] ? Object.keys(rentals[0]) : 'No rentals records found');

  // Test financing_payments
  const { data: finPay, error: fErr } = await supabase.from('financing_payments').select('*').limit(1);
  if (fErr) console.error('Financing payments query error:', fErr);
  else console.log('Financing payments fields:', finPay[0] ? Object.keys(finPay[0]) : 'No financing payments found');

  // Test rental_payments
  const { data: rentPay, error: pErr } = await supabase.from('rental_payments').select('*').limit(1);
  if (pErr) console.error('Rental payments query error:', pErr);
  else console.log('Rental payments fields:', rentPay[0] ? Object.keys(rentPay[0]) : 'No rental payments found');
}

check();
