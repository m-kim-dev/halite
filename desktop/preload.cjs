const { contextBridge, ipcRenderer } = require('electron');
const expected = process.argv.find(value => value.startsWith('--halite-workspace='))?.slice('--halite-workspace='.length);
// The bridge is only exposed in this window's exact top-level workspace.
if (process.isMainFrame && expected && location.href === expected) {
  contextBridge.exposeInMainWorld('haliteDesktop', {
    open: (kind, mode) => ipcRenderer.invoke('halite:desktop-open', kind, mode),
    openWorkspace: id => ipcRenderer.invoke('halite:desktop-window', id),
    changed: () => ipcRenderer.send('halite:desktop-changed'),
    onAction: callback => {
      const listener = (_event, action) => callback(action);
      ipcRenderer.on('halite:workspace-action', listener);
      return () => ipcRenderer.removeListener('halite:workspace-action', listener);
    },
  });
}
