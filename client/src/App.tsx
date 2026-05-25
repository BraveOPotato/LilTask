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
    const parsed = appStore.parseRoomFromURL();
    if (parsed) appStore.joinRoom(parsed.roomId, parsed.name, parsed.plugins);
    appStore.ensureDefaultList();
    if (appStore.lists.length === 0) modal.open(<NewListModal onClose={() => {}} />);
    appStore.startPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalContext.Provider value={modal}>
      <div id="app">
        {sidebarOpen && <div id="sidebar-backdrop" className="active" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar: single element owns #sidebar id + open class */}
        <nav id="sidebar" className={sidebarOpen ? 'open' : ''}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </nav>

        <div id="main">
          <Header
            onMenuToggle={() => setSidebarOpen(v => !v)}
            view={view}
            onSwitchView={setView}
          />
          {view === 'lists'    && <TodoView />}
          {view === 'calendar' && <CalendarView />}
        </div>
      </div>

      <Celebration />
      <Modal />
    </ModalContext.Provider>
  );
}
