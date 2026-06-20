import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fix() {
  console.log("Fixing database records for sold inflador...");
  
  const mainProductId = '41c53048-7deb-4b08-9017-1b2301c5c49f';
  const newSoldProductId = '97f3747d-ea3c-4dbe-a1c1-4b10b0b8c66e';
  const saleItemId = 'daeaa506-b7b6-4291-814f-03c19428212f';
  
  // 1. Fetch main product details
  const { data: mainProduct, error: pErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', mainProductId)
    .single();
    
  if (pErr) {
    console.error('Fetch main product error:', pErr);
    return;
  }
  
  // 2. Insert new sold product unit
  const newSoldProduct = {
    ...mainProduct,
    id: newSoldProductId,
    status: 'Vendida',
    price_sold: 1,
    sold_date: '2026-06-10',
    custom_field_values: {
      color: mainProduct.custom_field_values.color,
      location: 'Taller Dublin',
      condition: 'nuevo',
      assembly_date: null,
      location_date: null
    }
  };
  
  console.log('Inserting sold product unit...');
  const { error: insErr } = await supabase.from('products').insert(newSoldProduct);
  if (insErr) {
    console.error('Insert sold product error:', insErr);
    return;
  }
  
  // 3. Update sale item to point to new sold product id
  console.log('Updating sale item reference...');
  const { error: siErr } = await supabase
    .from('sale_items')
    .update({ product_id: newSoldProductId })
    .eq('id', saleItemId);
  if (siErr) {
    console.error('Update sale item error:', siErr);
    return;
  }
  
  // 4. Restore main product row to Disponible and update quantity distribution
  console.log('Restoring main product to Disponible...');
  const updatedMainProduct = {
    status: 'Disponible',
    price_sold: null,
    sold_date: null,
    custom_field_values: {
      ...mainProduct.custom_field_values,
      location_distribution: {
        "Oficina": 50,
        "Taller Dublin": 49
      }
    }
  };
  
  const { error: upErr } = await supabase
    .from('products')
    .update(updatedMainProduct)
    .eq('id', mainProductId);
  if (upErr) {
    console.error('Restore main product error:', upErr);
    return;
  }
  
  console.log('Database records fixed successfully!');
}

fix();
