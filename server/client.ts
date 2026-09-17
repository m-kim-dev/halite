import { request } from 'node:http';
import { spawn, type StdioOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, lstat, open, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { protocolVersion, stateDirectory, type Command } from './workspaces.js';

export async function runtimePaths() {
  if (process.platform === 'win32') throw new Error('The shared CLI service currently supports Linux and macOS.');
  const directory = path.join(tmpdir(), `halite-${process.getuid?.() ?? 'user'}-${createHash('sha256').update(stateDirectory()).digest('hex').slice(0, 16)}`);
  await mkdir(directory, { mode: 0o700, recursive: true });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o077)) throw new Error('Halite runtime directory must be private and owned by the current user.');
  return { directory, socket: path.join(directory, 'control.sock'), lock: path.join(directory, 'service.lock') };
}

export async function serviceCommand(command: Command): Promise<any> {
  const { socket } = await runtimePaths();
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ protocol: protocolVersion, ...command });
    const req = request({ socketPath: socket, path: '/command', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try { const result = JSON.parse(Buffer.concat(chunks).toString()); if (response.statusCode !== 200) reject(new Error(result.error)); else resolve(result); } catch (error) { reject(error); }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('Halite service did not respond.')));
    req.on('error', reject); req.end(body);
  });
}

export function unavailable(error: unknown) { return ['ENOENT', 'ECONNREFUSED', 'ECONNRESET'].includes((error as NodeJS.ErrnoException).code || ''); }
export async function ensureService(port?: number) {
  try {
    const status = await serviceCommand({ action: 'status' });
    if (port && new URL(status.url).port !== String(port)) throw new Error(`Halite is already using ${status.url}. Run halite stop before choosing a different port.`);
    return status;
  } catch (error) { if (!unavailable(error)) throw error; }
  await mkdir(stateDirectory(), { recursive: true, mode: 0o700 });
  const log = await open(path.join(stateDirectory(), 'service.log'), 'a', 0o600);
  // Electron can leave Chromium descriptors without close-on-exec. Explicitly
  // replace inherited descriptors so the detached service cannot retain its
  // parent's browser/debugging sockets or keep a launcher waiting for EOF.
  const nullFile = await open('/dev/null', 'r+');
  const descriptors = await readdir(process.platform === 'linux' ? '/proc/self/fd' : '/dev/fd');
  const stdio: StdioOptions = Array.from({ length: Math.max(4, ...descriptors.map(Number).filter(Number.isFinite)) + 1 }, () => nullFile.fd);
  stdio[0] = 'ignore'; stdio[1] = log.fd; stdio[2] = log.fd;
  const child = spawn(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'daemon.js'), ...(port === undefined ? [] : ['--port', String(port)])], {
    detached: true, stdio, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  let failure: Error | undefined;
  child.on('error', error => { failure = error; }); child.unref(); await log.close(); await nullFile.close();
  for (let attempt = 0; attempt < 200; attempt++) {
    if (failure) throw failure;
    try { return await serviceCommand({ action: 'status' }); } catch (error) { if (!unavailable(error)) throw error; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Could not start Halite. See ${path.join(stateDirectory(), 'service.log')}.`);
}
