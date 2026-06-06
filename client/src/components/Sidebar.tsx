import { appStore } from '../store/AppStore';
import { useStore } from '../store/useStore';
import { useModal } from '../context/ModalContext';
import { NewListModal } from './modals/NewListModal';
import { PluginsModal } from './modals/PluginsModal';
import { ThemesModal } from './modals/ThemesModal';
import { SettingsModal } from './modals/SettingsModal';
import { ShareModal } from './modals/ShareModal';
import { SyncModal } from './modals/SyncModal';

interface Props {
  onClose: () => void;
}

// Renders sidebar *contents* only — App.tsx owns the <nav id="sidebar"> wrapper
export function Sidebar({ onClose }: Props) {
  useStore();
  const lists = appStore.lists;
  const activeListId = appStore.activeListId;
  const { open, close } = useModal();

  function handleDelete(listId: string) {
    if (appStore.lists.length <= 1) {
      open(<div>
        <div className="modal-title">Can't delete</div>
        <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 16 }}>You need at least one list.</p>
        <div className="modal-actions"><button className="modal-btn primary" onClick={close}>OK</button></div>
      </div>);
      return;
    }
    const list = appStore.lists.find(l => l.id === listId);
    open(<div>
      <div className="modal-title">Delete list?</div>
      <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 16 }}>
        Delete <strong style={{ color: 'var(--text)' }}>{list?.name}</strong>? Removes from your device only.
      </p>
      <div className="modal-actions">
        <button className="modal-btn" onClick={close}>Cancel</button>
        <button className="modal-btn" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
          onClick={() => { appStore.deleteList(listId); appStore.ensureDefaultList(); close(); }}>Delete</button>
      </div>
    </div>);
  }

  return (
    <>
      <div className="sidebar-logo">✦ <span>LilTask</span></div>

      <div className="sidebar-section">Lists</div>

      <div id="lists-nav">
        {lists.map(list => {
          const count    = appStore.getTodos(list.id).length;
          const isActive = list.id === activeListId;
          return (
            <div key={list.id} className={`list-item ${isActive ? 'active' : ''}`}
              onClick={() => { appStore.switchList(list.id); onClose(); }}>
              <div className="li-dot" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
              <span className="li-count">{count}</span>
              <button className="li-delete-btn" title="Delete list"
                onClick={e => { e.stopPropagation(); handleDelete(list.id); }}>✕</button>
            </div>
          );
        })}
      </div>

      <button id="new-list-btn" onClick={() => open(<NewListModal onClose={close} />)}>＋ New list</button>

      <div className="sidebar-nav">
        <div className="sidebar-nav-section">Current list settings</div>
        <button className="nav-btn" onClick={() => open(<PluginsModal />)}><PluginsIcon /> Plugins</button>
        <button className="nav-btn" onClick={() => open(<SyncModal />)}><SyncIcon /> Sync</button>
        <button className="nav-btn" onClick={() => open(<ShareModal />)}><ShareIcon /> Share list</button>

        <div className="sidebar-nav-section">App</div>
        <button className="nav-btn" onClick={() => open(<ThemesModal />)}><ThemeIcon /> Themes</button>
        <button className="nav-btn" onClick={() => open(<SettingsModal />)}><SettingsIcon /> Settings</button>
      </div>
    </>
  );
}

function PluginsIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2h4v3l2 1-1 2-2-1v2l2 1-1 2-2-1v3H6v-3l-2 1-1-2 2-1v-2l-2 1-1-2 2-1V2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg>; }
function SyncIcon()     { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 3.9 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 1v3.5H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function ShareIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M6 7l4-2M6 9l4 2" stroke="currentColor" strokeWidth="1.5"/></svg>; }
function ThemeIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 2.5C8 2.5 5 5 5 8s3 5.5 3 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function SettingsIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
