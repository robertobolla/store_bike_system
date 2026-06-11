import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*, product_models(*)');
  
  if (prodErr) {
    console.error(prodErr);
    return;
  }

  console.log('\n--- ALL BICYCLE PRODUCTS ---');
  products.forEach(p => {
    const isBike = p.product_models?.category_id === '7202f87c-d456-4f73-b585-47f26ff4b620' || p.category_id === '7202f87c-d456-4f73-b585-47f26ff4b620';
    if (isBike) {
      console.log(`ID: ${p.id}, SN: ${p.serial_number}, Model: ${p.product_models?.brand} ${p.product_models?.model_name}, Status: ${p.status}`);
    }
  });
}

check();
