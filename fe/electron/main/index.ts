import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

// When packaged, app.isPackaged = true. In dev (electron dist-electron/main.js) it is false.
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // __dirname = dist-electron/main/ — preload is at dist-electron/preload/index.js
  const preloadPath = path.join(__dirname, '../preload/index.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'ERP',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // Dev: load the Vite dev server (run `npm run dev` first, then `npm run dev:electron`)
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: dist-electron/main/index.js is two levels above dist/index.html
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Fire a sync-trigger IPC event every 30 minutes.
  // The 60-second grace period lets the user log in before the first sync fires.
  let syncInterval: ReturnType<typeof setInterval> | null = null;

  mainWindow.webContents.once('did-finish-load', () => {
    const startSync = () => {
      syncInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-trigger');
        }
      }, 30 * 60 * 1000);
    };

    setTimeout(startSync, 60 * 1000);
  });

  mainWindow.on('closed', () => {
    if (syncInterval) clearInterval(syncInterval);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
