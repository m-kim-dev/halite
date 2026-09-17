import type { ServerResponse } from 'node:http';
import path from 'node:path';
import chokidar from 'chokidar';
import { randomUUID } from 'node:crypto';
import { discoverProject, scanDocuments, skippedNames, markdownPattern } from './project.js';
import { PreferenceStore } from './preferences.js';

export async function createProjectSession(project: Awaited<ReturnType<typeof discoverProject>>, stateDirectory: string | undefined, notify: (paths: string[]) => void) {
  const id = randomUUID();
  const preferenceStore = new PreferenceStore(project.root, stateDirectory);
  await preferenceStore.load();
  let files = await scanDocuments(project.root);
  const clients = new Set<ServerResponse>();
  let rebuild = Promise.resolve();
  let timer: ReturnType<typeof setTimeout>;
  const changed = new Set<string>();
  const watcher = chokidar.watch(project.root, {
    ignoreInitial: true, followSymlinks: false,
    ignored: (entry: string) => path.relative(project.root, entry).split(path.sep).some(part => skippedNames.has(part) || (part.startsWith('.') && part !== '.gitignore')),
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });
  watcher.on('all', (event, absolute) => {
    const relative = path.relative(project.root, absolute).split(path.sep).join('/');
    changed.add(relative);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const paths = [...changed]; changed.clear();
      rebuild = rebuild.catch(() => {}).then(async () => {
        if (event !== 'change' || paths.some(p => markdownPattern.test(p) || p.endsWith('.gitignore'))) files = await scanDocuments(project.root);
        notify(paths);
        const message = `data: ${JSON.stringify({ paths })}\n\n`;
        for (const client of clients) client.write(message);
      }).catch(error => console.error('File refresh failed:', error));
    }, 200);
  });
  watcher.on('error', error => console.error('File watcher:', error));
  const heartbeat = setInterval(() => { for (const client of clients) client.write(': heartbeat\n\n'); }, 20000);
  return {
    id, project, preferenceStore, clients,
    get files() { return files; },
    async close() {
      clearInterval(heartbeat); clearTimeout(timer);
      await watcher.close(); await rebuild;
      for (const client of clients) client.end();
    },
  };
}
export type ProjectSession = Awaited<ReturnType<typeof createProjectSession>>;
