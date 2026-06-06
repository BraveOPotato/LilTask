import { useEffect, useReducer } from 'react';
import { appStore } from './AppStore';

export function useStore() {
  const [, rerender] = useReducer(x => x + 1, 0);
  useEffect(() => appStore.subscribe(rerender), []);
  return appStore;
}
