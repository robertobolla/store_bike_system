import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://uykcffkwookeglnovffz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5a2NmZmt3b29rZWdsbm92ZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzkxMDgsImV4cCI6MjA5NDgxNTEwOH0.lkcjRtYRromBkn_WLajxaqplKrz3nIZuRQWShZinJdc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching delivery_checklists...");
  const { data, error } = await supabase
    .from('delivery_checklists')
    .select('*');

  if (error) {
    console.error("Error fetching:", error);
    return;
  }

  console.log(`Successfully fetched ${data.length} records.`);
  fs.writeFileSync('scratch/supabase_checklists_dump.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log("Dumped to scratch/supabase_checklists_dump.json");
}

run();
