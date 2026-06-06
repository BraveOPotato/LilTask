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
  const inputRef = useRef<HTMLInputElement>(null);

  const todos   = activeListId ? appStore.getTodos(activeListId) : [];
  const plugins = activeList?.plugins ?? { categoryGroup: false, finishRewards: true };

  // Keep a ref to todos so drag handlers always see the latest list
  const todosRef = useRef(todos);
  todosRef.current = todos;

  // ── Drag (mouse) ────────────────────────────────────────────────────────────
  const dragFrom = useRef<number | null>(null);
  const dragTo   = useRef<number | null>(null);

  function handleDrop() {
    const from = dragFrom.current;
    const to   = dragTo.current;
    dragFrom.current = null;
    dragTo.current   = null;
    if (from === null || to === null || from === to || !activeListId) return;
    const ids = todosRef.current.map(t => t.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    appStore.reorderTodos(activeListId, ids);
  }

  // ── Touch drag ───────────────────────────────────────────────────────────────
  const touchFrom    = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(idx: number) {
    touchFrom.current = idx;
    dragTo.current    = idx;
  }

  function handleTouchMove(clientY: number) {
    if (touchFrom.current === null || !containerRef.current) return;
    const items = [...containerRef.current.querySelectorAll<HTMLElement>('.todo-item')];
    let dropIdx = items.length - 1;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { dropIdx = i; break; }
    }
    dragTo.current = dropIdx;
  }

  function handleTouchEnd() {
    const from = touchFrom.current;
    const to   = dragTo.current;
    touchFrom.current = null;
    dragTo.current    = null;
    if (from === null || to === null || from === to || !activeListId) return;
    const ids = todosRef.current.map(t => t.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    appStore.reorderTodos(activeListId, ids);
  }

  // ── Add todo ────────────────────────────────────────────────────────────────
  function addTodo() {
    if (!inputText.trim() || !activeListId) return;
    appStore.addTodo(inputText.trim());
    setInputText('');
    if (!('ontouchstart' in window)) inputRef.current?.focus();
  }

  // ── Split todos ──────────────────────────────────────────────────────────────
  const globalTodos = todos.filter(t => !t.dueDate);
  const datedTodos  = todos.filter(t => !!t.dueDate);
  const done  = todos.filter(t => t.done).length;
  const total = todos.length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  function renderRow(t: TodoItem, absIdx: number) {
    return (
      <TodoItemRow
        key={t.id}
        todo={t} listId={activeListId!} index={absIdx}
        onDragStart={(idx) => { dragFrom.current = idx; }}
        onDragOver={(idx)  => { dragTo.current   = idx; }}
        onDrop={handleDrop}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    );
  }

  function renderTodoList(items: TodoItem[], startIdx: number) {
    if (!plugins.categoryGroup) {
      return items.map((t, i) => renderRow(t, startIdx + i));
    }
    const groups: Record<string, TodoItem[]> = {};
    items.forEach(t => { const c = categorize(t.text); (groups[c] ??= []).push(t); });
    return Object.entries(groups).map(([cat, catItems]) => (
      <div key={cat}>
        <div className="category-header">{cat}</div>
        {catItems.map(t => renderRow(t, startIdx + items.indexOf(t)))}
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
          <input
            id="todo-input" ref={inputRef}
            placeholder="Add a task…" autoComplete="off" spellCheck
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
            style={{ flex: 1 }}
          />
          <button id="add-btn" onClick={addTodo}>+</button>
        </div>
      </div>
    </div>
  );
}
