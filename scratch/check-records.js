import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking maintenance_records...");
  const { data: records, error: rErr } = await supabase.from('maintenance_records').select('*');
  if (rErr) {
    console.error('Error querying maintenance_records:', rErr.message);
    return;
  }
  
  if (records.length > 0) {
    const bikeId = records[0].bike_id;
    console.log("Record bike_id:", bikeId);
    const { data: bike, error: bErr } = await supabase.from('products').select('*').eq('id', bikeId).single();
    if (bErr) {
      console.error('Error querying product:', bErr.message);
    } else {
      console.log('Product details:', {
        id: bike.id,
        serial_number: bike.serial_number,
        maintenance_status: bike.maintenance_status,
        next_service_date: bike.next_service_date,
        last_service_date: bike.last_service_date
      });
    }
  } else {
    console.log("No records found.");
  }
}

check();
