import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Checking allowed_emails table...");
  
  // 1. Try a test insert
  const testEmail = 'test_manager_temp_' + Math.floor(Math.random() * 10000) + '@example.com';
  console.log(`Inserting test manager email: ${testEmail}`);
  const { data, error } = await supabase
    .from('allowed_emails')
    .insert({ email: testEmail, role: 'manager' })
    .select();
    
  if (error) {
    console.error('INSERT ERROR:', error);
  } else {
    console.log('INSERT SUCCESS:', data);
    
    // Clean up
    const { error: delError } = await supabase
      .from('allowed_emails')
      .delete()
      .eq('email', testEmail);
    if (delError) {
      console.error('Cleanup delete error:', delError);
    } else {
      console.log('Cleanup success');
    }
  }
}

test();
