import { useSyncExternalStore } from 'react';
import { appStore } from './AppStore';

export function useStore() {
  return useSyncExternalStore(
    (cb) => appStore.subscribe(cb),
    () => ({
      lists:        appStore.lists,
      activeListId: appStore.activeListId,
      activeList:   appStore.activeList,
      syncStatus:   appStore.syncStatus,
      theme:        appStore.theme,
      offlineMode:  appStore.offlineMode,
      workerUrl:    appStore.workerUrl,
    }),
  );
}
