import { build } from 'esbuild';
import { packager } from '@electron/packager';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { packageDeb } from './package-deb.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) throw new Error('Build on Linux x64 or arm64. Cross-compilation is not configured.');
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
const electron = JSON.parse(await readFile('node_modules/electron/package.json', 'utf8'));
const release = path.join(root, 'release');
const stage = path.join(release, 'stage');
await mkdir(release, { recursive: true });
await rm(stage, { recursive: true, force: true });
await mkdir(path.join(stage, 'dist/server/server'), { recursive: true });
await cp('desktop', path.join(stage, 'desktop'), { recursive: true });
await cp('dist/client', path.join(stage, 'dist/client'), { recursive: true });
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: metadata.name, productName: 'Halite', version: metadata.version, license: metadata.license, author: metadata.author, private: true, type: 'module', main: 'desktop/main.cjs', description: metadata.description }, null, 2));
await cp('LICENSE', path.join(stage, 'LICENSE'));

// Keep the same directory layout as the CLI so static assets resolve identically.
await build({ entryPoints: ['server/app.ts', 'server/client.ts', 'server/daemon.ts', 'server/cli.ts'], outdir: path.join(stage, 'dist/server/server'), bundle: true, platform: 'node', target: 'node22', format: 'esm', external: ['vite'], banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });

// Retain upstream license texts, including nested font/component notices.
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = ['Halite desktop preview — third-party notices\n\nThe following are installed production dependencies; some may be eliminated by bundling. Electron and Chromium licenses are supplied alongside this file.\n'];
async function licenseFiles(directory, prefix = '', depth = 0) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
    const relative = path.join(prefix, item.name);
    if (item.isFile() && /^(licen[cs]e|copying|notice|ofl)([.-]|$)/i.test(item.name)) result.push(relative);
    else if (item.isDirectory() && depth < 4) result.push(...await licenseFiles(path.join(directory, item.name), relative, depth + 1));
  }
  return result.sort();
}
for (const [directory, entry] of Object.entries(lock.packages)) {
  if (!directory || entry.dev) continue;
  const info = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  notices.push(`\n${'='.repeat(72)}\n${info.name} ${info.version}\nDeclared license: ${typeof info.license === 'string' ? info.license : JSON.stringify(info.license || info.licenses || 'See upstream')}`);
  const files = await licenseFiles(directory);
  if (!files.length) {
    const readme = (await readdir(directory)).find(name => /^readme\.md$/i.test(name));
    const content = readme ? await readFile(path.join(directory, readme), 'utf8') : '';
    const section = content.match(/^## License\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1];
    if (section?.includes('Permission is hereby granted')) notices.push(`\n--- License from ${readme} ---\n${section}`);
    else if (['rehype-katex', 'remark-math'].includes(info.name)) notices.push(`\n--- Upstream monorepo license ---\n${await readFile('desktop/licenses/remark-math.txt', 'utf8')}`);
    else throw new Error(`Missing license text for ${info.name}; review before packaging.`);
  }
  for (const file of files) notices.push(`\n--- ${file} ---\n${await readFile(path.join(directory, file), 'utf8')}`);
}
await writeFile(path.join(stage, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n'));

const [bundle] = await packager({ dir: stage, out: release, name: 'Halite', executableName: 'halite', platform: 'linux', arch: process.arch, electronVersion: electron.version, appVersion: metadata.version, overwrite: true, prune: false, asar: false });
// Packager's temporary root may be 0700. Distribution directories must be
// traversable after a package manager changes their ownership to root.
async function normalizePermissions(directory) {
  await chmod(directory, 0o755);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await normalizePermissions(filename);
    else if (entry.isFile()) await chmod(filename, (await stat(filename)).mode & 0o111 ? 0o755 : 0o644);
  }
}
await normalizePermissions(bundle);
await cp('desktop/install.sh', path.join(bundle, 'install.sh'));
await cp('docs/guides/linux-preview.md', path.join(bundle, 'START-HERE.md'));
await cp('LICENSE', path.join(bundle, 'LICENSE.halite.txt'));
await cp(path.join(stage, 'THIRD-PARTY-NOTICES.txt'), path.join(bundle, 'THIRD-PARTY-NOTICES.txt'));
const name = `halite-${metadata.version}-linux-${process.arch}-preview.tar.gz`;
execFileSync('tar', ['-czf', path.join(release, name), '-C', release, path.basename(bundle)]);
const deb = await packageDeb({ bundle, release, version: metadata.version, arch: process.arch });
for (const artifact of [name, deb]) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join(release, artifact))) hash.update(chunk);
  await writeFile(path.join(release, `${artifact}.sha256`), `${hash.digest('hex')}  ${artifact}\n`);
}
await rm(stage, { recursive: true, force: true });
console.log(`\nLinux previews: release/${name}\n                release/${deb}\nSHA-256 checksums accompany each package.\nNo files have been uploaded.`);
