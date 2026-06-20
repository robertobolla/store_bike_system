import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const modalsCode = `
      {/* ===== ADD GENERIC STOCK MODAL ===== */}
      {addGenStockModalOpen && (() => {
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) return null;
        
        return (
          <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setAddGenStockModalOpen(false)}>
            <div className="modal-content" style={{ maxWidth: '450px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>➕ {language === 'es' ? 'Agregar Existencias' : 'Add Stock'} ({prod.serial_number})</h3>
                <button className="btn-secondary btn-xs" onClick={() => setAddGenStockModalOpen(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">{language === 'es' ? 'Cantidad a agregar' : 'Quantity to add'}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    min={1} 
                    value={genStockQty} 
                    onChange={e => setGenStockQty(Math.max(1, Number(e.target.value)))} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'es' ? 'Ubicación' : 'Location'}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Ej: Oficina, Almacén Central..."
                    value={genStockLocation} 
                    onChange={e => setGenStockLocation(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'es' ? 'Costo unitario (€)' : 'Unit Cost (€)'}</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    min={0} 
                    value={genStockCost} 
                    onChange={e => setGenStockCost(Math.max(0, Number(e.target.value)))} 
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button className="btn-secondary" onClick={() => setAddGenStockModalOpen(false)}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button 
                  className="btn-primary" 
                  onClick={async () => {
                    const cleanLocation = genStockLocation.trim() || 'Almacén Central';
                    try {
                      // Insert new product row representing these new generic units
                      const newId = crypto.randomUUID();
                      await upsertProduct({
                        ...prod,
                        id: newId,
                        status: 'Disponible',
                        price_paid: genStockCost,
                        price_sold: null,
                        sold_date: null,
                        purchase_date: new Date().toISOString().split('T')[0],
                        date_added: new Date().toISOString(),
                        custom_field_values: {
                          ...prod.custom_field_values,
                          location: cleanLocation,
                          location_distribution: {
                            [cleanLocation]: genStockQty
                          }
                        }
                      });
                      showToast(language === 'es' ? 'Existencias añadidas correctamente.' : 'Stock added successfully.', 'success');
                      setAddGenStockModalOpen(false);
                      triggerReload();
                    } catch (err) {
                      console.error('Error adding generic stock:', err);
                      showToast(language === 'es' ? 'Error al agregar existencias.' : 'Error adding stock.', 'error');
                    }
                  }}
                >
                  💾 {language === 'es' ? 'Guardar' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== REMOVE GENERIC STOCK MODAL ===== */}
      {removeGenStockModalOpen && (() => {
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) return null;

        // Find all rows with the same serial number
        const matchingProducts = products.filter(p => p.serial_number === prod.serial_number && p.status === 'Disponible');

        // Compile location distribution across all matching available products
        const locStockMap: Record<string, number> = {};
        matchingProducts.forEach(mp => {
          const dist = (mp.custom_field_values?.location_distribution as Record<string, number>) || {};
          Object.entries(dist).forEach(([loc, qty]) => {
            if (qty > 0) {
              locStockMap[loc] = (locStockMap[loc] || 0) + qty;
            }
          });
          // Also fallback to single location if no distribution
          if (Object.keys(dist).length === 0 && mp.custom_field_values?.location) {
            const singleLoc = mp.custom_field_values.location as string;
            locStockMap[singleLoc] = (locStockMap[singleLoc] || 0) + 1;
          }
        });

        const availableLocations = Object.keys(locStockMap);
        const maxQty = locStockMap[genStockLocation] || 0;

        return (
          <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setRemoveGenStockModalOpen(false)}>
            <div className="modal-content" style={{ maxWidth: '450px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>➖ {language === 'es' ? 'Quitar Existencias' : 'Remove Stock'} ({prod.serial_number})</h3>
                <button className="btn-secondary btn-xs" onClick={() => setRemoveGenStockModalOpen(false)}>✕</button>
              </div>
              
              {availableLocations.length === 0 ? (
                <div className="modal-body" style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {language === 'es' ? 'No hay existencias disponibles para retirar.' : 'No available stock to remove.'}
                </div>
              ) : (
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">{language === 'es' ? 'Ubicación' : 'Location'}</label>
                    <select 
                      className="form-control" 
                      value={genStockLocation} 
                      onChange={e => {
                        setGenStockLocation(e.target.value);
                        setGenStockQty(1);
                      }}
                    >
                      {availableLocations.map(loc => (
                        <option key={loc} value={loc}>
                          {loc} ({language === 'es' ? 'Disp:' : 'Avail:'} {locStockMap[loc]})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      {language === 'es' ? 'Cantidad a retirar' : 'Quantity to remove'}
                    </label>
                    <input 
                      type="number" 
                      className="form-control" 
                      min={1} 
                      max={maxQty}
                      value={genStockQty} 
                      onChange={e => setGenStockQty(Math.min(maxQty, Math.max(1, Number(e.target.value))))} 
                    />
                  </div>
                </div>
              )}
              
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button className="btn-secondary" onClick={() => setRemoveGenStockModalOpen(false)}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button 
                  className="btn-primary" 
                  disabled={availableLocations.length === 0}
                  onClick={async () => {
                    try {
                      let qtyToRemove = genStockQty;
                      const updates = [];
                      const deletes = [];

                      // Iterate through matching products to deduct quantity
                      for (const mp of matchingProducts) {
                        if (qtyToRemove <= 0) break;

                        const dist = { ...((mp.custom_field_values?.location_distribution as Record<string, number>) || {}) };
                        const locQty = dist[genStockLocation] || 0;

                        if (locQty > 0) {
                          const deduct = Math.min(qtyToRemove, locQty);
                          dist[genStockLocation] = locQty - deduct;
                          qtyToRemove -= deduct;

                          // Clean up 0 quantities
                          if (dist[genStockLocation] <= 0) {
                            delete dist[genStockLocation];
                          }

                          const newTotal = Object.values(dist).reduce((a, b) => a + b, 0);

                          if (newTotal <= 0) {
                            // If it's the very last remaining row in the entire serial number group, 
                            // keep it but with empty distribution and status set to 'Disponible' (0 stock),
                            // to avoid deleting the product definition completely.
                            const totalRowsInGroup = products.filter(p => p.serial_number === prod.serial_number).length;
                            if (totalRowsInGroup <= 1) {
                              updates.push(upsertProduct({
                                ...mp,
                                custom_field_values: {
                                  ...mp.custom_field_values,
                                  location_distribution: {}
                                }
                              }));
                            } else {
                              deletes.push(deleteProduct(mp.id));
                            }
                          } else {
                            // Find new main location
                            let mainLocation = '';
                            let maxQ = -1;
                            Object.entries(dist).forEach(([l, v]) => {
                              if (v > maxQ) {
                                maxQ = v;
                                mainLocation = l;
                              }
                            });

                            updates.push(upsertProduct({
                              ...mp,
                              custom_field_values: {
                                ...mp.custom_field_values,
                                location: mainLocation,
                                location_distribution: dist
                              }
                            }));
                          }
                        }
                      }

                      // Run db calls
                      if (updates.length > 0) {
                        await Promise.all(updates.map(up => up));
                      }
                      if (deletes.length > 0) {
                        await Promise.all(deletes.map(del => del));
                      }

                      showToast(language === 'es' ? 'Existencias retiradas correctamente.' : 'Stock removed successfully.', 'success');
                      setRemoveGenStockModalOpen(false);
                      triggerReload();
                    } catch (err) {
                      console.error('Error removing generic stock:', err);
                      showToast(language === 'es' ? 'Error al retirar existencias.' : 'Error removing stock.', 'error');
                    }
                  }}
                >
                  {language === 'es' ? 'Confirmar' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
`;

const targetString = '{/* ===== GOOGLE AUTH ACCESS CONTROL WHITELIST MODAL ===== */}';

if (content.includes(targetString)) {
  content = content.replace(targetString, `${modalsCode}\n      ${targetString}`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully inserted generic stock modals!");
} else {
  console.error("Could not find the whitelist modal comment in App.tsx");
}
