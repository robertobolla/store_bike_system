const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/accept="image\/\*"/g, 'accept="image/jpeg, image/png, image/webp"');
fs.writeFileSync('src/App.tsx', content);
console.log('Replaced accept attributes');
