import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');
for (let i = 10899; i < 10905; i++) {
  console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
}
