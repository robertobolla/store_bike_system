import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: products, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error('Products error:', error);
  } else {
    console.log('Products columns:', products && products[0] ? Object.keys(products[0]) : 'No rows');
  }

  const { data: models, error: err2 } = await supabase.from('product_models').select('*').limit(1);
  if (err2) {
    console.error('Models error:', err2);
  } else {
    console.log('Models columns:', models && models[0] ? Object.keys(models[0]) : 'No rows');
  }
}

check();
