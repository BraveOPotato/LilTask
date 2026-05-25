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
  const activeList   = appStore.activeList;
  const [inputText, setInputText] = useState('');
  const [inputDue, setInputDue]   = useState('');
  const [showDue, setShowDue]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todos  = activeListId ? appStore.getTodos(activeListId) : [];
  const plugins = activeList?.plugins ?? { categoryGroup: false, finishRewards: true };

  // ── Drag (mouse) ────────────────────────────────────────────────────────────
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

  // ── Touch drag ───────────────────────────────────────────────────────────────
  const touchFrom = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(idx: number) {
    touchFrom.current = idx;
  }

  function handleTouchMove(clientY: number) {
    if (touchFrom.current === null || !containerRef.current || !activeListId) return;
    const items = [...containerRef.current.querySelectorAll<HTMLElement>('.todo-item')];
    let dropIdx = items.length;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { dropIdx = i; break; }
    }
    dragTo.current = dropIdx;
  }

  function handleTouchEnd() {
    if (touchFrom.current === null || dragTo.current === null || !activeListId) {
      touchFrom.current = null; dragTo.current = null; return;
    }
    const from = touchFrom.current;
    let   to   = dragTo.current;
    if (to > from) to -= 1;
    if (from !== to) {
      const ids = todos.map(t => t.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      appStore.reorderTodos(activeListId, ids);
    }
    touchFrom.current = null;
    dragTo.current    = null;
  }

  // ── Add todo ────────────────────────────────────────────────────────────────
  function addTodo() {
    if (!inputText.trim() || !activeListId) return;
    appStore.addTodo(inputText.trim(), inputDue || undefined);
    setInputText('');
    setInputDue('');
    setShowDue(false);
    if (!('ontouchstart' in window)) inputRef.current?.focus();
  }

  // ── Split todos ──────────────────────────────────────────────────────────────
  const globalTodos = todos.filter(t => !t.dueDate);
  const datedTodos  = todos.filter(t => !!t.dueDate);
  const done  = todos.filter(t => t.done).length;
  const total = todos.length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  function renderTodoList(items: TodoItem[], startIdx: number) {
    const rowProps = (t: TodoItem, absIdx: number) => ({
      key: t.id, todo: t, listId: activeListId!, index: absIdx,
      onDragStart: (idx: number) => { dragFrom.current = idx; },
      onDragOver:  (idx: number) => { dragTo.current   = idx; },
      onDrop: handleDrop,
      onTouchStart: handleTouchStart,
      onTouchMove:  handleTouchMove,
      onTouchEnd:   handleTouchEnd,
    });

    if (!plugins.categoryGroup) {
      return items.map((t, i) => <TodoItemRow {...rowProps(t, startIdx + i)} />);
    }
    const groups: Record<string, TodoItem[]> = {};
    items.forEach(t => { const c = categorize(t.text); (groups[c] ??= []).push(t); });
    return Object.entries(groups).map(([cat, catItems]) => (
      <div key={cat}>
        <div className="category-header">{cat}</div>
        {catItems.map(t => <TodoItemRow {...rowProps(t, startIdx + items.indexOf(t))} />)}
      </div>
    ));
  }

  return (
    <div id="todo-view" className="active">
      <div id="todos-container" ref={containerRef}>
        {todos.length === 0 && !activeListId ? (
          <div className="empty-state">
            <div className="es-icon">📝</div>
            <div className="es-title">No tasks yet</div>
            <div className="es-desc">Add your first task above</div>
          </div>
        ) : (
          <>
            {/* ── Global todos ── */}
            {globalTodos.length > 0 && (
              <>
                <div className="section-header">
                  📋 To-Dos <span className="sh-count">{globalTodos.length}</span>
                </div>
                {renderTodoList(globalTodos, 0)}
              </>
            )}

            {/* ── Dated todos ── */}
            {datedTodos.length > 0 && (
              <>
                <div className="section-header">
                  📅 Scheduled <span className="sh-count">{datedTodos.length}</span>
                </div>
                {renderTodoList(datedTodos, globalTodos.length)}
              </>
            )}

            {/* ── Empty state when only recurring exist ── */}
            {todos.length === 0 && (
              <div className="empty-state">
                <div className="es-icon">📝</div>
                <div className="es-title">No tasks yet</div>
                <div className="es-desc">Add your first task above</div>
              </div>
            )}

            <RecurringSection listId={activeListId ?? ''} />
          </>
        )}
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
              id="todo-input" ref={inputRef}
              placeholder="Add a task…" autoComplete="off" spellCheck
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
              style={{ flex: 1 }}
            />
            <button
              onClick={() => setShowDue(v => !v)} title="Set due date"
              style={{ fontSize: 14, padding: '0 8px', background: showDue ? 'var(--accent-glow)' : 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: showDue ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }}
            >📅</button>
          </div>
          {showDue && (
            <input type="date" value={inputDue} onChange={e => setInputDue(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--mono)', width: '100%' }} />
          )}
          <button id="add-btn" onClick={addTodo}>+</button>
        </div>
      </div>
    </div>
  );
}
