import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchTemplates() {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_key', 'app_account_assigned');

  if (error) {
    console.error('Error fetching templates:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

fetchTemplates();
