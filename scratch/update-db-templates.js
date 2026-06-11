import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runUpdate() {
  const { data: templates, error: fetchErr } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_key', 'app_account_assigned');

  if (fetchErr) {
    console.error('Error fetching templates:', fetchErr);
    return;
  }

  console.log(`Fetched ${templates.length} templates. Starting update...`);

  for (const t of templates) {
    const lines = t.body_text.split('\n');
    const filteredLines = lines.filter(
      line => !line.includes('{{ACCOUNT_USERNAME}}') && !line.includes('{{ACCOUNT_PASSWORD}}')
    );
    const newBody = filteredLines.join('\n');

    console.log(`Updating ${t.language}...`);
    const { error: updateErr } = await supabase
      .from('email_templates')
      .update({ body_text: newBody })
      .eq('id', t.id);

    if (updateErr) {
      console.error(`Error updating template ${t.id} (${t.language}):`, updateErr);
    } else {
      console.log(`Successfully updated ${t.language} template!`);
    }
  }

  console.log('Done!');
}

runUpdate();
