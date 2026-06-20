import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target the fixed position dropdown menus for activeStockMenuId
// We will replace the style block of:
//   position: 'fixed',
//   top: (menuCoords.top + 220 > window.innerHeight) ...
//   left: `${Math.max(8, menuCoords.left + menuCoords.width - 150)}px`,
//   transform: ...
//   right: 'auto',
//   ...
//   minWidth: '150px',
//   zIndex: 100,

const oldStyleRegex = /position:\s*'fixed',\s*top:\s*\(menuCoords\.top\s*\+\s*220\s*>\s*window\.innerHeight\)\s*\?\s*`\$\{menuCoords\.top\s*-\s*4\}px`\s*:\s*`\$\{menuCoords\.top\s*\+\s*menuCoords\.height\s*\+\s*4\}px`,\s*left:\s*`\$\{Math\.max\(8,\s*menuCoords\.left\s*\+\s*menuCoords\.width\s*-\s*150\)\}px`,\s*transform:\s*\(menuCoords\.top\s*\+\s*220\s*>\s*window\.innerHeight\)\s*\?\s*'translateY\(-100%\)'\s*:\s*'none',\s*right:\s*'auto',\s*background:\s*'rgba\(23,\s*23,\s*37,\s*0\.98\)',\s*backdropFilter:\s*'blur\(12px\)',\s*WebkitBackdropFilter:\s*'blur\(12px\)',\s*border:\s*'1px solid rgba\(255,\s*255,\s*255,\s*0\.08\)',\s*borderRadius:\s*'8px',\s*padding:\s*'6px',\s*minWidth:\s*'150px',\s*zIndex:\s*100,/gi;

const newStyle = `position: 'fixed', 
                                                 top: (menuCoords.top + 320 > window.innerHeight)
                                                   ? \`\${menuCoords.top - 4}px\` 
                                                   : \`\${menuCoords.top + menuCoords.height + 4}px\`,
                                                 left: 'auto',
                                                 right: \`\${window.innerWidth - (menuCoords.left + menuCoords.width)}px\`,
                                                 transform: (menuCoords.top + 320 > window.innerHeight) ? 'translateY(-100%)' : 'none',
                                                 background: 'rgba(23, 23, 37, 0.98)', 
                                                 backdropFilter: 'blur(12px)',
                                                 WebkitBackdropFilter: 'blur(12px)',
                                                 border: '1px solid rgba(255, 255, 255, 0.08)', 
                                                 borderRadius: '8px', 
                                                 padding: '6px', 
                                                 minWidth: '160px', 
                                                 zIndex: 1200,`;

let count = 0;
// Test if regex matches
const matches = content.match(oldStyleRegex);
if (matches) {
  count = matches.length;
  content = content.replace(oldStyleRegex, newStyle);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully updated ${count} occurrences of stock dropdown style in App.tsx!`);
} else {
  console.error("Could not match the old dropdown style using regex. Attempting direct string replacement...");
  
  // Fallback direct string replacement (ignoring exact spacing if needed)
  // Let's do a simpler match/replace loop
  let updated = false;
  const targetStr = "top: (menuCoords.top + 220 > window.innerHeight)";
  if (content.includes(targetStr)) {
    // We can do a line-by-line or chunk replacement
    // Since we know exactly where it is, let's replace the properties individually
    content = content.replace(/top:\s*\(menuCoords\.top\s*\+\s*220\s*>\s*window\.innerHeight\)\s*\?\s*`\$\{menuCoords\.top\s*-\s*4\}px`\s*:\s*`\$\{menuCoords\.top\s*\+\s*menuCoords\.height\s*\+\s*4\}px`,/g, 
      "top: (menuCoords.top + 320 > window.innerHeight) ? `${menuCoords.top - 4}px` : `${menuCoords.top + menuCoords.height + 4}px`,");
      
    content = content.replace(/left:\s*`\$\{Math\.max\(8,\s*menuCoords\.left\s*\+\s*menuCoords\.width\s*-\s*150\)\}px`,/g,
      "left: 'auto',");
      
    content = content.replace(/transform:\s*\(menuCoords\.top\s*\+\s*220\s*>\s*window\.innerHeight\)\s*\?\s*'translateY\(-100%\)'\s*:\s*'none',/g,
      "transform: (menuCoords.top + 320 > window.innerHeight) ? 'translateY(-100%)' : 'none',");
      
    content = content.replace(/right:\s*'auto',/g, (match, offset) => {
      // Only replace right: 'auto' if it's near position: 'fixed' dropdowns
      // To be safe, let's insert right: `${window.innerWidth - (menuCoords.left + menuCoords.width)}px`
      // We can just find the place and replace. Since we changed left to 'auto', let's replace:
      // "left: 'auto',\r\n                                                 transform: (menuCoords.top + 320 > window.innerHeight) ? 'translateY(-100%)' : 'none',\r\n                                                 right: 'auto',"
      return match; // We will handle it more precisely below
    });
    
    // Let's do a direct multi-line replacement by targeting the exact text chunks
    // For dropdown 1:
    const target1 = `                                                 top: (menuCoords.top + 220 > window.innerHeight)
                                                   ? \`\${menuCoords.top - 4}px\` 
                                                   : \`\${menuCoords.top + menuCoords.height + 4}px\`,
                                                 left: \`\${Math.max(8, menuCoords.left + menuCoords.width - 150)}px\`,
                                                 transform: (menuCoords.top + 220 > window.innerHeight) ? 'translateY(-100%)' : 'none',
                                                 right: 'auto', 
                                                 background: 'rgba(23, 23, 37, 0.98)', 
                                                 backdropFilter: 'blur(12px)',
                                                 WebkitBackdropFilter: 'blur(12px)',
                                                 border: '1px solid rgba(255, 255, 255, 0.08)', 
                                                 borderRadius: '8px', 
                                                 padding: '6px', 
                                                 minWidth: '150px', 
                                                 zIndex: 100,`;
                                                 
    const replacement1 = `                                                 top: (menuCoords.top + 320 > window.innerHeight)
                                                   ? \`\${menuCoords.top - 4}px\` 
                                                   : \`\${menuCoords.top + menuCoords.height + 4}px\`,
                                                 left: 'auto',
                                                 right: \`\${window.innerWidth - (menuCoords.left + menuCoords.width)}px\`,
                                                 transform: (menuCoords.top + 320 > window.innerHeight) ? 'translateY(-100%)' : 'none',
                                                 background: 'rgba(23, 23, 37, 0.98)', 
                                                 backdropFilter: 'blur(12px)',
                                                 WebkitBackdropFilter: 'blur(12px)',
                                                 border: '1px solid rgba(255, 255, 255, 0.08)', 
                                                 borderRadius: '8px', 
                                                 padding: '6px', 
                                                 minWidth: '160px', 
                                                 zIndex: 1200,`;

    // Handle line endings gracefully (replace all CRLF with LF for matching, then write back)
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const normTarget1 = target1.replace(/\r\n/g, '\n');
    const normReplacement1 = replacement1.replace(/\r\n/g, '\n');
    
    if (normalizedContent.includes(normTarget1)) {
      // Replace all occurrences (since both dropdown style blocks are identical)
      const parts = normalizedContent.split(normTarget1);
      console.log(`Found ${parts.length - 1} occurrences using normalized match!`);
      const updatedContent = parts.join(normReplacement1);
      // Restore CRLF for Windows compatibility
      fs.writeFileSync(filePath, updatedContent.replace(/\n/g, '\r\n'), 'utf8');
      console.log("Successfully updated App.tsx using normalized strings!");
      updated = true;
    } else {
      console.error("Normalized target string not found!");
    }
  } else {
    console.error("targetStr not found!");
  }
}
