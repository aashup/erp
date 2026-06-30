"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    onSyncTrigger: (callback) => {
        electron_1.ipcRenderer.on('sync-trigger', () => callback());
    },
    removeSyncTrigger: () => {
        electron_1.ipcRenderer.removeAllListeners('sync-trigger');
    },
});
