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

  if (view === 'new') return <NewRecurringForm onBack={() => setView('list')} />;

  return (
    <div>
      <div className="modal-title">🔁 Recurring Tasks</div>
      <div style={{ marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
        {recs.length === 0
          ? <p style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0 4px' }}>No recurring tasks yet.</p>
          : recs.map(r => (
            <div key={r.id} className="rec-manage-row">
              <span className={`rec-badge rec-${r.type}`}>{typeLabel[r.type]}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{r.text}</span>
              <button className="todo-act-btn" onClick={() => {
                const tk = new Date().toISOString().slice(0, 10);
                appStore.deleteRecurringAllFuture(r.id, tk);
              }}>✕</button>
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

function NewRecurringForm({ onBack }: { onBack: () => void }) {
  const [text,          setText]         = useState('');
  const [type,          setType]         = useState<RecurrenceType>('daily');
  const [periodTotal,   setPeriodTotal]  = useState(1);
  const [earlyComplete, setEarlyComplete] = useState(false);

  function create() {
    if (!text.trim()) return;
    appStore.addRecurring(text.trim(), type, periodTotal, earlyComplete);
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

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>RECURRENCE TYPE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'weekly', 'monthly'] as RecurrenceType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className="modal-btn"
              style={{ flex: 1, background: type === t ? 'var(--accent)' : undefined, borderColor: type === t ? 'var(--accent)' : undefined, color: type === t ? '#fff' : undefined }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 14px', background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Counter mode</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Show x/total counter instead of checkbox</div>
        </div>
        <button onClick={() => setEarlyComplete(v => !v)}
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: earlyComplete ? 'var(--accent)' : 'var(--border)', transition: 'background 0.2s' }}>
          <span style={{ position: 'absolute', top: 3, left: earlyComplete ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
        </button>
      </div>

      {earlyComplete && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>COMPLETIONS PER PERIOD</div>
          <input
            type="number" min={1} max={99}
            className="modal-input"
            value={periodTotal}
            onChange={e => setPeriodTotal(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ marginBottom: 0, width: 80 }}
          />
        </div>
      )}

      <div className="modal-actions">
        <button className="modal-btn" onClick={onBack}>Back</button>
        <button className="modal-btn primary" onClick={create}>Create</button>
      </div>
    </div>
  );
}
