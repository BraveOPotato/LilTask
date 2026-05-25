import { useState } from 'react';
import { appStore, LIST_TEMPLATES } from '../../store/AppStore';
import type { ListTemplate } from '../../store/AppStore';
import { useModal } from '../../context/ModalContext';

interface Props { onClose: () => void; }

export function NewListModal({ onClose }: Props) {
  const { close } = useModal();
  const [selected, setSelected] = useState<ListTemplate | null>(null);
  const [name, setName]         = useState('');

  function selectTemplate(t: ListTemplate) {
    setSelected(t);
    if (!name.trim()) setName(t.defaultName);
  }

  function create() {
    const n = name.trim() || selected?.defaultName || 'Untitled';
    if (!n) return;

    // Remove placeholder if exists
  
    const id = appStore.createList(n, undefined, selected?.plugins);
    appStore.switchList(id);
    close();
    onClose();
  }

  return (
    <div>
      <div className="modal-title">New list</div>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>Choose a template to get started.</p>

      {LIST_TEMPLATES.map(t => {
        const active = selected?.id === t.id;
        return (
          <div
            key={t.id}
            onClick={() => selectTemplate(t)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 'var(--radius)',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent-glow)' : 'var(--bg3)',
              cursor: 'pointer', marginBottom: 8, transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 24 }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.desc}</div>
            </div>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
          </div>
        );
      })}

      <input
        className="modal-input"
        placeholder="List name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); }}
        autoComplete="off"
        style={{ marginTop: 4 }}
        autoFocus
      />

      <div className="modal-actions">
        <button className="modal-btn" onClick={close}>Cancel</button>
        <button className="modal-btn primary" onClick={create}>Create</button>
      </div>
    </div>
  );
}
