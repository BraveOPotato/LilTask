import { useSyncExternalStore } from 'react';
import { appStore } from '../store/AppStore';
import { RecurringTask } from '../models';
import { useModal } from '../context/ModalContext';
import { RecurringModal } from './modals/RecurringModal';

interface Props { listId: string; }

export function RecurringSection({ listId: _listId }: Props) {
  const { open } = useModal();

  const recs = useSyncExternalStore(
    cb => appStore.subscribe(cb),
    () => appStore.getActiveRecurring(),
  );

  const daily   = recs.filter(r => r.type === 'daily');
  const weekly  = recs.filter(r => r.type === 'weekly');
  const monthly = recs.filter(r => r.type === 'monthly');
  const anyRec  = recs.length > 0;

  if (!anyRec) return null;

  function RecGroup({ label, tasks, type }: { label: string; tasks: RecurringTask[]; type: string }) {
    if (!tasks.length) return null;
    let totalSlots = 0, doneSlots = 0;
    tasks.forEach(r => {
      const pk = r.getPeriodKey();
      totalSlots += r.periodTotal;
      doneSlots  += Math.min(appStore.getRecurringCompletionCount(r.id, pk), r.periodTotal);
    });
    const pct = totalSlots ? Math.round((doneSlots / totalSlots) * 100) : 0;

    return (
      <>
        <div className="rec-group-header">
          <span className={`rec-type-badge rec-${type}`}>{label}</span>
          <div className="rec-mini-bar"><div className="rec-mini-fill" style={{ width: pct + '%' }} /></div>
          <span className="rec-mini-label">{doneSlots}/{totalSlots}</span>
        </div>
        {tasks.map(rec => {
          const pk     = rec.getPeriodKey();
          const done   = appStore.isRecurringDone(rec, pk);
          const count  = Math.min(appStore.getRecurringCompletionCount(rec.id, pk), rec.periodTotal);

          return (
            <div key={rec.id} className={`todo-item rec-todo-item ${done ? 'done' : ''}`}>
              <div className="drag-handle" style={{ opacity: 0.2, pointerEvents: 'none' }}>⣿</div>
              {rec.earlyCompletion ? (
                <button
                  className={`rec-counter-btn ${done ? 'rec-counter-done' : ''}`}
                  onClick={() => appStore.toggleRecurringCompletion(rec, pk)}
                >
                  <span className="rec-counter-val">{count}</span>
                  <span className="rec-counter-sep">/</span>
                  <span className="rec-counter-tot">{rec.periodTotal}</span>
                </button>
              ) : (
                <button
                  className={`todo-check ${done ? 'checked' : ''}`}
                  onClick={() => appStore.toggleRecurringCompletion(rec, pk)}
                />
              )}
              <div className="todo-text" style={{ flex: 1 }}>{rec.text}</div>
              <div className="todo-actions">
                <button className="todo-act-btn" onClick={() => handleDelete(rec.id)}>✕</button>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  function handleDelete(recId: string) {
    const tk = new Date().toISOString().slice(0, 10);
    open(
      <div>
        <div className="modal-title">Delete recurring task?</div>
        <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 16 }}>Remove just today, or all future?</p>
        <div className="modal-actions">
          <button className="modal-btn" onClick={() => open(null as any)}>Cancel</button>
          <button className="modal-btn" onClick={() => { appStore.deleteRecurringOnce(recId, tk); open(null as any); }}>Just today</button>
          <button className="modal-btn" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
            onClick={() => { appStore.deleteRecurringAllFuture(recId, tk); open(null as any); }}>All future</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section-header">
        🔁 Recurring <span className="sh-count">{recs.length}</span>
        <button
          onClick={() => open(<RecurringModal />)}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer' }}
        >Manage</button>
      </div>
      <RecGroup label="Daily"   tasks={daily}   type="daily"   />
      <RecGroup label="Weekly"  tasks={weekly}  type="weekly"  />
      <RecGroup label="Monthly" tasks={monthly} type="monthly" />
    </>
  );
}
