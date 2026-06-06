import { useState } from 'react';
import { appStore } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';

export function SyncModal() {
  const { close } = useModal();
  useStore();
  const activeListId = appStore.activeListId;
  const activeList   = appStore.activeList;
  const workerUrl    = appStore.workerUrl;
  const syncEnabled  = activeListId ? appStore.isListSyncEnabled(activeListId) : false;
  const [urlInput, setUrlInput] = useState(
    workerUrl.includes('YOUR_WORKER') ? '' : workerUrl
  );

  if (!activeListId || !activeList) return null;

  function toggleSync() {
    appStore.setListSyncEnabled(activeListId!, !syncEnabled);
  }

  function saveUrl() {
    if (urlInput.trim()) appStore.setWorkerUrl(urlInput.trim());
    close();
  }

  const statusDot = syncEnabled
    ? <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--green)', marginRight:6 }} />
    : <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--text3)', marginRight:6 }} />;

  return (
    <div>
      <div className="modal-title">☁️ Cloud Sync</div>
      <p style={{ color:'var(--text3)', fontSize:13, marginBottom:16 }}>
        Applies to: <strong style={{ color:'var(--text)' }}>{activeList.name}</strong>
      </p>

      {/* Per-list sync toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg3)', border:`1.5px solid ${syncEnabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius:'var(--radius)', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3, display:'flex', alignItems:'center' }}>
            {statusDot}
            {syncEnabled ? 'Sync enabled' : 'Sync disabled'}
          </div>
          <div style={{ fontSize:12, color:'var(--text3)', paddingLeft:14 }}>
            {syncEnabled
              ? 'This list syncs to the cloud and can be shared.'
              : 'This list is local only. Enable sync to collaborate.'}
          </div>
        </div>
        <button onClick={toggleSync}
          style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', position:'relative', flexShrink:0, background: syncEnabled ? 'var(--accent)' : 'var(--border)', transition:'background 0.2s' }}>
          <span style={{ position:'absolute', top:3, left: syncEnabled ? 23 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', display:'block' }} />
        </button>
      </div>

      {/* Worker URL config */}
      <div style={{ opacity: syncEnabled ? 1 : 0.45, transition:'opacity 0.2s', pointerEvents: syncEnabled ? 'auto' : 'none' }}>
        <div style={{ fontSize:12, fontWeight:700, letterSpacing:0.5, color:'var(--text2)', marginBottom:6, fontFamily:'var(--mono)' }}>CLOUDFLARE WORKER URL</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8, lineHeight:1.5 }}>
          The D1-backed worker that handles real-time sync.
        </div>
        <div style={{ background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px', fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', wordBreak:'break-all', marginBottom:8 }}>
          {workerUrl}
        </div>
        <input
          className="modal-input"
          placeholder="https://your-worker.workers.dev"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          autoComplete="off"
          style={{ marginBottom:0 }}
        />
      </div>

      <div className="modal-actions">
        <button className="modal-btn" onClick={close}>Cancel</button>
        <button className="modal-btn primary" onClick={saveUrl}>Save</button>
      </div>
    </div>
  );
}
