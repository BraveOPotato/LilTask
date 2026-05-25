import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface ModalCtx {
  content: ReactNode | null;
  open: (node: ReactNode) => void;
  close: () => void;
}

export const ModalContext = createContext<ModalCtx>({
  content: null,
  open: () => {},
  close: () => {},
});

export function useModal() {
  return useContext(ModalContext);
}

export function useModalState() {
  const [content, setContent] = useState<ReactNode | null>(null);
  const open  = useCallback((node: ReactNode) => setContent(node), []);
  const close = useCallback(() => setContent(null), []);
  return { content, open, close };
}
