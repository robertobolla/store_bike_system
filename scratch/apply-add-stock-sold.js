import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF first for reliable replacements
let normContent = content.replace(/\r\n/g, '\n');

// 1. Replace activeStockMenuData memo to compute isGeneric and hasAvailableStock
const targetMemo = `    const hasRentals = group.some(p => rentals.some(r => r.bike_id === p.id && r.status === 'activo'));
    return { prod, group, isConsolidated, totalCount, hasRentals };`;

const replacementMemo = `    const hasRentals = group.some(p => rentals.some(r => r.bike_id === p.id && r.status === 'activo'));
    const isGeneric = prod.prefix_id === null && prod.category_id !== catBikeId && prod.category_id !== catBattId && prod.category_id !== catLockId;
    const hasAvailableStock = group.some(p => p.status === 'Disponible');
    return { prod, group, isConsolidated, totalCount, hasRentals, isGeneric, hasAvailableStock };`;

if (normContent.includes(targetMemo)) {
  normContent = normContent.replace(targetMemo, replacementMemo);
  console.log("Successfully updated activeStockMenuData memo!");
} else {
  console.error("Memo target string not found!");
}

// 2. Update destructuring in global actions dropdown
const targetDestruct = `      {activeStockMenuId && menuCoords && activeStockMenuData && (() => {
        const { prod, group, isConsolidated, totalCount, hasRentals } = activeStockMenuData;`;

const replacementDestruct = `      {activeStockMenuId && menuCoords && activeStockMenuData && (() => {
        const { prod, group, isConsolidated, totalCount, hasRentals, isGeneric, hasAvailableStock } = activeStockMenuData;`;

if (normContent.includes(targetDestruct)) {
  normContent = normContent.replace(targetDestruct, replacementDestruct);
  console.log("Successfully updated destructuring in global actions dropdown!");
} else {
  console.error("Destructuring target string not found!");
}

// 3. Replace {isConsolidated && ( ... )} with {isGeneric && ( ... )} in global actions dropdown
const targetDropdownBlock = `              {isConsolidated && (
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
              )}`;

const replacementDropdownBlock = `              {isGeneric && (
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
                  {hasAvailableStock && (
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
                  )}
                </>
              )}`;

if (normContent.includes(targetDropdownBlock)) {
  normContent = normContent.replace(targetDropdownBlock, replacementDropdownBlock);
  console.log("Successfully updated global dropdown buttons structure!");
} else {
  console.error("Dropdown block target string not found!");
}

// 4. Add "Más" button in the Sold items table action cell
const targetSoldActions = `                                          <button
                                            className="btn-secondary btn-xs"
                                            onClick={() => openProductModal(s)}
                                          >
                                            ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                                          </button>`;

const replacementSoldActions = `                                          <button
                                            className="btn-secondary btn-xs"
                                            onClick={() => openProductModal(s)}
                                          >
                                            ✏️ {language === 'es' ? 'Editar' : 'Edit'}
                                          </button>
                                          {(s.prefix_id === null && s.category_id !== catBikeId && s.category_id !== catBattId && s.category_id !== catLockId) && (
                                            <button 
                                              className={\`btn-secondary btn-xs \${activeStockMenuId === s.id ? 'active' : ''}\`}
                                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                if (activeStockMenuId === s.id) {
                                                  setActiveStockMenuId(null);
                                                  setMenuCoords(null);
                                                } else {
                                                  setActiveStockMenuId(s.id);
                                                  setMenuCoords({
                                                    top: rect.top,
                                                    left: rect.left,
                                                    width: rect.width,
                                                    height: rect.height
                                                  });
                                                }
                                              }}
                                            >
                                              ➕ {language === 'es' ? 'Más' : 'More'}
                                            </button>
                                          )}`;

if (normContent.includes(targetSoldActions)) {
  normContent = normContent.replace(targetSoldActions, replacementSoldActions);
  console.log("Successfully added 'Más' button to sold items list table!");
} else {
  console.error("Sold actions target string not found!");
}

// Save back to file with CRLF line endings
fs.writeFileSync(filePath, normContent.replace(/\n/g, '\r\n'), 'utf8');
console.log("Finished all edits!");
