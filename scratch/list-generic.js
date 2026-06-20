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

  console.log('\n--- ALL PRODUCTS (GENERIC / UNCONSOLIDATED) ---');
  if (products && products.length > 0) {
    console.log("Found", products.length, "products. Printing all:");
    products.forEach(p => {
      console.log(JSON.stringify(p));
    });
  } else {
    console.log("No products found.");
  }
}

check();
