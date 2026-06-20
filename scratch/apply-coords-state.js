import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Insert state
const stateTarget = `  const [genStockCost, setGenStockCost] = useState(0);`;
const stateCode = `\n  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);`;

if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateTarget + stateCode);
  console.log("State inserted successfully!");
} else {
  console.error("State target not found!");
}

// 2. Insert useEffect for scroll
const effectTarget = `  useEffect(() => {
    if (session) {
      fetchWhitelist();
    }
  }, [session, fetchWhitelist]);`;

const effectCode = `

  useEffect(() => {
    const handleScroll = () => {
      setActiveStockMenuId(null);
      setMenuCoords(null);
    };
    if (activeStockMenuId) {
      window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    }
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [activeStockMenuId]);`;

if (content.includes(effectTarget)) {
  content = content.replace(effectTarget, effectTarget + effectCode);
  console.log("Effect inserted successfully!");
} else {
  console.error("Effect target not found!");
}

fs.writeFileSync(filePath, content, 'utf8');
