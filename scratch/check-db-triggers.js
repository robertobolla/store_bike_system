import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Attempting to query information_schema via postgrest...");
  try {
    const { data, error } = await supabase
      .from('pg_trigger')
      .select('*');
    if (error) {
      console.log("Failed to query pg_trigger directly:", error.message);
    } else {
      console.log("pg_trigger results:", data);
    }
  } catch (e) {
    console.log("Exception:", e);
  }
}

check();
