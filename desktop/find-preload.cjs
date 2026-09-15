const { contextBridge, ipcRenderer } = require('electron');

if (location.href === 'halite://app/find.html') {
  contextBridge.exposeInMainWorld('haliteFind', {
    search: (text, options) => ipcRenderer.invoke('halite:find-query', text, options),
    close: () => ipcRenderer.invoke('halite:find-close'),
    onResult: callback => ipcRenderer.on('halite:find-result', (_event, result) => callback(result)),
    onFocus: callback => ipcRenderer.on('halite:find-focus', () => callback()),
  });
}
