import { useState, useEffect } from 'react';
import { ModalContext, useModalState } from './context/ModalContext';
import { Modal } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TodoView } from './components/TodoView';
import { CalendarView } from './components/CalendarView';
import { Celebration } from './components/Celebration';
import { NewListModal } from './components/modals/NewListModal';
import { appStore } from './store/AppStore';

export default function App() {
  const modal = useModalState();
  const [view, setView] = useState<'lists' | 'calendar'>('lists');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Handle URL room
    const parsed = appStore.parseRoomFromURL();
    if (parsed) {
      appStore.joinRoom(parsed.roomId, parsed.name, parsed.plugins);
    }

    appStore.ensureDefaultList();

    // Open new-list modal if only placeholder
    const realLists = appStore.lists;
    if (realLists.length === 0) {
      modal.open(<NewListModal onClose={() => {}} />);
    }

    appStore.startPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSidebar() { setSidebarOpen(v => !v); }
  function closeSidebar()  { setSidebarOpen(false);   }

  return (
    <ModalContext.Provider value={modal}>
      <div id="app">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div id="sidebar-backdrop" className="active" onClick={closeSidebar} />
        )}

        <div id="sidebar" className={sidebarOpen ? 'open' : ''}>
          <Sidebar
            view={view}
            onSwitchView={v => { setView(v); closeSidebar(); }}
            onClose={closeSidebar}
          />
        </div>

        <div id="main">
          <Header onMenuToggle={toggleSidebar} />

          {view === 'lists'    && <TodoView />}
          {view === 'calendar' && <CalendarView />}
        </div>
      </div>

      <Celebration />
      <Modal />
    </ModalContext.Provider>
  );
}
