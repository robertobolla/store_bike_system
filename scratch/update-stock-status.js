import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// We want to replace the redundant:
// return displayStatus === 'Mantenimiento'
//   ? (language === 'es' ? 'En Taller' : 'In Shop')
//   : displayStatus;
// in the second occurrence.

const target = /return\s+displayStatus\s*===\s*'Mantenimiento'\s*\?\s*\(language\s*===\s*'es'\s*\?\s*'En Taller'\s*:\s*'In Shop'\)\s*:\s*displayStatus\s*;/;

const match = content.match(target);
console.log('Matches found:', match ? match.length : 0);

if (match) {
  content = content.replace(target, 'return displayStatus;');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully cleaned up App.tsx!');
} else {
  console.log('Error: target not found.');
}
