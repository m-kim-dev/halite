const { contextBridge, ipcRenderer } = require('electron');

// Project documents get no filesystem or IPC bridge.
if (location.href === 'halite://app/index.html') {
  contextBridge.exposeInMainWorld('halite', {
    welcome: () => ipcRenderer.invoke('halite:welcome'),
    openFolder: () => ipcRenderer.invoke('halite:open', 'folder'),
    openFile: () => ipcRenderer.invoke('halite:open', 'file'),
    openExample: () => ipcRenderer.invoke('halite:open', 'example'),
    openRecent: path => ipcRenderer.invoke('halite:open', 'recent', path),
    clearRecents: () => ipcRenderer.invoke('halite:clear-recents'),
  });
}
