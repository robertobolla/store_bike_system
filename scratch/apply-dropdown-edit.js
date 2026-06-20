import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const addRemoveButtons = `
                                              {isConsolidated && (
                                                <>
                                                  <button
                                                    className="dropdown-item"
                                                    style={{ 
                                                      width: '100%', 
                                                      textAlign: 'left', 
                                                      background: 'transparent', 
                                                      border: 'none', 
                                                      borderRadius: '6px', 
                                                      padding: '8px 12px', 
                                                      fontSize: '12px', 
                                                      color: 'var(--text-muted)', 
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '8px',
                                                      transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => {
                                                      setActiveStockMenuId(null);
                                                      setSelectedProductId(prod.id);
                                                      setGenStockQty(1);
                                                      setGenStockLocation('Almacén Central');
                                                      setGenStockCost(prod.price_paid || 0);
                                                      setAddGenStockModalOpen(true);
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                                      e.currentTarget.style.color = 'var(--text-bright)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.background = 'transparent';
                                                      e.currentTarget.style.color = 'var(--text-muted)';
                                                    }}
                                                  >
                                                    ➕ \${language === 'es' ? 'Agregar existencias' : 'Add Stock'}
                                                  </button>
                                                  <button
                                                    className="dropdown-item"
                                                    style={{ 
                                                      width: '100%', 
                                                      textAlign: 'left', 
                                                      background: 'transparent', 
                                                      border: 'none', 
                                                      borderRadius: '6px', 
                                                      padding: '8px 12px', 
                                                      fontSize: '12px', 
                                                      color: 'var(--text-muted)', 
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '8px',
                                                      transition: 'all 0.2s ease'
                                                    }}
                                                    onClick={() => {
                                                      setActiveStockMenuId(null);
                                                      setSelectedProductId(prod.id);
                                                      setGenStockQty(1);
                                                      const distObj = (prod.custom_field_values?.location_distribution as Record<string, number>) || {};
                                                      const locs = Object.keys(distObj).filter(k => distObj[k] > 0);
                                                      setGenStockLocation(locs[0] || 'Almacén Central');
                                                      setRemoveGenStockModalOpen(true);
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                                      e.currentTarget.style.color = 'var(--text-bright)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.background = 'transparent';
                                                      e.currentTarget.style.color = 'var(--text-muted)';
                                                    }}
                                                  >
                                                    ➖ \${language === 'es' ? 'Quitar existencias' : 'Remove Stock'}
                                                  </button>
                                                </>
                                              )}
`;

// Target only the first two occurrences
let occurrence = 0;
content = content.replace(/(✏️ \{t\.edit\}\s*<\/button>)/g, (match) => {
  occurrence++;
  if (occurrence <= 2) {
    console.log(`Replacing occurrence ${occurrence}`);
    return match + addRemoveButtons;
  }
  return match;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated App.tsx!");
