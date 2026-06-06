import { useState } from 'react';
import { appStore } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';

export function SettingsModal() {
  const { close } = useModal();
  useStore();
  const workerUrl = appStore.workerUrl;
  const [urlInput, setUrlInput] = useState(workerUrl.includes('YOUR_WORKER') ? '' : workerUrl);

  function save() {
    if (urlInput.trim()) appStore.setWorkerUrl(urlInput.trim());
    close();
  }

  function reset() {
    appStore.setWorkerUrl('https://liltask-sync.abdullahalkafajy.workers.dev/');
    close();
  }

  return (
    <div>
      <div className="modal-title">⚙️ Settings</div>

      <div style={{ fontSize:12, fontWeight:700, letterSpacing:0.5, color:'var(--text2)', marginBottom:6, fontFamily:'var(--mono)' }}>CLOUDFLARE WORKER URL</div>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, lineHeight:1.5 }}>
        Global sync endpoint used by all lists with cloud sync enabled.
      </div>
      <div style={{ background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', wordBreak:'break-all', marginBottom:10 }}>
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

      <div className="modal-actions">
        <button className="modal-btn" onClick={reset}>Reset Default</button>
        <button className="modal-btn" onClick={close}>Cancel</button>
        <button className="modal-btn primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}
