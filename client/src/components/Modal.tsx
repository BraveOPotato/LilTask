import { useEffect, useRef } from 'react';
import { useModal } from '../context/ModalContext';

export function Modal() {
  const { content, close } = useModal();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  if (!content) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" ref={ref}>
        {content}
      </div>
    </div>
  );
}
