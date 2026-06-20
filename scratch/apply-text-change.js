import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const target = `🔧 {language === 'es' ? 'Programar Service' : 'Schedule Service'}`;
const replacement = `🔧 {language === 'es' ? 'Editar Service' : 'Edit Service'}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("SUCCESS: Replaced text successfully!");
} else {
  console.error("ERROR: Target text not found in App.tsx");
}
