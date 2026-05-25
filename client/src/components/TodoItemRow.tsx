import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { TodoItem as TodoModel } from '../models';
import { appStore } from '../store/AppStore';

interface Props {
  todo: TodoModel;
  listId: string;
  index: number;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number) => void;
  onDrop: () => void;
  onTouchStart: (idx: number, y: number) => void;
  onTouchMove: (y: number) => void;
  onTouchEnd: () => void;
}

export function TodoItemRow({ todo, listId, index, onDragStart, onDragOver, onDrop, onTouchStart, onTouchMove, onTouchEnd }: Props) {
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  useEffect(() => {
    if (!editing) setEditText(todo.text);
  }, [todo.text, editing]);

  function commitEdit() {
    const t = editText.trim();
    if (t) appStore.editTodo(listId, todo.id, t, todo.dueDate);
    setEditing(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter')  commitEdit();
    if (e.key === 'Escape') { setEditing(false); setEditText(todo.text); }
  }

  const overdue  = todo.isOverdue();
  const dueToday = todo.isDueToday();

  return (
    <div
      className={`todo-item ${todo.done ? 'done' : ''}`}
      data-idx={index}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
    >
      {/* Drag handle — also handles touch drag */}
      <div
        className="drag-handle"
        onTouchStart={e => onTouchStart(index, e.touches[0].clientY)}
        onTouchMove={e => { e.preventDefault(); onTouchMove(e.touches[0].clientY); }}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >⣿</div>

      <button
        className={`todo-check ${todo.done ? 'checked' : ''}`}
        onClick={() => appStore.toggleTodo(listId, todo.id)}
      />

      <div className="todo-text" style={{ flex: 1 }}>
        {editing ? (
          <input
            ref={inputRef}
            className="todo-edit-input"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commitEdit}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{ cursor: 'text', display: 'block', minHeight: 20 }}
          >{todo.text}</span>
        )}
      </div>

      {todo.dueDate && !editing && (
        <span className={`due-badge ${overdue ? 'overdue' : dueToday ? 'today' : ''}`} title={todo.dueDate}>
          📅 {todo.dueDate}
        </span>
      )}

      <div className="todo-actions">
        <button className="todo-act-btn" onClick={() => appStore.deleteTodo(listId, todo.id)} title="Delete">✕</button>
      </div>
    </div>
  );
}
