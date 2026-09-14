import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { cleanRecents, externalURL, isWelcome, isReader, readerPermission } = require('../desktop/policy.cjs');

describe('desktop trust boundaries', () => {
  it('lets the active reader copy code without granting clipboard reads or device access', () => {
    const origin = 'http://127.0.0.1:4100';
    expect(readerPermission('clipboard-sanitized-write', `${origin}/?path=README.md`, origin)).toBe(true);
    for (const permission of ['clipboard-read', 'media', 'geolocation', 'fileSystem']) expect(readerPermission(permission, `${origin}/`, origin)).toBe(false);
    expect(readerPermission('clipboard-sanitized-write', 'halite://app/index.html', origin)).toBe(false);
    expect(readerPermission('clipboard-sanitized-write', 'https://example.com/', origin)).toBe(false);
  });
  it('limits the welcome bridge to its exact built-in page', () => {
    expect(isWelcome('halite://app/index.html')).toBe(true);
    for (const url of ['halite://evil/index.html', 'halite://app/index.html?next=evil', 'https://app/index.html', 'file:///index.html']) expect(isWelcome(url)).toBe(false);
  });
  it('only allows the active local reader as a document navigation', () => {
    expect(isReader('http://127.0.0.1:4100/?path=README.md#hello', 'http://127.0.0.1:4100')).toBe(true);
    for (const url of ['http://127.0.0.1:4101/', 'http://127.0.0.1:4100/api/document', 'https://example.com/', 'file:///etc/passwd']) expect(isReader(url, 'http://127.0.0.1:4100')).toBe(false);
    expect(isReader('http://127.0.0.1:4100/', undefined)).toBe(false);
  });
  it('does not send local files or executable protocols to the operating system', () => {
    expect(externalURL('https://example.com/docs')).toBe('https://example.com/docs');
    expect(externalURL('mailto:reader@example.com')).toBe('mailto:reader@example.com');
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hello', 'vscode://file/etc/passwd', 'https://user:secret@example.com', 'bad url']) expect(externalURL(url)).toBeUndefined();
  });
});

describe('recent projects', () => {
  it('ignores malformed state, derives labels, and removes duplicate paths', () => {
    expect(cleanRecents(null)).toEqual([]);
    expect(cleanRecents([null, {}, { path: 3 }, { path: '../private' }, { path: '/tmp/ok', name: 'spoofed' }, { path: '/tmp/ok' }, { path: '/tmp/nul\0' }])).toEqual([{ path: '/tmp/ok', name: 'ok' }]);
  });
  it('keeps only the eight most recent unique projects', () => {
    const recents = cleanRecents(Array.from({ length: 12 }, (_, index) => ({ path: `/tmp/project-${index}` })));
    expect(recents).toHaveLength(8);
    expect(recents[0].name).toBe('project-0');
    expect(recents[7].name).toBe('project-7');
  });
});
