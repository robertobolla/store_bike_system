import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `  const [kitSearchQuery, setKitSearchQuery] = useState('');`;

const statesCode = `
  // Generic Stock addition/removal states
  const [addGenStockModalOpen, setAddGenStockModalOpen] = useState(false);
  const [removeGenStockModalOpen, setRemoveGenStockModalOpen] = useState(false);
  const [genStockQty, setGenStockQty] = useState(1);
  const [genStockLocation, setGenStockLocation] = useState('Almacén Central');
  const [genStockCost, setGenStockCost] = useState(0);`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, targetStr + statesCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully added generic stock states!");
} else {
  console.error("Could not find kitSearchQuery state in App.tsx");
}
