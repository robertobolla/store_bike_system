import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking if category_id exists in serial_prefixes...");
  const { data, error } = await supabase.from('serial_prefixes').select('id, category_id').limit(1);
  if (error) {
    console.error('Error querying category_id:', error.message);
  } else {
    console.log('Successfully queried category_id! Column exists.');
  }
}

check();
