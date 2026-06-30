import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isElectron: true as const,
  onSyncTrigger: (callback: () => void) => {
    ipcRenderer.on('sync-trigger', () => callback());
  },
  removeSyncTrigger: () => {
    ipcRenderer.removeAllListeners('sync-trigger');
  },
});
