import { appStore } from '../store/AppStore';
import { useStore } from '../store/useStore';
import { useModal } from '../context/ModalContext';
import { NewListModal } from './modals/NewListModal';
import { PluginsModal } from './modals/PluginsModal';
import { ThemesModal } from './modals/ThemesModal';
import { SettingsModal } from './modals/SettingsModal';

interface Props {
  view: 'lists' | 'calendar';
  onSwitchView: (v: 'lists' | 'calendar') => void;
  onClose: () => void;
}

export function Sidebar({ view, onSwitchView, onClose }: Props) {
  useStore();
  const lists = appStore.lists;
  const activeListId = appStore.activeListId;
  const { open } = useModal();

  function openNewList() {
    open(<NewListModal onClose={() => {}} />);
  }

  return (
    <nav id="sidebar">
      <div className="sidebar-logo">✦ <span>LilTask</span></div>

      <div className="sidebar-section">Lists</div>

      <div id="lists-nav">
        {lists.map(list => {
          const count   = appStore.getTodos(list.id).length;
          const isActive = list.id === activeListId;
          return (
            <div
              key={list.id}
              className={`list-item ${isActive ? 'active' : ''}`}
              onClick={() => { appStore.switchList(list.id); onClose(); }}
            >
              <div className="li-dot" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {list.name}
              </span>
              <span className="li-count">{count}</span>
              <button
                className="li-delete-btn"
                onClick={e => { e.stopPropagation(); handleDelete(list.id); }}
                title="Delete list"
              >✕</button>
            </div>
          );
        })}
      </div>

      <button id="new-list-btn" onClick={openNewList}>＋ New list</button>

      <div className="sidebar-nav">
        <div className="sidebar-nav-section">Views</div>
        <button className={`nav-btn ${view === 'lists' ? 'active' : ''}`} onClick={() => { onSwitchView('lists'); onClose(); }}>
          <ListsIcon /> Lists
        </button>
        <button className={`nav-btn ${view === 'calendar' ? 'active' : ''}`} onClick={() => { onSwitchView('calendar'); onClose(); }}>
          <CalendarIcon /> Calendar
        </button>

        <div className="sidebar-nav-section">Plugins</div>
        <button className="nav-btn" onClick={() => open(<PluginsModal />)}>
          <PluginsIcon /> Plugins
        </button>

        <div className="sidebar-nav-section">App</div>
        <button className="nav-btn" onClick={() => open(<ThemesModal />)}>
          <ThemeIcon /> Themes
        </button>
        <button className="nav-btn" onClick={() => open(<SettingsModal />)}>
          <SettingsIcon /> Settings
        </button>
      </div>
    </nav>
  );

  function handleDelete(listId: string) {
    const realCount = appStore.lists.length;
    if (realCount <= 1) {
      open(
        <div>
          <div className="modal-title">Can't delete</div>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 16 }}>You need at least one list.</p>
          <div className="modal-actions">
            <button className="modal-btn primary" onClick={() => open(null as any)}>OK</button>
          </div>
        </div>
      );
      return;
    }
    const list = appStore.lists.find(l => l.id === listId);
    open(
      <DeleteListModal name={list?.name ?? ''} onConfirm={() => {
        appStore.deleteList(listId);
        appStore.ensureDefaultList();
      }} />
    );
  }
}

function DeleteListModal({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const { close } = useModal();
  return (
    <div>
      <div className="modal-title">Delete list?</div>
      <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 16 }}>
        Delete <strong style={{ color: 'var(--text)' }}>{name}</strong>? Removes from your device only.
      </p>
      <div className="modal-actions">
        <button className="modal-btn" onClick={close}>Cancel</button>
        <button className="modal-btn" style={{ background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }}
          onClick={() => { onConfirm(); close(); }}>Delete</button>
      </div>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
function ListsIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="11.5" width="8" height="1.5" rx="0.75" fill="currentColor"/></svg>; }
function CalendarIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 7h12" stroke="currentColor" strokeWidth="1.5"/></svg>; }
function PluginsIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2h4v3l2 1-1 2-2-1v2l2 1-1 2-2-1v3H6v-3l-2 1-1-2 2-1v-2l-2 1-1-2 2-1V2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg>; }
function ThemeIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 2.5C8 2.5 5 5 5 8s3 5.5 3 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function SettingsIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
