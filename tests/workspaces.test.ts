import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server/app';
import { WorkspaceRegistry } from '../server/workspaces';

let temporary: string;
let alpha: string;
let beta: string;
let service: Awaited<ReturnType<typeof startServer>>;
beforeEach(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), 'halite-workspaces-'));
  alpha = path.join(temporary, 'alpha'); beta = path.join(temporary, 'beta');
  for (const [root, title] of [[alpha, 'Alpha'], [beta, 'Beta']]) {
    await mkdir(path.join(root, '.git'), { recursive: true });
    await writeFile(path.join(root, 'README.md'), `# ${title}\n`);
    await writeFile(path.join(root, 'guide.md'), `# ${title} guide\n`);
  }
  service = await startServer({ port: 0, stateDirectory: path.join(temporary, 'state') });
});
afterEach(async () => { await service.close(); await rm(temporary, { recursive: true, force: true }); });

describe('shared projects and workspaces', () => {
  it('background navigation only uses connected projects without registering or launching anything', async () => {
    const a: any = await service.registry.command({ action: 'open', input: alpha });
    await expect(service.registry.command({ action: 'navigate', input: path.join(alpha, 'guide.md') })).rejects.toThrow('Open this project');
    const controller = new AbortController();
    const events = await fetch(`${service.url}/api/workspaces/${a.workspace}/events`, { signal: controller.signal });
    try {
      expect(events.status).toBe(200);
      const before = service.registry.status();
      const recents = [...service.registry.recents];
      const result: any = await service.registry.command({ action: 'navigate', input: path.join(alpha, 'guide.md') });
      expect(result).toMatchObject({ workspace: a.workspace, project: a.project, shouldOpen: false });
      expect(service.registry.status()).toEqual(before);
      expect(service.registry.recents).toEqual(recents);
      await expect(service.registry.command({ action: 'navigate', input: path.join(beta, 'guide.md') })).rejects.toThrow('Open this project');
      await expect(service.registry.command({ action: 'navigate', input: alpha })).rejects.toThrow('Choose a Markdown file');
      expect(service.registry.sessions.size).toBe(1);
      const response = await fetch(`${service.url}/api/workspaces/${a.workspace}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'navigate', input: path.join(beta, 'guide.md') }) });
      expect(response.status).toBe(403);
    } finally { controller.abort(); }
  });
  it('deduplicates simultaneous opens, symlink aliases, and documents within a root', async () => {
    await symlink(alpha, path.join(temporary, 'alias'));
    const results: any[] = await Promise.all([alpha, path.join(alpha, 'guide.md'), path.join(temporary, 'alias')].map(input => service.registry.command({ action: 'open', input })));
    expect(new Set(results.map(r => r.project)).size).toBe(1);
    expect(new Set(results.map(r => r.workspace)).size).toBe(1);
    expect(service.registry.sessions.size).toBe(1);
    const status = service.registry.status();
    expect(status.workspaces[0].tabs).toHaveLength(1);
  });
  it('serves different roots on one port with isolated assets, preferences, and traversal checks', async () => {
    const a: any = await service.registry.command({ action: 'open', input: alpha });
    const b: any = await service.registry.command({ action: 'open', input: beta });
    expect(a.workspace).toBe(b.workspace);
    const api = (id: string, route: string) => `${service.url}/api/projects/${id}/${route}`;
    expect((await (await fetch(api(a.project, 'document?path=README.md'))).json()).content).toBe('# Alpha\n');
    expect((await (await fetch(api(b.project, 'document?path=README.md'))).json()).content).toBe('# Beta\n');
    await symlink(path.join(beta, 'README.md'), path.join(alpha, 'escape.md'));
    expect((await fetch(api(a.project, 'document?path=escape.md'))).status).toBe(403);
    expect((await fetch(api(a.project, 'document?path=..%2Fbeta%2FREADME.md'))).status).toBe(403);
    await fetch(api(a.project, 'preferences'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: 'dark' }) });
    expect((await (await fetch(api(b.project, 'bootstrap'))).json()).preferences.theme).toBeUndefined();
    expect((await fetch(api(a.project, 'document?path=README.md'), { method: 'PUT' })).status).toBe(405);
  });
  it('moves tabs between windows without creating another project session and preserves other tabs', async () => {
    const a: any = await service.registry.command({ action: 'open', input: alpha });
    const b: any = await service.registry.command({ action: 'open', input: beta });
    const moved: any = await service.registry.command({ action: 'move', workspace: a.workspace, project: a.project });
    expect(moved.workspace).not.toBe(a.workspace);
    expect(service.registry.status().workspaces.find(w => w.id === a.workspace)?.tabs).toEqual([b.project]);
    expect(service.registry.sessions.size).toBe(2);
    await service.registry.command({ action: 'move', workspace: moved.workspace, project: a.project, target: a.workspace });
    expect(service.registry.status().workspaces.find(w => w.id === a.workspace)?.tabs).toEqual([b.project, a.project]);
    await service.registry.command({ action: 'close-window', workspace: moved.workspace });
    expect((await fetch(`${service.url}/api/projects/${a.project}/bootstrap`)).status).toBe(200);
  });
  it('persists window preference and recents; explicit tab opens override the preference', async () => {
    await service.registry.command({ action: 'settings', mode: 'window' });
    const a: any = await service.registry.command({ action: 'open', input: alpha });
    const b: any = await service.registry.command({ action: 'open', input: beta, mode: 'tab' });
    expect(b.workspace).toBe(a.workspace);
    const saved = new WorkspaceRegistry(path.join(temporary, 'state'));
    try { await saved.load(); expect(saved.mode).toBe('window'); expect(saved.recents.map(r => r.path)).toEqual([beta, alpha]); expect(saved.sessions.size).toBe(0); }
    finally { await saved.close(); }
  });
  it('does not let the browser register paths or override a recent project root', async () => {
    const a: any = await service.registry.command({ action: 'open', input: alpha });
    const url = `${service.url}/api/workspaces/${a.workspace}`;
    const send = (value: unknown, origin?: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(value) });
    expect((await send({ action: 'open', input: beta })).status).toBe(403);
    expect((await send({ action: 'recent', input: beta })).status).toBe(403);
    expect((await send({ action: 'recent', input: alpha, root: temporary })).status).toBe(200);
    expect(service.registry.sessions.size).toBe(1);
    expect((await send({ action: 'close-tab', project: a.project }, 'https://unrelated.example')).status).toBe(403);
    expect((await fetch(url, { method: 'POST', body: '{}' })).status).toBe(415);
  });
  it('releases a closed project after the grace period but keeps another window working', async () => {
    const registry = new WorkspaceRegistry(path.join(temporary, 'cleanup'), 30);
    try {
      const a: any = await registry.command({ action: 'open', input: alpha });
      const b: any = await registry.command({ action: 'open', input: beta, mode: 'window' });
      await registry.command({ action: 'close-window', workspace: a.workspace });
      await expect.poll(() => registry.sessions.has(a.project)).toBe(false);
      expect(registry.sessions.has(b.project)).toBe(true);
      expect(registry.status().workspaces[0].tabs).toEqual([b.project]);
    } finally { await registry.close(); }
  });
  it('leaves existing tabs usable when opening a missing path fails', async () => {
    const a: any = await service.registry.command({ action: 'open', input: alpha });
    await expect(service.registry.command({ action: 'open', input: path.join(temporary, 'missing') })).rejects.toThrow('does not exist');
    expect(service.registry.status().workspaces[0].tabs).toEqual([a.project]);
  });
});
