import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore the rental menu click handler that was corrupted
const targetCorruptedRentalClick = `                                            onClick={(e) => {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setMenuCoords({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height });
                                              setActiveRentalMenuId(activeRentalMenuId === bike.id ? null : bike.id);
                                            }}`;

const restoredRentalClick = `                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveRentalMenuId(activeRentalMenuId === bike.id ? null : bike.id);
                                            }}`;

if (content.includes(targetCorruptedRentalClick)) {
  content = content.replace(targetCorruptedRentalClick, restoredRentalClick);
  console.log("Successfully restored rental menu click handler!");
} else {
  // Let's try normalizing line endings to find it
  const normContent = content.replace(/\r\n/g, '\n');
  const normTarget = targetCorruptedRentalClick.replace(/\r\n/g, '\n');
  const normRestore = restoredRentalClick.replace(/\r\n/g, '\n');
  if (normContent.includes(normTarget)) {
    content = normContent.replace(normTarget, normRestore).replace(/\n/g, '\r\n');
    console.log("Successfully restored rental menu click handler using normalized strings!");
  } else {
    console.error("Could not find the corrupted rental click handler to restore.");
  }
}

// 2. Define activeStockMenuProduct and activeStockMenuData states
// We will put it right after menuCoords definition:
const coordsTarget = `  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);`;
const computedStatesCode = `
  const activeStockMenuProduct = useMemo(() => {
    if (!activeStockMenuId) return null;
    return products.find(p => p.id === activeStockMenuId) || null;
  }, [activeStockMenuId, products]);

  const activeStockMenuData = useMemo(() => {
    if (!activeStockMenuProduct) return null;
    const prod = activeStockMenuProduct;
    const isConsolidated = !!prod.custom_field_values?.location_distribution;
    const group = products.filter(p => p.serial_number === prod.serial_number);
    const totalCount = isConsolidated
      ? Object.values(prod.custom_field_values.location_distribution as Record<string, number>).reduce((a, b) => a + b, 0)
      : group.length;
    const hasRentals = group.some(p => rentals.some(r => r.bike_id === p.id && r.status === 'activo'));
    return { prod, group, isConsolidated, totalCount, hasRentals };
  }, [activeStockMenuProduct, products, rentals]);`;

if (content.includes(coordsTarget)) {
  content = content.replace(coordsTarget, coordsTarget + computedStatesCode);
  console.log("Successfully inserted activeStockMenuProduct and activeStockMenuData useMemos!");
} else {
  console.error("Could not find coordsTarget to insert useMemos.");
}

// 3. Remove both inline stock dropdowns.
// We can do this by using a normalized regex replacement that matches from '{activeStockMenuId === prod.id && menuCoords && ('
// all the way to ')}' enclosing the dropdown structure.
// Let's normalize content line endings first.
let normContent = content.replace(/\r\n/g, '\n');

// Let's build a regex for the dropdown block.
// Since the block contains many buttons and nested braces, let's target the exact structure:
// From '{activeStockMenuId === prod.id && menuCoords && (' to ')}'
// Let's find index of the start and trace braces to make sure we remove the exact block.
function removeInlineDropdowns(str) {
  let output = str;
  const targetStr = '{activeStockMenuId === prod.id && menuCoords && (';
  
  let index = output.indexOf(targetStr);
  while (index !== -1) {
    // Find matching closing brace for the JS expression
    // The expression starts with '{' (at index) and ends with '}'
    let braceCount = 1;
    let endIdx = index + 1;
    while (braceCount > 0 && endIdx < output.length) {
      if (output[endIdx] === '{') braceCount++;
      else if (output[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    console.log(`Found an occurrence of stock dropdown to remove at index ${index}. Length: ${endIdx - index}`);
    // Replace this block with empty string
    output = output.substring(0, index) + output.substring(endIdx);
    
    // Find next
    index = output.indexOf(targetStr);
  }
  return output;
}

const beforeLen = normContent.length;
normContent = removeInlineDropdowns(normContent);
const afterLen = normContent.length;

if (beforeLen !== afterLen) {
  console.log(`Successfully removed inline stock dropdowns! Removed ${beforeLen - afterLen} characters.`);
} else {
  console.error("Failed to remove inline stock dropdowns.");
}

// 4. Append the global stock dropdown code at the bottom of App return body (right before the whitelist modal or final return container)
const whitelistTarget = `{whitelistModalOpen && (`;
const globalDropdownCode = `
      {/* ===== GLOBAL STOCK ACTIONS DROPDOWN ===== */}
      {activeStockMenuId && menuCoords && activeStockMenuData && (() => {
        const { prod, group, isConsolidated, totalCount, hasRentals } = activeStockMenuData;
        return (
          <>
            {/* Click-away overlay */}
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 1190, cursor: 'default' }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveStockMenuId(null);
                setMenuCoords(null);
              }}
            />
            {/* Dropdown Menu */}
            <div 
              style={{ 
                position: 'fixed', 
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
                zIndex: 1200, 
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
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
                  openProductModal(prod);
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
                ✏️ {t.edit}
              </button>
              
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
                    ➕ {language === 'es' ? 'Agregar existencias' : 'Add Stock'}
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
                    ➖ {language === 'es' ? 'Quitar existencias' : 'Remove Stock'}
                  </button>
                </>
              )}

              {prod.status !== 'Vendida' && prod.status !== 'Financiada' && (
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
                      setSelectedLocation((prod.custom_field_values?.location as string) || '');
                      setSelectedLocationDate((prod.custom_field_values?.location_date as string) || new Date().toISOString().split('T')[0]);
                      setModalType('changeLocation');
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
                    📍 {language === 'es' ? 'Ubicación' : 'Location'}
                  </button>

                  {(prod.category_id === catBikeId || prod.category_id === catBattId) && (
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
                        setSelectedCondition(prod.condition || 'bueno');
                        setModalType('changeCondition');
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
                      ✨ {language === 'es' ? 'Condición' : 'Condition'}
                    </button>
                  )}
                </>
              )}

              {(prod.category_id === catBikeId || prod.category_id === catBattId) && (prod.status || '') !== 'Vendida' && (
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
                    setModalType('bikeHistory');
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
                  🔧 Service
                </button>
              )}

              {prod.category_id === catBikeId && (
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
                    setModalType('bikeModifications');
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
                  🛠️ {language === 'es' ? 'Modificaciones' : 'Modifications'}
                </button>
              )}

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
                  setActiveNoteProduct(prod);
                  setActiveNoteProductGroup(group);
                  setProductNotesText(prod.notes || '');
                  setModalType('productNotes');
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
                📝 {language === 'es' ? 'Notas' : 'Notes'}
              </button>

              <button 
                className="dropdown-item-danger"
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  background: 'transparent', 
                  border: 'none', 
                  borderRadius: '6px', 
                  padding: '8px 12px', 
                  fontSize: '12px', 
                  color: 'rgba(239, 68, 68, 0.85)', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  marginTop: '4px',
                  paddingTop: '8px'
                }}
                onClick={async () => {
                  setActiveStockMenuId(null);
                  const confirmMsg = totalCount > 1 
                    ? (language === 'es' ? \`⚠️ ¿Eliminar TODAS las \${totalCount} unidades de este lote?\` : \`⚠️ Delete ALL \${totalCount} units of this batch?\`)
                    : (language === 'es' ? '¿Eliminar este producto del inventario?' : 'Delete this product from inventory?');
                  
                  if (hasRentals) {
                    if (!confirm(language === 'es' ? '⚠️ Este lote/producto tiene alquileres activos. ¿Eliminar de todos modos?' : '⚠️ This batch/product has active rentals. Delete anyway?')) return;
                  } else {
                    if (!confirm(confirmMsg)) return;
                  }

                  try {
                    await Promise.all(group.map(p => deleteProduct(p.id)));
                    showToast(language === 'es' ? 'Stock eliminado.' : 'Stock deleted.');
                    triggerReload();
                  } catch { showToast(language === 'es' ? 'Error al eliminar.' : 'Delete error.', 'error'); }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.color = '#f87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(239, 68, 68, 0.85)';
                }}
              >
                🗑️ {t.delete}
              </button>
            </div>
          </>
        );
      })()}
`;

if (normContent.includes(whitelistTarget)) {
  normContent = normContent.replace(whitelistTarget, globalDropdownCode + '\n      ' + whitelistTarget);
  console.log("Successfully appended global stock actions dropdown code!");
} else {
  console.error("Could not find whitelistTarget to append global dropdown.");
}

// Save back
fs.writeFileSync(filePath, normContent.replace(/\n/g, '\r\n'), 'utf8');
console.log("Completed all updates successfully!");
