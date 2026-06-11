import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env
let envContent = '';
if (fs.existsSync('.env.local')) {
  envContent = fs.readFileSync('.env.local', 'utf-8');
} else if (fs.existsSync('.env')) {
  envContent = fs.readFileSync('.env', 'utf-8');
}

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'bike_modifications',
  'financing_payments',
  'financing_plans',
  'sale_items',
  'sales',
  'quick_replies',
  'maintenance_records',
  'company_events',
  'app_account_earnings',
  'app_account_notes',
  'app_accounts',
  'app_vehicle_types',
  'app_platforms',
  'supplier_products',
  'suppliers',
  'leads',
  'lead_categories',
  'maintenance_expenses',
  'rental_payments',
  'rental_items',
  'rentals',
  'customers',
  'products',
  'custom_field_definitions',
  'categories',
  'serial_prefixes',
  'allowed_emails'
];

async function run() {
  console.log("Checking DB Connection and Data...");
  
  // 1. Show allowed emails
  const { data: allowed, error: errAllowed } = await supabase.from('allowed_emails').select('*');
  if (errAllowed) {
    console.error("Error fetching allowed_emails:", errAllowed);
  } else {
    console.log("Current Allowed Emails:");
    console.log(allowed);
  }

  // 2. Count rows in all tables
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${t}: Error (${error.message})`);
    } else {
      console.log(`Table ${t}: ${count} rows`);
    }
  }
}

run();
