import { useStore } from '../store/useStore';
import { useModal } from '../context/ModalContext';
import { ShareModal } from './modals/ShareModal';

interface Props {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: Props) {
  const { activeList, syncStatus } = useStore();
  const { open } = useModal();

  const dotClass = `sync-dot ${syncStatus}`;
  const label    = syncStatus === 'synced' ? 'synced'
    : syncStatus === 'syncing' ? 'syncing…'
    : syncStatus === 'error'   ? 'error'
    : 'offline';

  return (
    <header id="header">
      <button id="menu-toggle" onClick={onMenuToggle}>☰</button>
      <div id="header-title">{activeList?.name ?? ''}</div>
      <div id="sync-status">
        <div className={dotClass} />
        <span>{label}</span>
      </div>
      <button className="header-btn" onClick={() => open(<ShareModal />)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="12" cy="4"  r="2" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="4"  cy="8"  r="2" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 7l4-2M6 9l4 2" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        Share
      </button>
    </header>
  );
}
