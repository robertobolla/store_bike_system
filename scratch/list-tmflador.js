import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: products, error } = await supabase
    .from('products')
    .select('*');
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${products.length} products total:`);
    console.log(JSON.stringify(products, null, 2));
  }
}

run();
