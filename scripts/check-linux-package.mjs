import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const distro = process.argv[2] || 'debian';
const bases = { debian: 'node:24-bookworm-slim', ubuntu: 'ubuntu:24.04' };
if (!Object.hasOwn(bases, distro)) throw new Error('Use debian or ubuntu.');
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
const context = await mkdtemp(path.join(tmpdir(), 'halite-linux-qa-'));
const tag = `halite-package-qa:${distro}-${metadata.version}`;
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn('docker', args, { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Docker exited ${code}`)));
});
try {
  await cp(`release/halite-${metadata.version}-linux-${process.arch}-preview.deb`, path.join(context, 'package.deb'));
  await cp('package.json', path.join(context, 'package.json'));
  await mkdir(path.join(context, 'scripts'), { recursive: true });
  await cp('scripts/check-desktop.mjs', path.join(context, 'scripts/check-desktop.mjs'));
  await cp('scripts/linux-qa', path.join(context, 'scripts/linux-qa'), { recursive: true });
  await cp('tests/fixtures', path.join(context, 'tests/fixtures'), { recursive: true });
  for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
    await mkdir(path.dirname(path.join(context, 'node_modules', name)), { recursive: true });
    await cp(path.join('node_modules', name), path.join(context, 'node_modules', name), { recursive: true });
  }
  await run(['build', '--build-arg', `QA_BASE=${bases[distro]}`, '-t', tag, '-f', path.join(context, 'scripts/linux-qa/Dockerfile'), context]);
  // No host filesystem mounts or external networking during execution.
  await run(['run', '--rm', '--network=none', '--shm-size=1g', tag]);
} finally { await rm(context, { recursive: true, force: true }); }
