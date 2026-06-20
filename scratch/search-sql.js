import fs from 'fs';

const sql = fs.readFileSync('supabase_schema.sql', 'utf-8');
const lines = sql.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('trigger') || line.toLowerCase().includes('webhook')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
