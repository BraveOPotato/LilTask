import { useState } from 'react';
import { appStore } from '../store/AppStore';
import { useStore } from '../store/useStore';
import { useModal } from '../context/ModalContext';
import { dateKey } from '../models';
import { RecurringModal } from './modals/RecurringModal';

const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function CalendarView() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const { open } = useModal();
  useStore();
  const activeListId = appStore.activeListId;


  function calNav(dir: -1 | 1) {
    const d = new Date(year, month + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today       = new Date();

  const cells: React.ReactNode[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push(<CalCell key={`p${i}`} year={year} month={month - 1} day={daysInPrev - i} otherMonth today={today} activeListId={activeListId} onOpen={dk => open(<CalDayModal dateKey={dk} />)} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(<CalCell key={d} year={year} month={month} day={d} otherMonth={false} today={today} activeListId={activeListId} onOpen={dk => open(<CalDayModal dateKey={dk} />)} />);
  }
  const total = firstDay + daysInMonth;
  const next  = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= next; d++) {
    cells.push(<CalCell key={`n${d}`} year={year} month={month + 1} day={d} otherMonth today={today} activeListId={activeListId} onOpen={dk => open(<CalDayModal dateKey={dk} />)} />);
  }

  return (
    <div id="calendar-view" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px 10px' }}>
        <button className="modal-btn" onClick={() => open(<RecurringModal />)}>🔁 Recurring Tasks</button>
      </div>
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => calNav(-1)}>← Prev</button>
        <div className="cal-month-title">{MONTH_NAMES[month]} {year}</div>
        <button className="cal-nav-btn" onClick={() => calNav(1)}>Next →</button>
      </div>
      <div className="cal-grid-header">
        {DAY_NAMES.map(d => <div key={d} className="cal-day-name">{d}</div>)}
      </div>
      <div className="cal-grid">{cells}</div>
    </div>
  );
}

interface CalCellProps {
  year: number; month: number; day: number;
  otherMonth: boolean; today: Date;
  activeListId: string | null;
  onOpen: (dk: string) => void;
}

function CalCell({ year, month, day, otherMonth, today, activeListId, onOpen }: CalCellProps) {
  const d   = new Date(year, month, day);
  const dk  = dateKey(d);
  const isToday = d.toDateString() === today.toDateString();

  const todos = activeListId
    ? appStore.getTodos(activeListId).filter(t => t.dueDate === dk)
    : [];

  const recs = appStore.getActiveRecurring(d);

  const hasTodos = todos.length > 0 || recs.length > 0;

  return (
    <div
      className={`cal-cell ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasTodos ? 'has-todos' : ''}`}
      onClick={() => onOpen(dk)}
    >
      <div className="cal-date">{day}</div>
      {todos.slice(0, 2).map(t => (
        <div key={t.id} className={`cal-todo-preview ${t.done ? 'done-prev' : ''}`}>
          {t.text.substring(0, 18)}{t.text.length > 18 ? '…' : ''}
        </div>
      ))}
      {hasTodos && (
        <div className="cal-dots">
          {todos.slice(0, 7).map(t => <div key={t.id} className={`cal-dot ${t.done ? 'done-dot' : ''}`} />)}
          {recs.some(r => r.type === 'daily')   && <div className="rec-blip rec-blip-daily"   title="daily" />}
          {recs.some(r => r.type === 'weekly')  && <div className="rec-blip rec-blip-weekly"  title="weekly" />}
          {recs.some(r => r.type === 'monthly') && <div className="rec-blip rec-blip-monthly" title="monthly" />}
        </div>
      )}
    </div>
  );
}

function CalDayModal({ dateKey: dk }: { dateKey: string }) {
  const { close } = useModal();
  useStore();
  const activeListId = appStore.activeListId;
  const [newText, setNewText] = useState('');

  const [y, m, d] = dk.split('-');
  const label = `${MONTH_NAMES[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;

  const todos = activeListId ? appStore.getTodos(activeListId).filter(t => t.dueDate === dk) : [];

  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const recs = appStore.getActiveRecurring(date).filter(r => !appStore.isRecurringDeleted(r.id, dk));

  function addTask() {
    if (!newText.trim() || !activeListId) return;
    appStore.addTodo(newText.trim(), dk);
    setNewText('');
  }

  return (
    <div>
      <div className="modal-title">📅 {label}</div>
      <p style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 12 }}>
        Tasks from: <strong>{appStore.activeList?.name ?? 'current list'}</strong>
      </p>

      {recs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>🔁 Recurring</div>
          {recs.map(rec => {
            const pk   = rec.getPeriodKey(date);
            const done = appStore.isRecurringDone(rec, pk);
            return (
              <div key={rec.id} className="cal-modal-todo" style={{ gap: 8 }}>
                <button className={`todo-check ${done ? 'checked' : ''}`}
                  onClick={() => appStore.toggleRecurringCompletion(rec, pk)} />
                <span style={{ flex: 1, textDecoration: done ? 'line-through' : undefined, color: done ? 'var(--text3)' : undefined }}>
                  {rec.text}
                </span>
                <span className={`rec-badge rec-${rec.type}`} style={{ fontSize: 10 }}>{rec.type}</span>
              </div>
            );
          })}
        </div>
      )}

      <div id="cal-date-todos">
        {todos.length === 0
          ? <p style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>No tasks for this day yet.</p>
          : todos.map(t => (
            <div key={t.id} className="cal-modal-todo">
              <button className={`todo-check ${t.done ? 'checked' : ''}`}
                onClick={() => activeListId && appStore.toggleTodo(activeListId, t.id)} />
              <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : undefined, color: t.done ? 'var(--text3)' : undefined }}>
                {t.text}
              </span>
              <button className="todo-act-btn" onClick={() => activeListId && appStore.deleteTodo(activeListId, t.id)}>✕</button>
            </div>
          ))
        }
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          className="modal-input"
          placeholder="Add task for this day…"
          style={{ marginBottom: 0, flex: 1 }}
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
          autoComplete="off"
        />
        <button className="modal-btn primary" onClick={addTask}>Add</button>
      </div>
      <div className="modal-actions">
        <button className="modal-btn primary" onClick={close}>Done</button>
      </div>
    </div>
  );
}
