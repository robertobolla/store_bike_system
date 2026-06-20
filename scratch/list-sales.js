import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: sales, error: sErr } = await supabase.from('sales').select('*');
  const { data: saleItems, error: siErr } = await supabase.from('sale_items').select('*');
  
  console.log('Sales:', sales);
  console.log('Sale Items:', saleItems);
}

run();
