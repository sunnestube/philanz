const {app, BrowserWindow} = require('electron');
const path = require('path');
const {EventEmitter} = require('events');

// Electron / Chromium attach multiple short-lived `end` listeners on session streams.
// Default (10) trips MaxListenersExceededWarning during DevTools + loadFile; 32 is safe.
if (EventEmitter.defaultMaxListeners < 32) {
    EventEmitter.defaultMaxListeners = 32;
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile(path.join(__dirname, 'dist/bilanz/browser/index.html'));
    // Avoid stacking DevTools listeners on every activate in production builds.
    if (!app.isPackaged) {
        win.webContents.openDevTools({mode: 'detach'});
    }
}

// Register once — duplicate require of main would re-bind and leak `end` listeners.
if (!global.__philanzElectronMainBound) {
    global.__philanzElectronMainBound = true;
    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}
