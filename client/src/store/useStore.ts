import { useEffect, useReducer } from 'react';
import { appStore } from './AppStore';

/** Forces re-render whenever appStore notifies. Returns nothing — read from appStore directly. */
export function useStore() {
  const [, rerender] = useReducer(x => x + 1, 0);
  useEffect(() => appStore.subscribe(rerender), []);
  return appStore;
}
