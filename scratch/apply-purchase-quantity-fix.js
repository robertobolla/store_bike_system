import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `        purchaseGroups[groupKey].quantity += 1;`;

const replacementStr = `        const dist = (p.custom_field_values?.location_distribution as Record<string, number>) || {};
        const isCons = !!p.custom_field_values?.location_distribution;
        const rowQty = isCons ? Object.values(dist).reduce((a, b) => a + b, 0) : 1;
        purchaseGroups[groupKey].quantity += rowQty;`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully fixed purchaseGroups quantity in App.tsx!");
} else {
  console.error("Could not find the target string in App.tsx");
}
