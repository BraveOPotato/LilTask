import { useStore } from '../store/useStore';

interface Props {
  onMenuToggle: () => void;
  view: 'lists' | 'calendar';
  onSwitchView: (v: 'lists' | 'calendar') => void;
}

export function Header({ onMenuToggle, view, onSwitchView }: Props) {
  const store = useStore();
  const activeList = store.activeList;
  const syncStatus = store.syncStatus;

  const dotClass = `sync-dot ${syncStatus}`;
  const label    = syncStatus === 'synced' ? 'synced'
    : syncStatus === 'syncing' ? 'syncing…'
    : syncStatus === 'error'   ? 'error'
    : 'offline';

  const isCalendar = view === 'calendar';

  return (
    <header id="header">
      <button id="menu-toggle" onClick={onMenuToggle}>☰</button>
      <div id="header-title">{activeList?.name ?? ''}</div>
      <div id="sync-status">
        <div className={dotClass} />
        <span>{label}</span>
      </div>
      <button className="header-btn" onClick={() => onSwitchView(isCalendar ? 'lists' : 'calendar')}>
        {isCalendar ? <ListsIcon /> : <CalendarIcon />}
        {isCalendar ? 'Lists' : 'Calendar'}
      </button>
    </header>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function ListsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="2" y="11.5" width="8" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  );
}
