import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `                {!selectedProductId && prodFormCategory !== catBikeId && prodFormCategory !== catBattId && prodFormCategory !== catLockId && (`;
const replacementStr = `                {prodFormCategory !== catBikeId && prodFormCategory !== catBattId && prodFormCategory !== catLockId && (`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully updated generic article checkbox condition when editing!");
} else {
  // Try normalized replacement
  const normContent = content.replace(/\r\n/g, '\n');
  const normTarget = targetStr.replace(/\r\n/g, '\n');
  const normReplacement = replacementStr.replace(/\r\n/g, '\n');
  
  if (normContent.includes(normTarget)) {
    content = normContent.replace(normTarget, normReplacement).replace(/\n/g, '\r\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully updated generic article checkbox condition using normalized strings!");
  } else {
    console.error("Could not find the target checkbox condition string in App.tsx");
  }
}
