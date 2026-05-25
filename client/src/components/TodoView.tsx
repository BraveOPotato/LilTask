import { useState, useRef } from 'react';
import { appStore } from '../store/AppStore';
import { useStore } from '../store/useStore';
import { TodoItemRow } from './TodoItemRow';
import { TodoItem } from '../models';
import { categorize } from '../utils/categorize';
import { RecurringSection } from './RecurringSection';

export function TodoView() {
  useStore();
  const activeListId = appStore.activeListId;
  const activeList = appStore.activeList;
  const [inputText, setInputText] = useState('');
  const [inputDue, setInputDue]   = useState('');
  const [showDue, setShowDue]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todos = activeListId ? appStore.getTodos(activeListId) : [];

  const plugins = activeList?.plugins ?? { categoryGroup: false, finishRewards: true };

  // Drag state
  const dragFrom = useRef<number | null>(null);
  const dragTo   = useRef<number | null>(null);

  function handleDrop() {
    if (dragFrom.current === null || dragTo.current === null || !activeListId) return;
    const ids = todos.map(t => t.id);
    const [moved] = ids.splice(dragFrom.current, 1);
    ids.splice(dragTo.current, 0, moved);
    appStore.reorderTodos(activeListId, ids);
    dragFrom.current = null;
    dragTo.current   = null;
  }

  function addTodo() {
    if (!inputText.trim() || !activeListId) return;
    appStore.addTodo(inputText.trim(), inputDue || undefined);
    setInputText('');
    setInputDue('');
    setShowDue(false);
    if (!('ontouchstart' in window)) inputRef.current?.focus();
  }

  // Split todos
  const global = todos.filter(t => !t.dueDate);
  const dated  = todos.filter(t => !!t.dueDate);
  const done   = todos.filter(t => t.done).length;
  const total  = todos.length;
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);

  // Category grouping
  function renderTodoList(items: TodoItem[], startIdx: number) {
    if (!plugins.categoryGroup) {
      return items.map((t, i) => (
        <TodoItemRow
          key={t.id} todo={t} listId={activeListId!} index={startIdx + i}
          onDragStart={idx => { dragFrom.current = idx; }}
          onDragOver={idx  => { dragTo.current   = idx; }}
          onDrop={handleDrop}
        />
      ));
    }
    // Group by category
    const groups: Record<string, TodoItem[]> = {};
    items.forEach(t => {
      const cat = categorize(t.text);
      (groups[cat] ??= []).push(t);
    });
    return Object.entries(groups).map(([cat, catItems]) => (
      <div key={cat}>
        <div className="category-header">{cat}</div>
        {catItems.map((t) => (
          <TodoItemRow
            key={t.id} todo={t} listId={activeListId!}
            index={startIdx + items.indexOf(t)}
            onDragStart={idx => { dragFrom.current = idx; }}
            onDragOver={idx  => { dragTo.current   = idx; }}
            onDrop={handleDrop}
          />
        ))}
      </div>
    ));
  }

  const hasContent = todos.length > 0;

  return (
    <div id="todo-view" className="active">
      <div id="todos-container">
        {!hasContent ? (
          <div className="empty-state">
            <div className="es-icon">📝</div>
            <div className="es-title">No tasks yet</div>
            <div className="es-desc">Add your first task above</div>
          </div>
        ) : (
          <>
            {global.length > 0 && renderTodoList(global, 0)}
            {dated.length > 0 && (
              <>
                <div className="section-header">
                  📅 Todos with Dues <span className="sh-count">{dated.length}</span>
                </div>
                {renderTodoList(dated, global.length)}
              </>
            )}
            <RecurringSection listId={activeListId!} />
          </>
        )}
        {!hasContent && <RecurringSection listId={activeListId!} />}
      </div>

      <div id="todo-bottom">
        <div className="list-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: pct + '%' }} />
          </div>
          <div className="progress-label">{done} / {total}</div>
        </div>

        <div className="todo-input-wrap">
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            <input
              id="todo-input"
              ref={inputRef}
              placeholder="Add a task…"
              autoComplete="off"
              spellCheck
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
              style={{ flex: 1 }}
            />
            <button
              className="due-toggle-btn"
              onClick={() => setShowDue(v => !v)}
              title="Set due date"
              style={{ fontSize: 14, padding: '0 8px', background: showDue ? 'var(--accent-glow)' : 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: showDue ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }}
            >📅</button>
          </div>
          {showDue && (
            <input
              type="date"
              value={inputDue}
              onChange={e => setInputDue(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--mono)', width: '100%' }}
            />
          )}
          <button id="add-btn" onClick={addTodo}>+</button>
        </div>
      </div>
    </div>
  );
}
