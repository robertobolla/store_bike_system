import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: categories, error: catErr } = await supabase.from('categories').select('*');
  console.log('--- CATEGORIES ---');
  console.log(categories);

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*, product_models(*)');
  
  if (prodErr) {
    console.error(prodErr);
    return;
  }

  console.log('\n--- DISPONIBLE PRODUCTS ---');
  products.forEach(p => {
    if (p.status === 'Disponible') {
      console.log(`ID: ${p.id}, SN: ${p.serial_number}, Model: ${p.product_models?.brand} ${p.product_models?.model_name}, CategoryID: ${p.product_models?.category_id || p.category_id}`);
    }
  });
}

check();
