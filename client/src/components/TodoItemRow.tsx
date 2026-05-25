import { useState, useRef, useEffect } from 'react';
import { TodoItem as TodoModel } from '../models';
import { appStore } from '../store/AppStore';

interface Props {
  todo: TodoModel;
  listId: string;
  index: number;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDrop: () => void;
}

export function TodoItemRow({ todo, listId, index, onDragStart, onDragOver, onDrop }: Props) {
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [editDue, setEditDue]   = useState(todo.dueDate ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commitEdit() {
    const t = editText.trim();
    if (t) appStore.editTodo(listId, todo.id, t, editDue || undefined);
    setEditing(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  commitEdit();
    if (e.key === 'Escape') { setEditing(false); setEditText(todo.text); setEditDue(todo.dueDate ?? ''); }
  }

  const overdue   = todo.isOverdue();
  const dueToday  = todo.isDueToday();

  return (
    <div
      className={`todo-item ${todo.done ? 'done' : ''}`}
      data-idx={index}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
    >
      <div className="drag-handle">⣿</div>

      <button
        className={`todo-check ${todo.done ? 'checked' : ''}`}
        onClick={() => appStore.toggleTodo(listId, todo.id)}
      />

      <div className="todo-text" style={{ flex: 1 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              ref={inputRef}
              className="todo-edit-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={commitEdit}
            />
            <input
              type="date"
              className="todo-edit-input"
              value={editDue}
              onChange={e => setEditDue(e.target.value)}
              style={{ fontSize: 12, opacity: 0.7 }}
            />
          </div>
        ) : (
          <span onDoubleClick={() => setEditing(true)}>{todo.text}</span>
        )}
      </div>

      {/* Due date badge */}
      {todo.dueDate && !editing && (
        <span
          className={`due-badge ${overdue ? 'overdue' : dueToday ? 'today' : ''}`}
          title={todo.dueDate}
        >
          📅 {todo.dueDate}
        </span>
      )}

      <div className="todo-actions">
        <button className="todo-act-btn" onClick={() => setEditing(true)} title="Edit">✎</button>
        <button className="todo-act-btn" onClick={() => appStore.deleteTodo(listId, todo.id)} title="Delete">✕</button>
      </div>
    </div>
  );
}
