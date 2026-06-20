      </button>
    </div>
  );

  // ============================================================
  // TASK BOARD ACTIONS (WITH LOCAL FALLBACK)
  // ============================================================
  const handleSaveCard = async (title: string, existingId?: string) => {
    const cardId = existingId || crypto.randomUUID();
    const newCard: TaskCard = {
      id: cardId,
      title,
      created_at: new Date().toISOString()
    };
    
    // Optimistic / Local update first
    let updatedCards = [...taskCards];
    if (existingId) {
      updatedCards = updatedCards.map(c => c.id === existingId ? { ...c, title } : c);
    } else {
      updatedCards.push(newCard);
    }
    setTaskCards(updatedCards);

    try {
      await upsertTaskCard(newCard);
    } catch (err) {
      console.warn('[FastSheep] Error saving card to Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_cards', JSON.stringify(updatedCards));
    }
  };

  const handleDeleteCard = async (id: string) => {
    const updatedCards = taskCards.filter(c => c.id !== id);
    const updatedItems = taskItems.filter(item => item.card_id !== id);
    setTaskCards(updatedCards);
    setTaskItems(updatedItems);

    try {
      await deleteTaskCard(id);
    } catch (err) {
      console.warn('[FastSheep] Error deleting card from Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_cards', JSON.stringify(updatedCards));
      localStorage.setItem('fast_sheep_task_items', JSON.stringify(updatedItems));
    }
  };

  const handleSaveTask = async (item: Partial<TaskItem>) => {
    const itemId = item.id || crypto.randomUUID();
    const existing = taskItems.find(t => t.id === itemId);
    const text = item.text !== undefined ? item.text : (existing?.text || '');
    const completed = item.completed !== undefined ? item.completed : (existing?.completed || false);
    const color = item.color !== undefined ? item.color : (existing?.color || '#3b82f6');
    const card_id = item.card_id !== undefined ? item.card_id : (existing?.card_id || '');
    
    // Find next position if it's a new task
    let position = item.position !== undefined ? item.position : (existing?.position || 0);
    if (!existing) {
      const cardTasks = taskItems.filter(t => t.card_id === card_id);
      position = cardTasks.length > 0 ? Math.max(...cardTasks.map(t => t.position)) + 1 : 0;
    }

    const newTask: TaskItem = {
      id: itemId,
      card_id,
      text,
      completed,
      color,
      position,
      created_at: existing?.created_at || new Date().toISOString()
    };

    let updatedItems = [...taskItems];
    if (existing) {
      updatedItems = updatedItems.map(t => t.id === itemId ? newTask : t);
    } else {
      updatedItems.push(newTask);
    }
    // Keep it sorted
    updatedItems.sort((a, b) => a.position - b.position);
    setTaskItems(updatedItems);

    try {
      await upsertTaskItem(newTask);
    } catch (err) {
      console.warn('[FastSheep] Error saving task to Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_items', JSON.stringify(updatedItems));
    }
  };

  const handleDeleteTask = async (id: string) => {
    const updatedItems = taskItems.filter(t => t.id !== id);
    setTaskItems(updatedItems);

    try {
      await deleteTaskItem(id);
    } catch (err) {
      console.warn('[FastSheep] Error deleting task from Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_items', JSON.stringify(updatedItems));
    }
  };

  const handleSaveColorTag = async (color: string, label: string) => {
    const updatedTags = { ...colorTags, [color]: label };
    setColorTags(updatedTags);

    try {
      await upsertColorTag({ color, label });
    } catch (err) {
      console.warn('[FastSheep] Error saving color tag to Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_color_tags', JSON.stringify(updatedTags));
    }
  };

  const handleDeleteColorTag = async (color: string) => {
    const updatedTags = { ...colorTags };
    delete updatedTags[color];
    setColorTags(updatedTags);

    try {
      await deleteColorTag(color);
    } catch (err) {
      console.warn('[FastSheep] Error deleting color tag from Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_color_tags', JSON.stringify(updatedTags));
    }
  };

  const handleMoveTask = async (item: TaskItem, direction: 'up' | 'down') => {
    const cardTasks = taskItems.filter(t => t.card_id === item.card_id).sort((a, b) => a.position - b.position);
    const index = cardTasks.findIndex(t => t.id === item.id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const prevItem = cardTasks[index - 1];
      const tempPos = item.position;
      item.position = prevItem.position;
      prevItem.position = tempPos;
    } else if (direction === 'down' && index < cardTasks.length - 1) {
      const nextItem = cardTasks[index + 1];
      const tempPos = item.position;
      item.position = nextItem.position;
      nextItem.position = tempPos;
    } else {
      return; // Can't move further
    }

    // Update state
    const updatedItems = taskItems.map(t => {
      const match = cardTasks.find(ct => ct.id === t.id);
      return match ? { ...t, position: match.position } : t;
    }).sort((a, b) => a.position - b.position);

    setTaskItems(updatedItems);

    try {
      // Save both updated items to Supabase
      const affected = cardTasks.slice(Math.max(0, index - 1), index + 2);
      for (const t of affected) {
        await upsertTaskItem(t);
      }
    } catch (err) {
      console.warn('[FastSheep] Error moving tasks on Supabase. Saving to localStorage.', err);
      localStorage.setItem('fast_sheep_task_items', JSON.stringify(updatedItems));
    }
  };

  // ============================================================
  // MAIN APP
  // ============================================================
  return (
    <div className={`app-container ${darkMode ? '' : 'light-mode'}`}>
