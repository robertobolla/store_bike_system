import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: rentals, error: rentErr } = await supabase
    .from('rentals')
    .select('*');
  
  if (rentErr) {
    console.error(rentErr);
    return;
  }

  console.log('--- ALL RENTALS ---');
  rentals.forEach(r => {
    console.log(`ID: ${r.id}, BikeID: ${r.bike_id}, CustomerID: ${r.customer_id}, Status: ${r.status}`);
  });
}

check();
