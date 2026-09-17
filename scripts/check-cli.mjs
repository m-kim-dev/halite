import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureService, serviceCommand, runtimePaths } from '../dist/server/server/client.js';

const run = promisify(execFile);
const temporary = await mkdtemp(path.join(tmpdir(), 'halite-cli-check-'));
process.env.HALITE_STATE_DIR = path.join(temporary, 'state');
const cli = path.resolve('dist/server/server/cli.js');
const input = path.join(temporary, 'project');
await mkdir(path.join(input, '.git'), { recursive: true });
await writeFile(path.join(input, 'README.md'), '# CLI project\n');
let socketDirectory;
try {
  socketDirectory = (await runtimePaths()).directory;
  const results = await Promise.all(Array.from({ length: 4 }, () => run(process.execPath, [cli, input, '--no-open'], { env: process.env, timeout: 20000 })));
  const status = await serviceCommand({ action: 'status' });
  assert.equal(status.projects.length, 1);
  assert.equal(status.workspaces.length, 1);
  assert.equal(status.workspaces[0].tabs.length, 1);
  for (const result of results) assert.ok(result.stdout.includes(status.url));
  const second = path.join(temporary, 'second');
  await mkdir(second); await writeFile(path.join(second, 'README.md'), '# Second\n');
  await run(process.execPath, [cli, second, '--window', '--no-open'], { env: process.env });
  const next = await serviceCommand({ action: 'status' });
  assert.equal(next.pid, status.pid); assert.equal(next.url, status.url);
  assert.equal(next.projects.length, 2); assert.equal(next.workspaces.length, 2);
  await assert.rejects(() => ensureService(Number(new URL(status.url).port) + 1), /already using/);
  // A killed daemon leaves a stale lock/socket; the next command must recover.
  process.kill(status.pid, 'SIGKILL');
  await new Promise(resolve => setTimeout(resolve, 100));
  await run(process.execPath, [cli, input, '--no-open'], { env: process.env, timeout: 20000 });
  const restarted = await serviceCommand({ action: 'status' });
  assert.notEqual(restarted.pid, status.pid);
  assert.equal(restarted.projects.length, 1);
  console.log('CLI passed: concurrent startup, one daemon/port, duplicate roots, window override, port mismatch, stale lock recovery, and stop.');
} finally {
  await serviceCommand({ action: 'stop' }).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 300));
  await rm(temporary, { recursive: true, force: true });
  if (socketDirectory) await rm(socketDirectory, { recursive: true, force: true });
}
