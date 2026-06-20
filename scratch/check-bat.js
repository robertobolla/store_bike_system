import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('products').select('id, serial_number, custom_field_values');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  const matches = data.filter(p => p.custom_field_values && p.custom_field_values.bat_applied !== undefined);
  console.log(`Found ${matches.length} products with 'bat_applied' key in custom_field_values.`);
  matches.forEach(p => {
    console.log(`- Product ID: ${p.id}, Serial: ${p.serial_number}, custom_field_values:`, p.custom_field_values);
  });
}

check();
