import { useState } from 'react';
import { appStore } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';
import type { RecurrenceType } from '../../models';

export function RecurringModal() {
  const { close } = useModal();
  const [view, setView] = useState<'list' | 'new'>('list');

  useStore();
  const recs = appStore.getRecurring();

  const typeLabel: Record<RecurrenceType, string> = { daily: '🌅 Daily', weekly: '📆 Weekly', monthly: '🗓️ Monthly' };

  function recSubtitle(r: { type: RecurrenceType; weekDays: number[]; monthDays: number[] }) {
    const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    if (r.type === 'weekly') {
      const days = r.weekDays.length ? r.weekDays.map(d => DOW[d]).join(', ') : 'Mon';
      return <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>{days}</span>;
    }
    if (r.type === 'monthly') {
      const days = r.monthDays.length ? r.monthDays.map(d => `${d}`).join(', ') : '1';
      return <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>day {days}</span>;
    }
    return null;
  }

  if (view === 'new') return <NewRecurringForm onBack={() => setView('list')} />;

  return (
    <div>
      <div className="modal-title">🔁 Recurring Tasks</div>
      <div style={{ marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
        {recs.length === 0
          ? <p style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0 4px' }}>No recurring tasks yet.</p>
          : recs.map(r => (
            <div key={r.id} className="rec-manage-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`rec-badge rec-${r.type}`}>{typeLabel[r.type]}</span>
                  {recSubtitle(r)}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</span>
              </div>
              <button className="todo-act-btn" onClick={() => appStore.deleteRecurringPermanently(r.id)}>✕</button>
            </div>
          ))
        }
      </div>
      <button className="modal-btn primary" style={{ width: '100%' }} onClick={() => setView('new')}>＋ New recurring task</button>
      <div className="modal-actions">
        <button className="modal-btn" onClick={close}>Close</button>
      </div>
    </div>
  );
}

// ── Day-of-week picker ────────────────────────────────────────────────────────
const DOW_LABELS = ['S','M','T','W','T','F','S'];
const DOW_FULL   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function WeekDayPicker({ selected, onChange }: { selected: number[]; onChange: (v: number[]) => void }) {
  function toggle(d: number) {
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d].sort());
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontFamily: 'var(--mono)' }}>DAYS OF WEEK</div>
      <div className="rec-day-grid">
        {DOW_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            className={`rec-day-btn ${selected.includes(i) ? 'selected' : ''}`}
            onClick={() => toggle(i)}
            title={DOW_FULL[i]}
          >{label}</button>
        ))}
      </div>
      {selected.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -4, marginBottom: 8 }}>No days selected — defaults to Monday.</p>
      )}
    </div>
  );
}

// ── Monthly day picker (mini calendar grid) ───────────────────────────────────
function MonthDayPicker({ selected, onChange }: { selected: number[]; onChange: (v: number[]) => void }) {
  function toggle(d: number) {
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d].sort((a,b) => a-b));
  }
  // 1–31 grid
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontFamily: 'var(--mono)' }}>DAYS OF MONTH</div>
      <div className="rec-cal-date-grid">
        {days.map(d => (
          <button
            key={d}
            type="button"
            className={`rec-cal-date-btn ${selected.includes(d) ? 'selected' : ''}`}
            onClick={() => toggle(d)}
          >{d}</button>
        ))}
      </div>
      {selected.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: -4, marginBottom: 8 }}>No days selected — defaults to 1st of month.</p>
      )}
    </div>
  );
}

// ── New recurring form ────────────────────────────────────────────────────────
function NewRecurringForm({ onBack }: { onBack: () => void }) {
  const [text,          setText]          = useState('');
  const [type,          setType]          = useState<RecurrenceType>('daily');
  const [periodTotal,   setPeriodTotal]   = useState(1);
  const [earlyComplete, setEarlyComplete] = useState(false);
  const [weekDays,      setWeekDays]      = useState<number[]>([]);
  const [monthDays,     setMonthDays]     = useState<number[]>([]);

  function create() {
    if (!text.trim()) return;
    appStore.addRecurring(text.trim(), type, periodTotal, earlyComplete, weekDays, monthDays);
    onBack();
  }

  return (
    <div>
      <div className="modal-title">＋ New Recurring Task</div>

      <input
        className="modal-input"
        placeholder="Task description…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); }}
        autoFocus
      />

      {/* Type selector */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>RECURRENCE TYPE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'weekly', 'monthly'] as RecurrenceType[]).map(t => (
            <button key={t} type="button" onClick={() => setType(t)} className="modal-btn"
              style={{ flex: 1, background: type === t ? 'var(--accent)' : undefined, borderColor: type === t ? 'var(--accent)' : undefined, color: type === t ? '#fff' : undefined }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional pickers */}
      {type === 'weekly'  && <WeekDayPicker  selected={weekDays}  onChange={setWeekDays}  />}
      {type === 'monthly' && <MonthDayPicker selected={monthDays} onChange={setMonthDays} />}

      {/* Counter mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 14px', background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Counter mode</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Show x/total counter instead of checkbox</div>
        </div>
        <button type="button" onClick={() => setEarlyComplete(v => !v)}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: earlyComplete ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s' }}>
          <span style={{ position: 'absolute', top: 3, left: earlyComplete ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
        </button>
      </div>

      {earlyComplete && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>COMPLETIONS PER PERIOD</div>
          <input type="number" min={1} max={99} className="modal-input"
            value={periodTotal} onChange={e => setPeriodTotal(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ marginBottom: 0, width: 80 }} />
        </div>
      )}

      <div className="modal-actions">
        <button className="modal-btn" onClick={onBack}>Back</button>
        <button className="modal-btn primary" onClick={create}>Create</button>
      </div>
    </div>
  );
}
