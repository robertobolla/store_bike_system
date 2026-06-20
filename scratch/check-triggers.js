import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking triggers on rentals...");
  // Query pg_trigger system catalog
  const { data, error } = await supabase.rpc('inspect_triggers'); 
  if (error) {
    // Let's try direct SQL via postgres system query using a SELECT query if allowed,
    // or querying allowed tables. Since we don't have direct SQL RPC by default,
    // we can try a simple query to get triggers or check if there is an edge function/webhook.
    console.log("RPC check failed:", error.message);
    
    // Let's query information_schema or pg_trigger if we can access it via a generic query?
    // Usually postgrest doesn't expose system tables unless configured.
    // Let's check if there's any file insupabase directory that describes a trigger or webhook.
  } else {
    console.log("Triggers:", data);
  }
}

check();
