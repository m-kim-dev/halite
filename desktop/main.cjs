const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const { mkdir, readFile, realpath, rename, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { welcomeURL, isWelcome, isReader, externalURL, cleanRecents, readerPermission } = require('./policy.cjs');
const { createFindController } = require('./find.cjs');

app.setName('Halite');
app.setPath('userData', process.env.HALITE_DESKTOP_STATE_DIR || path.join(app.getPath('appData'), 'halite-desktop'));
protocol.registerSchemesAsPrivileged([{ scheme: 'halite', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let window;
let finder;
let server;
let opening = false;
let quitting = false;
let recents = [];
const recentFile = path.join(app.getPath('userData'), 'recent-projects.json');
const demoPath = path.join(__dirname, 'example');

async function saveRecents() {
  await mkdir(path.dirname(recentFile), { recursive: true });
  await writeFile(`${recentFile}.tmp`, JSON.stringify(recents, null, 2), { mode: 0o600 });
  await rename(`${recentFile}.tmp`, recentFile);
}

function report(error) {
  if (!window || window.isDestroyed()) return;
  void dialog.showMessageBox(window, { type: 'error', title: 'Halite', message: 'Could not open this project', detail: error instanceof Error ? error.message : String(error) });
}

async function openProject(input, { demo = false } = {}) {
  if (opening || quitting) return;
  opening = true;
  finder?.close(false);
  let next;
  const previous = server;
  try {
    const canonical = await realpath(input);
    const { startServer } = await import('../dist/server/server/app.js');
    next = await startServer({ input: canonical, root: demo ? canonical : undefined, port: 0 });
    server = next;
    await window.loadURL(next.url);
    await previous?.close();
    if (!demo) {
      recents = cleanRecents([{ path: canonical }, ...recents]);
      try { await saveRecents(); } catch (error) { console.error('Could not save recent projects:', error); }
    }
    updateMenu();
  } catch (error) {
    server = previous;
    await next?.close();
    if (window && !window.isDestroyed()) await window.loadURL(previous?.url || welcomeURL).catch(() => {});
    report(error);
  } finally { opening = false; }
}

async function chooseProject(kind) {
  if (opening) return;
  const result = await dialog.showOpenDialog(window, kind === 'file' ? {
    title: 'Open a Markdown document', properties: ['openFile'],
    filters: [{ name: 'Markdown documents', extensions: ['md', 'markdown'] }],
  } : { title: 'Open a project folder', properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths[0]) await openProject(result.filePaths[0]);
}

async function showWelcome() {
  if (opening) return;
  opening = true;
  finder?.close(false);
  try {
    await window.loadURL(welcomeURL);
    const previous = server;
    server = undefined;
    await previous?.close();
    updateMenu();
  } finally { opening = false; }
}

function updateMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => void chooseProject('folder') },
      { label: 'Open Markdown File…', accelerator: 'CmdOrCtrl+Shift+O', click: () => void chooseProject('file') },
      { label: 'Recent Projects', submenu: recents.length ? recents.map(item => ({ label: item.name, sublabel: item.path, click: () => void openProject(item.path) })) : [{ label: 'No recent projects', enabled: false }] },
      { type: 'separator' },
      { label: 'Welcome', accelerator: 'CmdOrCtrl+Shift+H', click: () => void showWelcome() },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [
      { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' },
      { label: 'Find in Document…', accelerator: 'CmdOrCtrl+F', enabled: Boolean(server), click: () => void finder?.open().catch(report) },
      { label: 'Find Next', accelerator: 'F3', enabled: Boolean(server), click: () => void Promise.resolve(finder?.next(true)).catch(report) },
      { label: 'Find Previous', accelerator: 'Shift+F3', enabled: Boolean(server), click: () => void Promise.resolve(finder?.next(false)).catch(report) },
    ] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [
      { label: 'Try the Example Project', click: () => void openProject(demoPath, { demo: true }) },
      { label: 'Send Preview Feedback', click: () => void shell.openExternal('https://github.com/m-kim-dev/halite/issues/new?template=preview-feedback.yml').catch(error => console.error('Could not open feedback:', error)) },
      { label: 'About Halite', click: () => void dialog.showMessageBox(window, { type: 'info', title: 'About Halite', message: `Halite ${app.getVersion()} · Desktop preview`, detail: 'A quiet place to read your project.\n\nThis preview is free to try. Desktop pricing is planned at $19 once; purchasing is not available yet.\n\nKeep editing in your favourite editor. Halite follows your changes without modifying your documents.' }) },
    ] },
  ]));
}

function trustedWelcome(event) {
  return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && isWelcome(event.senderFrame.url);
}

ipcMain.handle('halite:welcome', async event => {
  if (!trustedWelcome(event)) throw new Error('This action is only available on the welcome screen.');
  return { version: app.getVersion(), recents };
});
ipcMain.handle('halite:open', async (event, kind, recentPath) => {
  if (!trustedWelcome(event)) throw new Error('This action is only available on the welcome screen.');
  if (kind === 'folder' || kind === 'file') await chooseProject(kind);
  else if (kind === 'example') await openProject(demoPath, { demo: true });
  else if (kind === 'recent' && recents.some(item => item.path === recentPath)) await openProject(recentPath);
  else throw new Error('Unknown project action.');
});
ipcMain.handle('halite:clear-recents', async event => {
  if (!trustedWelcome(event)) throw new Error('This action is only available on the welcome screen.');
  recents = [];
  await saveRecents();
  updateMenu();
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    try { recents = cleanRecents(JSON.parse(await readFile(recentFile, 'utf8'))); } catch { /* First launch or invalid state. */ }
    protocol.handle('halite', request => {
      const url = new URL(request.url);
      const files = { '/index.html': 'index.html', '/launcher.css': 'launcher.css', '/launcher.js': 'launcher.js', '/icon.svg': 'icon.svg', '/find.html': 'find.html', '/find.css': 'find.css', '/find.js': 'find.js' };
      if (url.hostname !== 'app' || !Object.hasOwn(files, url.pathname)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(__dirname, files[url.pathname])).href);
    });
    window = new BrowserWindow({
      width: 1280, height: 860, minWidth: 760, minHeight: 560, title: 'Halite', backgroundColor: '#f8fafc',
      icon: path.join(__dirname, 'icon.png'), show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    finder = createFindController(window, () => server?.url);
    window.webContents.session.setPermissionRequestHandler((contents, permission, callback) => callback(contents === window.webContents && readerPermission(permission, contents.getURL(), server?.url)));
    window.webContents.session.setPermissionCheckHandler((contents, permission, origin) => contents === window.webContents && isReader(origin, server?.url) && readerPermission(permission, contents.getURL(), server?.url));
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('will-navigate', (event, url) => {
      if (!isWelcome(url) && !isReader(url, server?.url)) event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      const safe = externalURL(url);
      if (safe) void shell.openExternal(safe).catch(error => console.error('Could not open link:', error));
      return { action: 'deny' };
    });
    window.webContents.session.on('will-download', event => event.preventDefault());
    window.once('ready-to-show', () => window.show());
    updateMenu();
    await window.loadURL(welcomeURL);
  }).catch(error => { console.error(error); app.quit(); });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void (async () => {
    while (opening) await new Promise(resolve => setTimeout(resolve, 20));
    await server?.close();
  })().catch(console.error).finally(() => app.quit());
});
