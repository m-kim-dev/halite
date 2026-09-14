import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'halite-install-test-'));
  temporary.push(directory);
  const source = path.join(directory, 'release');
  const target = path.join(directory, "User's local files $cash");
  await mkdir(path.join(source, 'resources/app'), { recursive: true });
  await writeFile(path.join(source, 'resources/app/package.json'), '{}');
  await writeFile(path.join(source, 'halite'), '#!/bin/sh\nprintf \'%s\\n\' "$@"\n', { mode: 0o755 });
  await cp('desktop/install.sh', path.join(source, 'install.sh'));
  const install = () => execFileSync('sh', [path.join(source, 'install.sh')], { env: { ...process.env, HALITE_INSTALL_ROOT: target }, encoding: 'utf8', stdio: 'pipe' });
  return { source, target, install };
}

describe('Linux user installer', () => {
  it('installs and upgrades outside the source tree, quoting paths and preserving arguments', async () => {
    const { source, target, install } = await fixture();
    expect(install()).toContain('Installed Halite');
    expect(execFileSync(path.join(target, 'bin/halite-desktop'), ['argument with spaces', '$literal'], { encoding: 'utf8' })).toBe('argument with spaces\n$literal\n');
    expect(await readFile(path.join(target, 'share/applications/halite.desktop'), 'utf8')).toContain('Name=Halite');
    await writeFile(path.join(source, 'new-version.txt'), 'new build');
    install();
    expect(await readFile(path.join(target, 'opt/halite/new-version.txt'), 'utf8')).toBe('new build');
    expect(await readFile(path.join(source, 'new-version.txt'), 'utf8')).toBe('new build');
  });
  it('refuses to overwrite an unrelated directory or command', async () => {
    const { target, install } = await fixture();
    await mkdir(path.join(target, 'opt/halite'), { recursive: true });
    await writeFile(path.join(target, 'opt/halite/keep.txt'), 'keep');
    expect(install).toThrow();
    expect(await readFile(path.join(target, 'opt/halite/keep.txt'), 'utf8')).toBe('keep');
    await rm(path.join(target, 'opt/halite'), { recursive: true });
    await mkdir(path.join(target, 'bin'), { recursive: true });
    await writeFile(path.join(target, 'bin/halite-desktop'), 'unrelated tool');
    expect(install).toThrow();
    expect(await readFile(path.join(target, 'bin/halite-desktop'), 'utf8')).toBe('unrelated tool');
  });
});
