import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
  console.log("Fetching products for migration...");
  const { data, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  console.log(`Loaded ${data.length} products. Checking for 'bat_applied' key...`);
  
  let migrateCount = 0;
  for (const p of data) {
    if (p.custom_field_values && p.custom_field_values.bat_applied !== undefined) {
      const val = p.custom_field_values.bat_applied;
      const updatedCustom = { ...p.custom_field_values };
      
      // Rename key
      updatedCustom.vat_applied = val;
      delete updatedCustom.bat_applied;
      
      const { error: updateErr } = await supabase
        .from('products')
        .update({ custom_field_values: updatedCustom })
        .eq('id', p.id);
        
      if (updateErr) {
        console.error(`Error updating product ${p.serial_number}:`, updateErr);
      } else {
        migrateCount++;
      }
    }
  }
  
  console.log(`Migration complete! Successfully migrated ${migrateCount} products to use 'vat_applied'.`);
}

migrate();
