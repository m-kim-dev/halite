const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isReader, isWorkspace, externalURL } = require('./policy.cjs');
const { createFindController } = require('./find.cjs');

app.setName('Halite');
app.setPath('userData', process.env.HALITE_DESKTOP_STATE_DIR || path.join(app.getPath('appData'), 'halite-desktop'));
protocol.registerSchemesAsPrivileged([{ scheme: 'halite', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const windows = new Map();
let client;
let origin;
let quitting = false;
let syncing = false;
let poll;
let mode = 'tab';
const demoPath = path.join(__dirname, 'example');
const focused = () => [...windows.values()].find(item => item.window.isFocused() || item.finder.isFocused()) || [...windows.values()].at(-1);
const report = (error, entry = focused()) => {
  if (entry && !entry.window.isDestroyed()) void dialog.showMessageBox(entry.window, { type: 'error', title: 'Halite', message: 'Could not complete this action', detail: error instanceof Error ? error.message : String(error) });
};
const run = action => void Promise.resolve().then(action).catch(report);
const sendAction = action => focused()?.window.webContents.send('halite:workspace-action', action);
const workspaceURL = id => `${origin}/workspaces/${id}/`;

async function syncWindows() {
  if (syncing || quitting) return;
  syncing = true;
  try {
    const status = await client.serviceCommand({ action: 'status' });
    if (quitting) return;
    mode = status.mode;
    for (const w of status.workspaces.filter(w => w.kind === 'desktop')) {
      if (!windows.has(w.id)) await createWindow(w.id);
      const entry = windows.get(w.id);
      if (entry && entry.active !== w.active) { entry.active = w.active; entry.finder.close(false); }
    }
    updateMenu();
  } finally { syncing = false; }
}
async function openProject(input, entry = focused(), selectedMode, demo = false) {
  const result = await client.serviceCommand({ action: 'open', input, workspace: entry?.id, mode: selectedMode, kind: 'desktop', demo, root: demo ? demoPath : undefined });
  await syncWindows();
  if (result.kind === 'desktop') {
    const target = windows.get(result.workspace) || await createWindow(result.workspace);
    if (target.window.isMinimized()) target.window.restore(); target.window.show(); target.window.focus();
  } else if (result.shouldOpen) await shell.openExternal(result.url);
}
async function chooseProject(kind, entry = focused(), selectedMode) {
  if (kind === 'example') return openProject(demoPath, entry, selectedMode, true);
  if (!['file', 'folder'].includes(kind)) throw new Error('Unknown project action.');
  const result = await dialog.showOpenDialog(entry?.window, kind === 'file' ? {
    title: 'Open a Markdown document', properties: ['openFile'], filters: [{ name: 'Markdown documents', extensions: ['md', 'markdown'] }],
  } : { title: 'Open a project folder', properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths[0]) await openProject(result.filePaths[0], entry, selectedMode);
}
async function newWindow() {
  const result = await client.serviceCommand({ action: 'new-window', kind: 'desktop' });
  await createWindow(result.workspace);
}
function updateMenu() {
  const entry = focused();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'New Project Tab', accelerator: 'CmdOrCtrl+T', click: () => sendAction('welcome') },
      { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => run(newWindow) },
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => run(() => chooseProject('folder')) },
      { label: 'Open Markdown File…', accelerator: 'CmdOrCtrl+Shift+O', click: () => run(() => chooseProject('file')) },
      { label: 'Open Folder in New Tab…', click: () => run(() => chooseProject('folder', focused(), 'tab')) },
      { label: 'Open Folder in New Window…', click: () => run(() => chooseProject('folder', focused(), 'window')) },
      { label: 'Open Projects In', submenu: ['tab', 'window'].map(value => ({ label: value === 'tab' ? 'Tabs' : 'Windows', type: 'radio', checked: mode === value, click: () => run(async () => { await client.serviceCommand({ action: 'settings', mode: value }); mode = value; updateMenu(); }) })) },
      { type: 'separator' },
      { label: 'Welcome', accelerator: 'CmdOrCtrl+Shift+H', click: () => sendAction('welcome') },
      { label: 'Close Project Tab', accelerator: 'CmdOrCtrl+W', enabled: Boolean(entry?.active), click: () => sendAction('w') },
      { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', click: () => focused()?.window.close() },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [
      { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' },
      { label: 'Find in Document…', accelerator: 'CmdOrCtrl+F', enabled: Boolean(entry?.active), click: () => run(() => focused()?.finder.open()) },
      { label: 'Find Next', accelerator: 'F3', enabled: Boolean(entry?.active), click: () => run(() => focused()?.finder.next(true)) },
      { label: 'Find Previous', accelerator: 'Shift+F3', enabled: Boolean(entry?.active), click: () => run(() => focused()?.finder.next(false)) },
    ] },
    { label: 'View', submenu: [
      { label: 'Next Project', accelerator: 'Ctrl+Tab', click: () => sendAction('Tab') },
      { label: 'Previous Project', accelerator: 'Ctrl+Shift+Tab', click: () => sendAction('previous') },
      { type: 'separator' }, { role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' },
    ] },
    { label: 'Help', submenu: [
      { label: 'Try the Example Project', click: () => run(() => openProject(demoPath, focused(), undefined, true)) },
      { label: 'Send Preview Feedback', click: () => run(() => shell.openExternal('https://github.com/m-kim-dev/halite/issues/new?template=preview-feedback.yml')) },
      { label: 'About Halite', click: () => run(() => dialog.showMessageBox(focused()?.window, { type: 'info', title: 'About Halite', message: `Halite ${app.getVersion()} · Desktop preview`, detail: 'A quiet place to read your projects.\n\nProject tabs and windows share one local service. This preview is free to try. Documents stay read-only.' })) },
    ] },
  ]));
}

function trusted(event) {
  const entry = [...windows.values()].find(entry => entry.window.webContents === event.sender);
  if (!entry || event.senderFrame !== event.sender.mainFrame || !isWorkspace(event.senderFrame.url, workspaceURL(entry.id))) throw new Error('This action is only available from its built-in workspace.');
  return entry;
}
ipcMain.handle('halite:desktop-open', (event, kind, selectedMode) => {
  const entry = trusted(event);
  if (selectedMode !== undefined && !['tab', 'window'].includes(selectedMode)) throw new Error('Choose tabs or windows.');
  return chooseProject(kind, entry, selectedMode);
});
ipcMain.handle('halite:desktop-window', async (event, id) => {
  trusted(event);
  const status = await client.serviceCommand({ action: 'status' });
  const w = status.workspaces.find(w => w.id === id);
  if (!w) throw new Error('This window is closed.');
  if (w.kind === 'browser') { if (!w.connected) await shell.openExternal(w.url); return; }
  const entry = windows.get(id) || await createWindow(id);
  entry.window.show(); entry.window.focus();
});
ipcMain.on('halite:desktop-changed', event => {
  try { trusted(event).finder.close(false); run(syncWindows); } catch { /* No bridge outside the workspace. */ }
});

async function createWindow(id) {
  if (windows.has(id)) return windows.get(id);
  const window = new BrowserWindow({
    width: 1280, height: 900, minWidth: 760, minHeight: 560, title: 'Halite', backgroundColor: '#f8fafc',
    icon: path.join(__dirname, 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, additionalArguments: [`--halite-workspace=${workspaceURL(id)}`] },
  });
  const entry = { id, window, finder: undefined, active: null };
  entry.finder = createFindController(window, () => workspaceURL(id), () => entry.active);
  windows.set(id, entry);
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    const key = input.key.toLowerCase();
    if (key === 'f') { event.preventDefault(); if (entry.active) run(() => entry.finder.open()); }
    else if (key === 'w' && input.shift) { event.preventDefault(); window.close(); }
    else if (key === 't' || key === 'w' || key === 'tab') { event.preventDefault(); window.webContents.send('halite:workspace-action', key === 't' ? 'welcome' : key === 'tab' ? input.shift ? 'previous' : 'Tab' : 'w'); }
    else if (key === 'n') { event.preventDefault(); run(newWindow); }
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => { if (!isWorkspace(url, workspaceURL(id))) event.preventDefault(); });
  window.webContents.on('will-frame-navigate', details => {
    if (!details.isMainFrame && !isReader(details.url, origin)) details.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    const safe = externalURL(url);
    if (safe) run(() => shell.openExternal(safe));
    return { action: 'deny' };
  });
  window.on('focus', () => { updateMenu(); void client.serviceCommand({ action: 'focus', workspace: id }).catch(() => {}); });
  let closing = false;
  window.on('close', event => {
    if (closing) return;
    event.preventDefault(); closing = true; entry.finder.close(false);
    // Let every reader flush its pending state before its frame is destroyed.
    void window.webContents.executeJavaScript(`Promise.all(Array.from(document.querySelectorAll('iframe')).map(frame => new Promise(resolve => {
      const request = crypto.randomUUID();
      const done = () => { clearTimeout(timer); window.removeEventListener('message', receive); resolve(); };
      const receive = event => { if (event.source === frame.contentWindow && event.origin === location.origin && event.data?.request === request && event.data?.type === 'halite:flushed') done(); };
      const timer = setTimeout(done, 1000); window.addEventListener('message', receive);
      frame.contentWindow.postMessage({ type: 'halite:flush', request }, location.origin);
    })))`).catch(() => {}).finally(async () => {
      await client.serviceCommand({ action: 'close-window', workspace: id }).catch(() => {});
      if (!window.isDestroyed()) window.destroy();
    });
  });
  window.on('closed', () => { windows.delete(id); void client.serviceCommand({ action: 'close-window', workspace: id }).catch(() => {}); updateMenu(); });
  await window.loadURL(workspaceURL(id)); window.show();
  updateMenu(); return entry;
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const entry = focused(); if (entry) { if (entry.window.isMinimized()) entry.window.restore(); entry.window.focus(); } });
  app.whenReady().then(async () => {
    client = await import('../dist/server/server/client.js');
    const status = await client.ensureService(); origin = status.url;
    protocol.handle('halite', request => {
      const url = new URL(request.url);
      const files = { '/find.html': 'find.html', '/find.css': 'find.css', '/find.js': 'find.js' };
      if (url.hostname !== 'app' || !Object.hasOwn(files, url.pathname)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(__dirname, files[url.pathname])).href);
    });
    const { session } = require('electron');
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback([...windows.values()].some(e => e.window.webContents === contents) && permission === 'clipboard-sanitized-write'));
    session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => [...windows.values()].some(e => e.window.webContents === contents) && isReader(requestingOrigin, origin) && permission === 'clipboard-sanitized-write');
    session.defaultSession.on('will-download', event => event.preventDefault());
    await newWindow();
    poll = setInterval(() => void syncWindows().catch(() => {}), 1000);
  }).catch(error => { console.error(error); app.quit(); });
}
app.on('window-all-closed', () => { if (!quitting) app.quit(); });
let readyToQuit = false;
app.on('before-quit', event => {
  if (readyToQuit) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true; clearInterval(poll);
  const closing = [...windows.values()].map(({ window }) => new Promise(resolve => {
    if (window.isDestroyed()) return resolve();
    window.once('closed', resolve); window.close();
  }));
  void Promise.all(closing).finally(() => { readyToQuit = true; app.quit(); });
});
