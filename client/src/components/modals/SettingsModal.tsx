import { useState } from 'react';
import { appStore } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';

export function SettingsModal() {
  const { close } = useModal();
  const { offlineMode, workerUrl } = useStore();
  const [urlInput, setUrlInput] = useState(workerUrl.includes('YOUR_WORKER') ? '' : workerUrl);

  function save() {
    if (urlInput.trim()) appStore.setWorkerUrl(urlInput.trim());
    close();
  }

  function reset() {
    appStore.setWorkerUrl('https://liltask-sync.abdullahalkafajy.workers.dev/');
    close();
  }

  const dim = offlineMode ? { opacity: 0.38, pointerEvents: 'none' as const } : {};

  return (
    <div>
      <div className="modal-title">⚙️ Settings</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Offline Mode</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Disable all sync. Data stays local only.</div>
        </div>
        <button
          onClick={() => appStore.setOfflineMode(!offlineMode)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            position: 'relative', flexShrink: 0,
            background: offlineMode ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3,
            left: offlineMode ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s', display: 'block',
          }} />
        </button>
      </div>

      <div style={dim}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: 'var(--text2)', marginBottom: 6, fontFamily: 'var(--mono)' }}>CLOUDFLARE WORKER URL</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>Your deployed D1-backed worker for sync.</div>
        <div style={{ background: 'var(--bg3)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all', marginBottom: 10 }}>
          {workerUrl}
        </div>
        <input
          className="modal-input"
          placeholder="https://your-worker.workers.dev"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          autoComplete="off"
          style={{ marginBottom: 0 }}
          tabIndex={offlineMode ? -1 : 0}
        />
      </div>

      <div className="modal-actions">
        <button className="modal-btn" onClick={reset}>Reset Default</button>
        <button className="modal-btn" onClick={close}>Cancel</button>
        <button className="modal-btn primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}
