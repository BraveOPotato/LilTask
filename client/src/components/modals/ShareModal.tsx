import { useState } from 'react';
import { appStore, PLUGIN_DEFS } from '../../store/AppStore';
import { useStore } from '../../store/useStore';
import { useModal } from '../../context/ModalContext';
import { SyncModal } from './SyncModal';

export function ShareModal() {
  const { close, open } = useModal();
  useStore();
  const activeListId = appStore.activeListId;
  const activeList   = appStore.activeList;
  const [copied, setCopied] = useState(false);

  if (!activeListId || !activeList) return null;

  const syncEnabled = appStore.isListSyncEnabled(activeListId);

  // Sync not enabled — show prompt
  if (!syncEnabled) {
    return (
      <div>
        <div className="modal-title">☁️ Sync Required</div>
        <p style={{ color:'var(--text3)', fontSize:13, marginBottom:16, lineHeight:1.6 }}>
          To share <strong style={{ color:'var(--text)' }}>{activeList.name}</strong>, cloud sync must be enabled for this list.
          Anyone with the share link will collaborate in real time.
        </p>
        <div style={{ padding:'12px 14px', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', marginBottom:18, fontSize:13, color:'var(--text3)' }}>
          💡 Enable sync in <strong style={{ color:'var(--text)' }}>Sidebar → Sync</strong>, or tap below.
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={close}>Cancel</button>
          <button className="modal-btn primary" onClick={() => open(<SyncModal />)}>Enable Sync</button>
        </div>
      </div>
    );
  }

  const shareUrl       = appStore.buildShareUrl(activeListId);
  const enabledPlugins = PLUGIN_DEFS.filter(p => activeList.plugins[p.id]);

  function copy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div className="modal-title">Share list</div>
      <p style={{ color:'var(--text3)', fontSize:13, marginBottom:12 }}>
        Anyone with this link can collaborate in real time — no sign-up needed.
      </p>
      <div className="share-link-box">
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>{shareUrl}</span>
        <button className="share-copy-btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>
      <div style={{ margin:'10px 0 0', padding:'8px 12px', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:12, color:'var(--text3)' }}>
        {enabledPlugins.length > 0
          ? <><span style={{ color:'var(--text2)', fontWeight:600 }}>Plugins included:</span>{enabledPlugins.map(p => <span key={p.id} style={{ marginLeft:6 }}>{p.icon} {p.name}</span>)}</>
          : 'No plugins enabled for this list.'}
      </div>
      <div className="modal-actions">
        <button className="modal-btn primary" onClick={close}>Done</button>
      </div>
    </div>
  );
}
