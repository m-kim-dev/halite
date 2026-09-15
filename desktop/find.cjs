const { BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { isReader } = require('./policy.cjs');

const findURL = 'halite://app/find.html';

function createFindController(parent, readerOrigin) {
  let panel;
  let query = '';
  let matchCase = false;
  let requestId;
  let documentKey;
  const key = url => { try { const parsed = new URL(url); return parsed.origin + parsed.pathname + parsed.search; } catch { return url; } };
  const readable = () => !parent.isDestroyed() && isReader(parent.webContents.getURL(), readerOrigin());
  const send = result => {
    if (panel && !panel.isDestroyed()) panel.webContents.send('halite:find-result', result);
  };
  const position = () => {
    if (!panel || panel.isDestroyed() || parent.isDestroyed()) return;
    const bounds = parent.getContentBounds();
    panel.setPosition(bounds.x + Math.max(0, bounds.width - 448), bounds.y + 12);
  };
  const close = (focus = true) => {
    requestId = undefined;
    query = '';
    if (!parent.isDestroyed()) parent.webContents.stopFindInPage('clearSelection');
    panel?.close();
    if (focus && !parent.isDestroyed()) parent.focus();
  };
  const search = (text, options = {}) => {
    if (!readable()) { close(false); return; }
    if (typeof text !== 'string' || text.length > 500) throw new Error('Find text must be at most 500 characters.');
    const next = options.findNext === true && text === query && (options.matchCase === true) === matchCase;
    query = text;
    matchCase = options.matchCase === true;
    if (!text) {
      requestId = undefined;
      parent.webContents.stopFindInPage('clearSelection');
      send({ matches: 0, activeMatchOrdinal: 0, empty: true });
      return;
    }
    // Electron uses findNext=true to start a new session, despite the name.
    requestId = parent.webContents.findInPage(text, { forward: options.forward !== false, findNext: !next, matchCase });
  };
  const open = async () => {
    if (!readable()) return;
    documentKey = key(parent.webContents.getURL());
    if (panel && !panel.isDestroyed()) {
      panel.show(); panel.focus(); panel.webContents.send('halite:find-focus'); return;
    }
    matchCase = false;
    panel = new BrowserWindow({
      parent, width: 432, height: 116, title: 'Find in document — Halite',
      frame: false, resizable: false, minimizable: false, maximizable: false,
      fullscreenable: false, skipTaskbar: true, show: false, backgroundColor: '#f8fafc',
      webPreferences: { preload: path.join(__dirname, 'find-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const opened = panel;
    opened.setMenu(null);
    opened.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    opened.webContents.on('will-navigate', (event, url) => { if (url !== findURL) event.preventDefault(); });
    opened.on('closed', () => {
      if (panel === opened) {
        panel = undefined;
        query = ''; requestId = undefined;
        if (!parent.isDestroyed()) parent.webContents.stopFindInPage('clearSelection');
      }
    });
    position();
    await opened.loadURL(findURL);
    if (!opened.isDestroyed() && readable()) { opened.show(); opened.focus(); }
  };
  const next = forward => query ? search(query, { findNext: true, forward, matchCase }) : open();
  const trusted = event => panel && !panel.isDestroyed()
    && event.sender === panel.webContents && event.senderFrame === panel.webContents.mainFrame
    && event.senderFrame.url === findURL;
  ipcMain.handle('halite:find-query', (event, text, options) => {
    if (!trusted(event)) throw new Error('Find is only available from its built-in panel.');
    search(text, options && typeof options === 'object' ? options : {});
  });
  ipcMain.handle('halite:find-close', event => {
    if (!trusted(event)) throw new Error('Find is only available from its built-in panel.');
    close();
  });
  parent.webContents.on('found-in-page', (_event, result) => {
    if (result.requestId === requestId && result.finalUpdate) {
      send({ matches: result.matches, activeMatchOrdinal: result.activeMatchOrdinal, empty: false });
    }
  });
  parent.webContents.on('did-start-navigation', details => {
    if (details.isMainFrame && !details.isSameDocument) close(false);
  });
  parent.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    // Reading-position saves use history.replaceState on the same document.
    // Keep find open through those updates, but clear it for another file.
    if (isMainFrame && key(url) !== documentKey) { documentKey = key(url); close(false); }
  });
  parent.on('move', position);
  parent.on('resize', position);
  parent.on('closed', () => {
    ipcMain.removeHandler('halite:find-query');
    ipcMain.removeHandler('halite:find-close');
  });
  return { open, close, next };
}

module.exports = { createFindController };
