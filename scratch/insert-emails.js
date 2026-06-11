import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env
let envContent = '';
if (fs.existsSync('.env.local')) {
  envContent = fs.readFileSync('.env.local', 'utf-8');
} else if (fs.existsSync('.env')) {
  envContent = fs.readFileSync('.env', 'utf-8');
}

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emailsToInsert = [
  'emiliano.aguicorv@gmail.com',
  'robertobolla9@gmail.com'
];

async function insertEmails() {
  console.log("Inserting whitelist emails...");
  
  for (const email of emailsToInsert) {
    const { data, error } = await supabase
      .from('allowed_emails')
      .insert({ email: email.toLowerCase() })
      .select('*');
      
    if (error) {
      console.error(`Error inserting ${email}:`, error.message);
    } else {
      console.log(`Successfully added:`, data);
    }
  }
  
  console.log("Finished inserting emails!");
}

insertEmails();
