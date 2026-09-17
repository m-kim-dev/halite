const path = require('node:path');

const welcomeURL = 'halite://app/index.html';

function isWelcome(url) {
  return url === welcomeURL;
}

function isReader(url, origin) {
  try {
    const parsed = new URL(url);
    return Boolean(origin) && parsed.origin === origin && (parsed.pathname === '/' || /^\/projects\/[a-f0-9-]+\/$/.test(parsed.pathname));
  } catch { return false; }
}

function isWorkspace(url, expected) { return Boolean(expected) && url === expected && /^http:\/\/127\.0\.0\.1:\d+\/workspaces\/[a-f0-9-]+\/$/.test(url); }

function externalURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function readerPermission(permission, url, origin) {
  return permission === 'clipboard-sanitized-write' && isReader(url, origin);
}

function cleanRecents(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    if (!item || typeof item.path !== 'string' || !path.isAbsolute(item.path) || item.path.includes('\0') || seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  }).slice(0, 8).map(item => ({ path: item.path, name: path.basename(item.path) || item.path }));
}

module.exports = { isWorkspace, welcomeURL, isWelcome, isReader, externalURL, cleanRecents, readerPermission };
