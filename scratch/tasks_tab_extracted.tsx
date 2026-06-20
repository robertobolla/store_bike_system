          {currentTab === 'tasks' && (() => {
            const colorsList = Object.keys(colorTags).length > 0 ? Object.keys(colorTags) : ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
            
            return (
              <div style={{ padding: '0 24px 24px 24px' }}>
                {/* Header Actions */}
                <div className="filter-row" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Ã°ÂÂÂ {language === 'es' ? 'Tablero de Tareas' : 'Task Board'}
                    </h2>
                    <button 
                      className="btn-secondary btn-sm"
                      onClick={() => setShowColorConfig(!showColorConfig)}
                    >
                      Ã°ÂÂÂ¨ {language === 'es' ? 'Etiquetas de Colores' : 'Color Labels'} {showColorConfig ? 'Ã¢ÂÂ²' : 'Ã¢ÂÂ¼'}
                    </button>
                  </div>

                  {/* Add New Card Form */}
                  <form 
                    onSubmit={e => {
                      e.preventDefault();
                      if (!newCardTitle.trim()) return;
                      handleSaveCard(newCardTitle.trim());
                      setNewCardTitle('');
                    }}
                    style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                  >
                    <input 
                      className="form-control"
                      style={{ maxWidth: '240px' }}
                      placeholder={language === 'es' ? 'Nueva Tarjeta (ej. Taller)' : 'New Card (e.g. Workshop)'}
                      value={newCardTitle}
                      onChange={e => setNewCardTitle(e.target.value)}
                    />
                    <button type="submit" className="btn-primary">
                      Ã¢ÂÂ {language === 'es' ? 'Crear' : 'Create'}
                    </button>
                  </form>
                </div>

                {/* Color Tag Labels Config Drawer */}
                {showColorConfig && (
                  <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Ã°ÂÂÂ·Ã¯Â¸Â {language === 'es' ? 'Personalizar Etiquetas de Colores' : 'Customize Color Labels'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                      {colorsList.map(c => (
                        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: c, border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                          <input 
                            className="form-control"
                            style={{ fontSize: '13px', padding: '6px 10px', flex: 1 }}
                            value={colorTags[c] || ''}
                            placeholder={language === 'es' ? 'Sin etiqueta' : 'No label'}
                            onChange={e => handleSaveColorTag(c, e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-secondary btn-xs"
                            style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '4px 8px', height: '32px' }}
                            onClick={async () => {
                              if (await asyncConfirm(language === 'es' ? 'ÃÂ¿Eliminar esta etiqueta de color?' : 'Delete this color tag?')) {
                                handleDeleteColorTag(c);
                              }
                            }}
                          >
                            Ã¢ÂÂ
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Form to Add New Tag */}
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                        Ã¢ÂÂ¨ {language === 'es' ? 'Nueva Etiqueta:' : 'New Label:'}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="color" 
                          style={{ width: '40px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                          value={newTagColor}
                          onChange={e => setNewTagColor(e.target.value)}
                        />
                        <input 
                          className="form-control"
                          style={{ fontSize: '13px', padding: '6px 10px', maxWidth: '180px' }}
                          placeholder={language === 'es' ? 'Nombre (ej. Pendiente)' : 'Name (e.g. Pending)'}
                          value={newTagLabel}
                          onChange={e => setNewTagLabel(e.target.value)}
                        />
                        <button 
                          type="button" 
                          className="btn-primary btn-sm"
                          style={{ height: '32px' }}
                          onClick={() => {
                            if (!newTagLabel.trim()) return;
                            handleSaveColorTag(newTagColor, newTagLabel.trim());
                            setNewTagLabel('');
                            const randomColors = ['#ec4899', '#f43f5e', '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#a855f7', '#d946ef'];
                            const nextColor = randomColors[Math.floor(Math.random() * randomColors.length)];
                            setNewTagColor(nextColor);
                          }}
                        >
                          Ã¢ÂÂ {language === 'es' ? 'Agregar' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid of Task Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
                  {taskCards.map(card => {
                    const cardTasks = taskItems.filter(item => item.card_id === card.id).sort((a, b) => a.position - b.position);

                    return (
                      <div key={card.id} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Card Title Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                          {editingCardId === card.id ? (
                            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                              <input 
                                className="form-control"
                                style={{ fontSize: '15px', fontWeight: 600, padding: '4px 8px' }}
                                value={editingCardTitle}
                                onChange={e => setEditingCardTitle(e.target.value)}
                                autoFocus
                              />
                              <button 
                                className="btn-primary btn-xs"
                                onClick={() => {
                                  if (editingCardTitle.trim()) {
                                    handleSaveCard(editingCardTitle.trim(), card.id);
                                  }
                                  setEditingCardId(null);
                                }}
                              >
                                Ã¢ÂÂ
                              </button>
                              <button 
                                className="btn-secondary btn-xs"
                                onClick={() => setEditingCardId(null)}
                              >
                                Ã¢ÂÂ
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 
                                style={{ margin: 0, fontSize: '16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onClick={() => {
                                  setEditingCardId(card.id);
                                  setEditingCardTitle(card.title);
                                }}
                                title={language === 'es' ? 'Haz click para editar' : 'Click to edit'}
                              >
                                {card.title}
                                <span style={{ opacity: 0.4, fontSize: '12px' }}>Ã¢ÂÂÃ¯Â¸Â</span>
                              </h3>
                              <button 
                                className="btn-secondary btn-xs" 
                                style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)' }}
                                onClick={async () => {
                                  if (await asyncConfirm(language === 'es' ? 'ÃÂ¿Eliminar tarjeta y todas sus tareas?' : 'Delete card and all its tasks?')) {
                                    handleDeleteCard(card.id);
                                  }
                                }}
                              >
                                Ã°ÂÂÂÃ¯Â¸Â
                              </button>
                            </>
                          )}
                        </div>

                        {/* List of Tasks inside Card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '40px' }}>
                          {cardTasks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '16px 0', opacity: 0.35, fontSize: '13px', fontStyle: 'italic' }}>
                              {language === 'es' ? 'Sin tareas' : 'No tasks yet'}
                            </div>
                          ) : (
                            cardTasks.map((item, idx) => (
                              <div 
                                key={item.id} 
                                style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  gap: '6px',
                                  padding: '8px 10px', 
                                  borderRadius: '6px', 
                                  background: 'rgba(255,255,255,0.015)',
                                  borderLeft: `4px solid ${item.color}`,
                                  border: '1px solid rgba(255,255,255,0.03)',
                                  borderLeftWidth: '4px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  {/* Checkbox */}
                                  <input 
                                    type="checkbox" 
                                    checked={item.completed} 
                                    style={{ marginTop: '3px', cursor: 'pointer', width: '15px', height: '15px' }}
                                    onChange={e => handleSaveTask({ id: item.id, completed: e.target.checked })}
                                  />

                                  {/* Task Text */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {editingTaskId === item.id ? (
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <input 
                                          className="form-control"
                                          style={{ fontSize: '13px', padding: '2px 6px' }}
                                          value={editingTaskText}
                                          onChange={e => setEditingTaskText(e.target.value)}
                                          autoFocus
                                        />
                                        <button 
                                          className="btn-primary btn-xs"
                                          onClick={() => {
                                            if (editingTaskText.trim()) {
                                              handleSaveTask({ id: item.id, text: editingTaskText.trim() });
                                            }
                                            setEditingTaskId(null);
                                          }}
                                        >
                                          Ã¢ÂÂ
                                        </button>
                                        <button 
                                          className="btn-secondary btn-xs"
                                          onClick={() => setEditingTaskId(null)}
                                        >
                                          Ã¢ÂÂ
                                        </button>
                                      </div>
                                    ) : (
                                      <span 
                                        style={{ 
                                          fontSize: '13.5px', 
                                          textDecoration: item.completed ? 'line-through' : 'none',
                                          opacity: item.completed ? 0.5 : 0.9,
                                          wordBreak: 'break-word',
                                          cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                          setEditingTaskId(item.id);
                                          setEditingTaskText(item.text);
                                        }}
                                        title={language === 'es' ? 'Haz click para editar' : 'Click to edit'}
                                      >
                                        {item.text}
                                      </span>
                                    )}
                                  </div>

                                  {/* Action Buttons: Move and Delete */}
                                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                    <button 
                                      className="btn-secondary btn-xs"
                                      style={{ padding: '2px 4px', fontSize: '11px' }}
                                      disabled={idx === 0}
                                      onClick={() => handleMoveTask(item, 'up')}
                                      title={language === 'es' ? 'Subir' : 'Move Up'}
                                    >
                                      Ã¢ÂÂ
                                    </button>
                                    <button 
                                      className="btn-secondary btn-xs"
                                      style={{ padding: '2px 4px', fontSize: '11px' }}
                                      disabled={idx === cardTasks.length - 1}
                                      onClick={() => handleMoveTask(item, 'down')}
                                      title={language === 'es' ? 'Bajar' : 'Move Down'}
                                    >
                                      Ã¢ÂÂ
                                    </button>
                                    <button 
                                      className="btn-secondary btn-xs"
                                      style={{ padding: '2px 4px', color: '#ef4444', fontSize: '11px' }}
                                      onClick={async () => {
                                        if (await asyncConfirm(language === 'es' ? 'ÃÂ¿Eliminar esta tarea?' : 'Delete this task?')) {
                                          handleDeleteTask(item.id);
                                        }
                                      }}
                                    >
                                      Ã¢ÂÂ
                                    </button>
                                  </div>
                                </div>

                                {/* Color Tag Selectors */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                                  <div style={{ display: 'flex', gap: '5px' }}>
                                    {colorsList.map(c => (
                                      <button 
                                        key={c}
                                        onClick={() => handleSaveTask({ id: item.id, color: c })}
                                        style={{
                                          width: '12px',
                                          height: '12px',
                                          borderRadius: '50%',
                                          backgroundColor: c,
                                          border: item.color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                                          cursor: 'pointer',
                                          padding: 0,
                                          boxShadow: item.color === c ? '0 0 4px rgba(255,255,255,0.6)' : 'none'
                                        }}
                                        title={colorTags[c] || c}
                                      />
                                    ))}
                                  </div>
                                  {colorTags[item.color] && (
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: `${item.color}15`, color: item.color, border: `1px solid ${item.color}30`, fontWeight: 600 }}>
                                      {colorTags[item.color]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Inline Add Task Form */}
                        <form 
                          onSubmit={e => {
                            e.preventDefault();
                            const val = newTaskTexts[card.id] || '';
                            if (!val.trim()) return;
                            handleSaveTask({ card_id: card.id, text: val.trim() });
                            setNewTaskTexts(prev => ({ ...prev, [card.id]: '' }));
                          }}
                          style={{ display: 'flex', gap: '6px', marginTop: '8px' }}
                        >
                          <input 
                            className="form-control"
                            style={{ fontSize: '13px', padding: '5px 8px' }}
                            placeholder={language === 'es' ? 'Nueva tarea...' : 'New task...'}
                            value={newTaskTexts[card.id] || ''}
                            onChange={e => {
                              const text = e.target.value;
                              setNewTaskTexts(prev => ({ ...prev, [card.id]: text }));
                            }}
                          />
                          <button type="submit" className="btn-primary btn-sm" style={{ padding: '4px 10px' }}>
                            Ã¢ÂÂ
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </main>
      </div>

      {/* ============================================================
          MODALS
          ============================================================ */}

      {/* MODAL: Product CRUD */}
      {modalType === 'product' && (() => {
        const prod = products.find(p => p.id === selectedProductId);

        const renderLocationFormSection = () => {
          // The declared "Cantidad" is the cap: the distribution splits those units across
          // locations and must never sum to more than the declared/existing total.
          const maxDistTotal = prodFormQuantity > 0 ? prodFormQuantity : 0;
          const distributedSum = Object.values(prodFormLocDistribution).reduce((a, b) => a + (Number(b) || 0), 0);
          const unassigned = Math.max(0, maxDistTotal - distributedSum);
          return (
            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', marginTop: '8px' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Ã°ÂÂÂ {language === 'es' ? 'UbicaciÃÂ³n de Stock' : 'Stock Location'}
              </label>

              {prodFormIsGeneric && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    id="prodFormUseDistribution"
                    checked={prodFormUseDistribution}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    onChange={e => {
                      const checked = e.target.checked;
                      setProdFormUseDistribution(checked);
                      if (checked) {
                        if (selectedLocation && !prodFormLocDistribution[selectedLocation]) {
                          setProdFormLocDistribution({ [selectedLocation]: prodFormQuantity });
                        }
                      }
                    }}
                  />
                  <label htmlFor="prodFormUseDistribution" style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-bright)', fontSize: '13px', margin: 0 }}>
                    {language === 'es' ? 'Dividir cantidades en diferentes ubicaciones' : 'Divide quantities across different locations'}
                  </label>
                </div>
              )}

              {prodFormIsGeneric && prodFormUseDistribution ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                    {locationsList.map((loc) => {
                      const qty = prodFormLocDistribution[loc] || 0;
                      return (
                        <div key={loc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-bright)', fontWeight: 500 }}>Ã°ÂÂÂ {loc}</span>
                          <input
                            type="number"
                            className="form-control"
                            style={{ width: '80px', height: '32px', textAlign: 'center', padding: '0 6px' }}
                            min="0"
                            max={maxDistTotal}
                            value={qty}
                            onChange={(e) => {
                              let val = Math.max(0, Number(e.target.value));
                              const othersSum = Object.entries(prodFormLocDistribution).reduce((a, [k, v]) => k === loc ? a : a + (Number(v) || 0), 0);
                              const allowed = Math.max(0, maxDistTotal - othersSum);
                              if (val > allowed) {
                                val = allowed;
                                showToast(language === 'es' ? `La cantidad total es ${maxDistTotal}. No podÃÂ©s distribuir mÃÂ¡s unidades.` : `Total quantity is ${maxDistTotal}. You can't distribute more units.`, 'error');
                              }
                              setProdFormLocDistribution({ ...prodFormLocDistribution, [loc]: val });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.05)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.1)', marginTop: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {language === 'es' ? 'Total Distribuido:' : 'Total Distributed:'}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: unassigned > 0 ? '#fbbf24' : 'var(--text-bright)' }}>
                      {distributedSum} / {maxDistTotal}
                    </span>
                  </div>
                  {unassigned > 0 && (
                    <div style={{ fontSize: '12px', color: '#fbbf24', textAlign: 'right' }}>
                      {language === 'es' ? `Quedan ${unassigned} unidades sin asignar` : `${unassigned} units still unassigned`}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    className="form-control"
                    style={{ flex: 1, minWidth: '150px' }}
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                  >
                    <option value="">{language === 'es' ? '-- Seleccione ubicaciÃÂ³n --' : '-- Select location --'}</option>
                    {locationsList.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ flex: 1, minWidth: '150px' }}
                  placeholder={language === 'es' ? 'Crear nueva ubicaciÃÂ³n' : 'Create new location'}
                  value={newLocationInput}
                  onChange={(e) => setNewLocationInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ height: '38px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => {
                    const trimmed = newLocationInput.trim();
                    if (!trimmed) return;
                    if (!locationsList.includes(trimmed)) {
                      const updated = [...locationsList, trimmed];
                      setLocationsList(updated);
                      localStorage.setItem('fast_sheep_locations', JSON.stringify(updated));
                    }
                    if (prodFormIsGeneric && prodFormUseDistribution) {
                      const currentSum = Object.values(prodFormLocDistribution).reduce((a, b) => a + (Number(b) || 0), 0);
                      const canAddOne = currentSum < maxDistTotal;
                      setProdFormLocDistribution(prev => ({ ...prev, [trimmed]: canAddOne ? 1 : 0 }));
                    } else {
                      setSelectedLocation(trimmed);
                    }
                    setNewLocationInput('');
                    showToast(
                      language === 'es' ? `UbicaciÃÂ³n "${trimmed}" creada.` : `Location "${trimmed}" created.`,
                      'success'
                    );
                  }}
                >
                  Ã¢ÂÂ {language === 'es' ? 'Crear' : 'Create'}
                </button>
              </div>

              {/* Location Manager Inside Product Modal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '4px 8px', fontSize: '11px' }}
                  onClick={() => setShowLocManager(!showLocManager)}
                >
                  Ã¢ÂÂÃ¯Â¸Â {showLocManager ? (language === 'es' ? 'Ocultar Administrador' : 'Hide Manager') : (language === 'es' ? 'Editar / Borrar Ubicaciones' : 'Edit / Delete Locations')}
                </button>
                {showLocManager && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {locationsList.map((loc, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px' }}>
                        {editingLocIndex === idx ? (
                          <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="form-control"
                              style={{ flex: 1, height: '24px', padding: '0 6px', fontSize: '11px' }}
                              value={editingLocText}
                              onChange={(e) => setEditingLocText(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ height: '24px', width: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}
                              onClick={() => {
                                const val = editingLocText.trim();
                                if (!val) return;
                                const updated = [...locationsList];
                                updated[idx] = val;
                                setLocationsList(updated);
                                localStorage.setItem('fast_sheep_locations', JSON.stringify(updated));
                                setEditingLocIndex(null);
                                if (selectedLocation === loc) {
                                  setSelectedLocation(val);
                                }
                                showToast(language === 'es' ? 'UbicaciÃÂ³n editada.' : 'Location edited.', 'success');
                              }}
                            >
                              Ã°ÂÂÂ¾
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ height: '24px', width: '24px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}
                              onClick={() => setEditingLocIndex(null)}
                            >
                              Ã¢ÂÂ
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: '11px', color: 'var(--text-bright)' }}>Ã°ÂÂÂ {loc}</span>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <button
                                type="button"
                                className="btn-secondary btn-xs"
                                style={{ padding: '1px 4px', fontSize: '10px' }}
                                onClick={() => {
                                  setEditingLocIndex(idx);
                                  setEditingLocText(loc);
                                }}
                              >
                                Ã¢ÂÂÃ¯Â¸Â
                              </button>
                              <button
                                type="button"
                                className="btn-danger btn-xs"
                                style={{ padding: '1px 4px', fontSize: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                onClick={async () => {
                                  if (await asyncConfirm(language === 'es' ? `ÃÂ¿EstÃÂ¡s seguro?` : `Are you sure?`)) {
                                    const updated = locationsList.filter((_, i) => i !== idx);
                                    setLocationsList(updated);
                                    localStorage.setItem('fast_sheep_locations', JSON.stringify(updated));
                                    if (selectedLocation === loc) {
                                      setSelectedLocation('');
                                    }
                                    showToast(language === 'es' ? 'UbicaciÃÂ³n eliminada.' : 'Location deleted.', 'success');
                                  }
                                }}
                              >
                                Ã°ÂÂÂÃ¯Â¸Â
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        };

        return (
