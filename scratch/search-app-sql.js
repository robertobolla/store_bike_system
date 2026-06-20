import fs from 'fs';

const appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = appTsx.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('trigger') || line.toLowerCase().includes('webhook')) {
    // Only print lines that are not triggerReload
    if (!line.includes('triggerReload')) {
      console.log(`Line ${idx + 1}: ${line}`);
    }
  }
});
