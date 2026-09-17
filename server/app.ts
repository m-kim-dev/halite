import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkspaceRegistry } from './workspaces.js';
import { FileError, imageTypes, isInside, readDocument, resolveFile } from './project.js';

export interface ServerOptions { input?: string; root?: string; port?: number; dev?: boolean; stateDirectory?: string }
const ownDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = ownDirectory.includes(`${path.sep}dist${path.sep}`) ? path.resolve(ownDirectory, '../../..') : path.resolve(ownDirectory, '..');
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', ...imageTypes };

function json(response: ServerResponse, data: unknown, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function body(request: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw new FileError('Preference payload is too large.', 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new FileError('Invalid JSON.'); }
}

export async function startServer(options: ServerOptions) {
  const registry = new WorkspaceRegistry(options.stateDirectory);
  await registry.load();
  const legacy = await (options.input ? registry.register(options.input, options.root) : Promise.resolve(undefined)).catch(async error => { await registry.close(); throw error; });
  const vite = options.dev ? await (await import('vite')).createServer({ root: appRoot, server: { middlewareMode: true }, appType: 'custom' }) : undefined;
  let port = options.port ?? 4173;
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const validHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origin = request.headers.origin;
    if (!validHosts.has(request.headers.host || '') || (origin && ![...validHosts].some(host => origin === `http://${host}`))) {
      json(response, { error: 'Requests must come from this local viewer.' }, 403); return;
    }
    try {
      const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
      const relative = url.searchParams.get('path') || '';
      if (await registry.handleHTTP(request, response, url)) return;
      const route = url.pathname.match(/^\/api\/projects\/([a-f0-9-]+)(\/.*)$/);
      const session = route ? registry.sessions.get(route[1]) : legacy;
      const endpoint = route ? `/api${route[2]}` : url.pathname;

      if (url.pathname.startsWith('/api/')) {
        if (!session) throw new FileError('This project is closed. Reopen it from Halite.', 404);
        const { project, preferenceStore, files, clients } = session;
        if (request.method !== 'GET' && !(request.method === 'POST' && endpoint === '/api/preferences')) throw new FileError('The project is read-only.', 405);
        if (endpoint === '/api/bootstrap') {
          const preferences = preferenceStore.current;
          let initialPath = (route ? preferences.lastPath || project.requestedFile : project.requestedFile || preferences.lastPath) || project.focus;
          try { initialPath = (await readDocument(project.root, initialPath)).path; } catch { initialPath = project.focus; }
          json(response, { root: project.root, name: path.basename(project.root), focus: project.focus, initialPath, files, preferences });
        } else if (endpoint === '/api/document') {
          json(response, await readDocument(project.root, relative));
        } else if (endpoint === '/api/files') {
          json(response, files);
        } else if (endpoint === '/api/preferences' && request.method === 'POST') {
          if (!request.headers['content-type']?.startsWith('application/json')) throw new FileError('Expected JSON.', 415);
          await preferenceStore.save(await body(request));
          json(response, { saved: true });
        } else if (endpoint === '/api/events') {
          response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          response.write(': connected\n\n'); clients.add(response);
          request.on('close', () => clients.delete(response));
        } else if (endpoint === '/api/asset') {
          const absolute = await resolveFile(project.root, relative);
          const type = imageTypes[path.extname(absolute).toLowerCase()];
          if (!type || !(await stat(absolute)).isFile()) throw new FileError('Only image assets can be loaded here.', 415);
          if ((await stat(absolute)).size > 30 * 1024 * 1024) throw new FileError('This image exceeds the 30 MB limit.', 413);
          response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
          response.end(await readFile(absolute));
        } else throw new FileError('Unknown endpoint.', 404);
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new FileError('Method not allowed.', 405);
      if (vite) {
        vite.middlewares(request, response, async () => {
          try { response.setHeader('Content-Type', 'text/html'); response.end(await vite.transformIndexHtml(url.pathname, await readFile(path.join(appRoot, 'index.html'), 'utf8'))); }
          catch (error) { json(response, { error: String(error) }, 500); }
        });
      } else {
        response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: http: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'self'; frame-ancestors 'self'");
        const staticRoot = path.join(appRoot, 'dist/client');
        const relativeUrl = decodeURIComponent(url.pathname);
        const asset = relativeUrl.startsWith('/assets/') ? path.resolve(staticRoot, `.${relativeUrl}`) : path.join(staticRoot, 'index.html');
        if (!isInside(staticRoot, asset)) throw new FileError('Invalid resource path.', 403);
        const bytes = await readFile(asset);
        response.writeHead(200, { 'Content-Type': mime[path.extname(asset)] || 'application/octet-stream', 'Cache-Control': relativeUrl.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
        response.end(request.method === 'HEAD' ? undefined : bytes);
      }
    } catch (error) {
      const status = error instanceof FileError ? error.status : 500;
      json(response, { error: error instanceof FileError ? error.message : 'The viewer could not complete this request.' }, status);
      if (status === 500) console.error(error);
    }
  });
  try { await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { const address = server.address(); if (address && typeof address === 'object') port = address.port; server.removeListener('error', reject); resolve(); });
  });
  } catch (error) { await registry.close(); await vite?.close(); throw error; }
  registry.origin = `http://127.0.0.1:${port}`;
  return {
    url: registry.origin, root: legacy?.project.root, registry,
    async close() {
      await registry.close();
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
