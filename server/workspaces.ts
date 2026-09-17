import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { createProjectSession, type ProjectSession } from './session.js';
import { discoverProject, FileError } from './project.js';

export const protocolVersion = 1;
export type OpenMode = 'tab' | 'window';
type Workspace = { id: string; kind: 'browser' | 'desktop'; tabs: string[]; active: string | null; initialPaths: Record<string, string>; clients: Set<ServerResponse>; touched: number; expires?: ReturnType<typeof setTimeout> };
export type Command = { action: string; input?: string; root?: string; workspace?: string; project?: string; target?: string; mode?: OpenMode; kind?: 'browser' | 'desktop'; demo?: boolean; port?: number };
export function stateDirectory() { return path.resolve(process.env.HALITE_STATE_DIR || process.env.MDVIEW_STATE_DIR || path.join(process.env.XDG_STATE_HOME || path.join(homedir(), '.local/state'), 'halite')); }

export async function readBody(request: IncomingMessage) {
  let bytes = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 256 * 1024) throw new FileError('Request is too large.', 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new FileError('Invalid JSON.'); }
}
function json(response: ServerResponse, value: unknown) { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }

export class WorkspaceRegistry {
  origin = '';
  sessions = new Map<string, ProjectSession>();
  workspaces = new Map<string, Workspace>();
  recents: { path: string; name: string }[] = [];
  mode: OpenMode = 'tab';
  private pending = new Map<string, Promise<ProjectSession>>();
  private releasing = new Map<string, ReturnType<typeof setTimeout>>();
  private saveQueue = Promise.resolve();
  private closing = false;
  private heartbeat = setInterval(() => { for (const w of this.workspaces.values()) for (const c of w.clients) c.write(': heartbeat\n\n'); }, 15000);
  constructor(private directory = stateDirectory(), private grace = 30000) {}
  async load() {
    try {
      const saved = JSON.parse(await readFile(path.join(this.directory, 'workspace-settings.json'), 'utf8'));
      this.mode = saved.mode === 'window' ? 'window' : 'tab';
      if (Array.isArray(saved.recents)) this.recents = saved.recents.filter((r: { path?: unknown }) => r && typeof r.path === 'string' && path.isAbsolute(r.path) && !r.path.includes('\0')).slice(0, 50).map((r: { path: string }) => ({ path: r.path, name: path.basename(r.path) || r.path }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try {
          const oldDirectory = process.env.HALITE_DESKTOP_STATE_DIR || path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'halite-desktop');
          const old = JSON.parse(await readFile(path.join(oldDirectory, 'recent-projects.json'), 'utf8'));
          if (Array.isArray(old)) this.recents = old.filter(r => r && typeof r.path === 'string' && path.isAbsolute(r.path) && !r.path.includes('\0')).slice(0, 50).map(r => ({ path: r.path, name: path.basename(r.path) || r.path }));
        } catch { /* No previous desktop installation. */ }
      }
    }
  }
  private save() {
    const content = JSON.stringify({ mode: this.mode, recents: this.recents }, null, 2);
    this.saveQueue = this.saveQueue.catch(() => {}).then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const file = path.join(this.directory, 'workspace-settings.json');
      await writeFile(`${file}.${process.pid}.tmp`, content, { mode: 0o600 });
      await rename(`${file}.${process.pid}.tmp`, file);
    });
    return this.saveQueue;
  }
  async register(input: string, root?: string) {
    const project = await discoverProject(input, root);
    const existing = [...this.sessions.values()].find(s => s.project.root === project.root);
    if (existing) { clearTimeout(this.releasing.get(existing.id)); this.releasing.delete(existing.id); return existing; }
    const pending = this.pending.get(project.root);
    if (pending) return pending;
    const opening = createProjectSession(project, this.directory, paths => {
      const session = [...this.sessions.values()].find(s => s.project.root === project.root);
      if (session) for (const w of this.workspaces.values()) if (w.tabs.includes(session.id)) this.send(w, { type: 'files', project: session.id, paths });
    }).then(session => { this.sessions.set(session.id, session); return session; });
    this.pending.set(project.root, opening);
    try { return await opening; } finally { this.pending.delete(project.root); }
  }
  createWorkspace(kind: 'browser' | 'desktop' = 'browser') {
    const w: Workspace = { id: randomUUID(), kind, tabs: [], active: null, initialPaths: {}, clients: new Set(), touched: Date.now() };
    this.workspaces.set(w.id, w); return w;
  }
  private workspace(id?: string) {
    const w = id ? this.workspaces.get(id) : undefined;
    if (!w) throw new FileError('This workspace is closed. Open Halite again.', 404);
    return w;
  }
  private send(w: Workspace, event: unknown) { for (const c of w.clients) c.write(`data: ${JSON.stringify(event)}\n\n`); }
  private broadcast() { for (const w of this.workspaces.values()) this.send(w, { type: 'workspace', state: this.snapshot(w) }); }
  snapshot(w: Workspace) {
    return { id: w.id, kind: w.kind, active: w.active, mode: this.mode, recents: this.recents,
      tabs: w.tabs.map(id => { const s = this.sessions.get(id)!; return { id, name: path.basename(s.project.root) || s.project.root, root: s.project.root, url: `${this.origin}/projects/${id}/${w.initialPaths[id] ? `?path=${encodeURIComponent(w.initialPaths[id])}` : ''}` }; }),
      windows: [...this.workspaces.values()].map(other => ({ id: other.id, name: other.tabs.map(id => path.basename(this.sessions.get(id)!.project.root)).join(', ') || 'Welcome' })),
    };
  }
  status() { return { protocol: protocolVersion, pid: process.pid, url: this.origin, mode: this.mode, projects: [...this.sessions.values()].map(s => ({ id: s.id, root: s.project.root })), workspaces: [...this.workspaces.values()].map(w => ({ id: w.id, kind: w.kind, connected: w.clients.size > 0, url: `${this.origin}/workspaces/${w.id}/`, active: w.active, tabs: w.tabs })) }; }
  private releaseUnused() {
    for (const s of this.sessions.values()) {
      if ([...this.workspaces.values()].some(w => w.tabs.includes(s.id)) || this.releasing.has(s.id)) continue;
      this.releasing.set(s.id, setTimeout(() => {
        this.releasing.delete(s.id); this.sessions.delete(s.id);
        void s.close().catch(console.error);
      }, this.grace));
    }
  }
  async command(command: Command) {
    if (this.closing) throw new FileError('Halite is stopping.', 503);
    const { action } = command;
    if (action === 'status') return this.status();
    if (action === 'new-window') {
      const w = this.createWorkspace(command.kind || (command.workspace ? this.workspace(command.workspace).kind : 'browser'));
      this.broadcast(); return { workspace: w.id, url: `${this.origin}/workspaces/${w.id}/`, shouldOpen: true, kind: w.kind };
    }
    if (action === 'open' || action === 'recent') {
      if (typeof command.input !== 'string') throw new FileError('Choose a project path.');
      if (action === 'recent' && !this.recents.some(r => r.path === command.input)) throw new FileError('Choose a known recent project.', 403);
      const s = await this.register(command.input, command.root);
      const discovered = await discoverProject(command.input, command.root);
      let w = [...this.workspaces.values()].find(w => w.tabs.includes(s.id));
      if (!w) {
        const current = command.workspace ? this.workspace(command.workspace) : [...this.workspaces.values()].sort((a, b) => b.touched - a.touched)[0];
        const mode = command.mode || this.mode;
        w = current && (mode === 'tab' || current.tabs.length === 0) ? current : this.createWorkspace(command.kind || current?.kind || 'browser');
        w.tabs.push(s.id);
        if (discovered.requestedFile) w.initialPaths[s.id] = discovered.requestedFile;
      }
      if (!w.clients.size && discovered.requestedFile) w.initialPaths[s.id] = discovered.requestedFile;
      w.active = s.id; w.touched = Date.now();
      if (!command.demo) { this.recents = [{ path: s.project.root, name: path.basename(s.project.root) || s.project.root }, ...this.recents.filter(r => r.path !== s.project.root)].slice(0, 50); await this.save(); }
      this.broadcast();
      this.send(w, { type: 'activate', project: s.id, path: discovered.requestedFile });
      return { project: s.id, workspace: w.id, root: s.project.root, url: `${this.origin}/workspaces/${w.id}/`, shouldOpen: w.clients.size === 0, kind: w.kind };
    }
    if (action === 'settings') {
      if (command.mode !== 'tab' && command.mode !== 'window') throw new FileError('Choose tabs or windows.');
      this.mode = command.mode; await this.save(); this.broadcast(); return { saved: true };
    }
    if (action === 'clear-recents') { this.recents = []; await this.save(); this.broadcast(); return { saved: true }; }
    const w = this.workspace(command.workspace);
    if (action === 'close-window') {
      clearTimeout(w.expires); this.workspaces.delete(w.id);
      for (const c of w.clients) c.end(); this.releaseUnused(); this.broadcast(); return { closed: true };
    }
    if (action === 'welcome') { w.active = null; }
    else if (action === 'focus') { w.touched = Date.now(); }
    else {
      if (!command.project || !w.tabs.includes(command.project)) throw new FileError('This project is not in this window.', 404);
      const id = command.project;
      if (action === 'select') { w.active = id; w.touched = Date.now(); }
      else if (action === 'close-tab' || action === 'move') {
        const index = w.tabs.indexOf(id);
        let target: Workspace | undefined;
        if (action === 'move') {
          target = command.target ? this.workspace(command.target) : this.createWorkspace(w.kind);
          if (target.id === w.id) return { workspace: w.id, url: `${this.origin}/workspaces/${w.id}/` };
          target.tabs.push(id); target.active = id; target.touched = Date.now();
        }
        w.tabs.splice(index, 1); delete w.initialPaths[id];
        if (w.active === id) w.active = w.tabs[Math.min(index, w.tabs.length - 1)] || null;
        this.releaseUnused(); this.broadcast();
        return target ? { workspace: target.id, url: `${this.origin}/workspaces/${target.id}/`, shouldOpen: target.clients.size === 0, kind: target.kind } : { closed: true };
      } else throw new FileError('Unknown workspace action.');
    }
    this.broadcast(); return { saved: true };
  }
  async handleHTTP(request: IncomingMessage, response: ServerResponse, url: URL) {
    const route = url.pathname.match(/^\/api\/workspaces\/([a-f0-9-]+)(\/events)?$/);
    if (!route) return false;
    const w = this.workspace(route[1]);
    if (request.method === 'GET' && route[2]) {
      clearTimeout(w.expires);
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(`data: ${JSON.stringify({ type: 'workspace', state: this.snapshot(w) })}\n\n`);
      w.clients.add(response); w.touched = Date.now();
      request.on('close', () => {
        w.clients.delete(response);
        if (!w.clients.size && !this.closing) w.expires = setTimeout(() => { if (this.workspaces.has(w.id)) void this.command({ action: 'close-window', workspace: w.id }).catch(console.error); }, this.grace);
      });
    } else if (request.method === 'GET') json(response, this.snapshot(w));
    else if (request.method === 'POST' && !route[2]) {
      if (!request.headers['content-type']?.startsWith('application/json')) throw new FileError('Expected JSON.', 415);
      const body = await readBody(request);
      if (!body || !['select', 'close-tab', 'move', 'welcome', 'focus', 'new-window', 'settings', 'recent', 'clear-recents'].includes(body.action)) throw new FileError('This action is only available through the local CLI or desktop picker.', 403);
      // Do not accept filesystem-root overrides or a forged workspace/kind.
      json(response, await this.command({ action: body.action, workspace: w.id, project: body.project, target: body.target, mode: body.mode, input: body.input, kind: w.kind }));
    } else throw new FileError('Method not allowed.', 405);
    return true;
  }
  async close() {
    this.closing = true; clearInterval(this.heartbeat);
    for (const w of this.workspaces.values()) { clearTimeout(w.expires); for (const c of w.clients) c.end(); }
    for (const timer of this.releasing.values()) clearTimeout(timer);
    await Promise.allSettled(this.pending.values());
    await Promise.all([...this.sessions.values()].map(s => s.close()));
    await this.saveQueue;
  }
}
