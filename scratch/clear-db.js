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

// Child-to-Parent order to respect Foreign Key constraints
const tablesToClear = [
  'bike_modifications',
  'financing_payments',
  'financing_plans',
  'sale_items',
  'sales',
  'rental_payments',
  'rental_items',
  'maintenance_expenses',
  'maintenance_records',
  'rentals',
  'products',
  'customers',
  'app_account_earnings',
  'app_account_notes',
  'app_accounts',
  'supplier_products',
  'suppliers',
  'leads',
  'company_events',
  'quick_replies'
];

async function clearDatabase() {
  console.log("Starting database cleanup...");
  
  for (const table of tablesToClear) {
    console.log(`Clearing table: ${table}...`);
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`Error clearing ${table}:`, error.message);
    } else {
      console.log(`Successfully cleared ${table}.`);
    }
  }
  
  console.log("\nCleanup finished!");
}

clearDatabase();
