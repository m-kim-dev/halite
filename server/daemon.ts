import { createServer } from 'node:http';
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { startServer } from './app.js';
import { runtimePaths, serviceCommand, unavailable } from './client.js';
import { protocolVersion, readBody } from './workspaces.js';

const paths = await runtimePaths();
let locked = false;
for (let attempt = 0; attempt < 2; attempt++) {
  try { await mkdir(paths.lock, { mode: 0o700 }); locked = true; break; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    try { await serviceCommand({ action: 'status' }); process.exit(0); } catch (error) { if (!unavailable(error)) throw error; }
    let stale = false;
    try {
      const pid = Number(await readFile(path.join(paths.lock, 'pid'), 'utf8'));
      if (!Number.isInteger(pid) || pid < 1) throw new Error('Invalid owner');
      try { process.kill(pid, 0); } catch (error) { stale = (error as NodeJS.ErrnoException).code === 'ESRCH'; }
    } catch { stale = Date.now() - (await stat(paths.lock)).mtimeMs > 10000; }
    if (!stale) process.exit(0);
    await rm(paths.lock, { recursive: true, force: true });
  }
}
if (!locked) process.exit(0);
await writeFile(path.join(paths.lock, 'pid'), String(process.pid), { mode: 0o600 });
let service: Awaited<ReturnType<typeof startServer>> | undefined;
let stopping = false;
const control = createServer(async (request, response) => {
  try {
    if (request.method !== 'POST' || request.url !== '/command') throw new Error('Unknown control request.');
    const command = await readBody(request);
    if (command?.protocol !== protocolVersion && command?.action !== 'stop') throw new Error('Halite service version differs. Stop the old service before upgrading.');
    const result = command.action === 'stop' ? { stopped: true } : await service!.registry.command(command);
    response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(result));
    if (command.action === 'stop') setImmediate(() => void stop());
  } catch (error) { response.writeHead(400, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Control request failed.' })); }
});
async function stop() {
  if (stopping) return; stopping = true;
  try { await service?.close(); control.closeAllConnections(); await new Promise<void>(resolve => control.close(() => resolve())); }
  finally { await rm(paths.socket, { force: true }); await rm(paths.lock, { recursive: true, force: true }); }
}
try {
  const { values } = parseArgs({ options: { port: { type: 'string' } } });
  const port = values.port === undefined ? 0 : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
  service = await startServer({ port });
  await rm(paths.socket, { force: true });
  await new Promise<void>((resolve, reject) => { control.once('error', reject); control.listen(paths.socket, () => { control.removeListener('error', reject); resolve(); }); });
  await chmod(paths.socket, 0o600);
  process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
} catch (error) { console.error(error); await stop(); process.exitCode = 1; }
