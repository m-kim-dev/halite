import { _electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFind } from './check-find.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(path.join(tmpdir(), 'halite-desktop-check-'));
const output = path.join(root, 'test-results/desktop');
await mkdir(output, { recursive: true });
const installation = path.join(temporary, 'installed app');
const installedBinary = process.env.HALITE_TEST_BINARY;
const source = process.env.HALITE_TEST_SOURCE === '1';
if (installedBinary && source) throw new Error('Choose a source check or an installed binary, not both.');
if (!installedBinary && !source) {
  const archive = path.join(root, `release/halite-${metadata.version}-linux-${process.arch}-preview.tar.gz`);
  execFileSync('tar', ['-xzf', archive, '-C', temporary]);
  const extracted = path.join(temporary, `Halite-linux-${process.arch}`);
  execFileSync('sh', [path.join(extracted, 'install.sh')], { env: { ...process.env, HALITE_INSTALL_ROOT: installation }, stdio: 'pipe' });
  // The installed app must continue working after the original extraction is gone.
  await rm(extracted, { recursive: true });
}
if (installedBinary && process.env.HALITE_TEST_NO_SANDBOX === '1') throw new Error('System-package validation requires the Chromium sandbox.');
const fixture = path.join(temporary, 'my-project');
await cp(path.join(root, 'tests/fixtures/project'), fixture, { recursive: true });
// Anchor discovery to this fixture even if the host's temporary directory sits
// inside another repository.
await mkdir(path.join(fixture, '.git'), { recursive: true });
const env = { ...process.env, HALITE_DESKTOP_STATE_DIR: path.join(temporary, 'desktop-state'), HALITE_STATE_DIR: path.join(temporary, 'reader-state') };
delete env.ELECTRON_RUN_AS_NODE;
let application;
const errors = [];
const launch = async () => {
  const executablePath = source ? path.join(root, 'node_modules/electron/dist/electron') : installedBinary || path.join(installation, 'opt/halite/halite');
  const instance = await _electron.launch({ executablePath, args: source ? [root] : [], cwd: temporary, env, chromiumSandbox: process.env.HALITE_TEST_NO_SANDBOX !== '1', timeout: 30000 });
  const page = await instance.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  return { instance, page };
};
const welcome = async () => application.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === 'Welcome').click());
try {
  let launched = await launch(); application = launched.instance; let page = launched.page;
  await expect(page.getByRole('heading', { name: 'A quiet place to read your project.' })).toBeVisible();
  await expect(page.locator('#version')).toHaveText(metadata.version);
  if (installedBinary) {
    const isolation = await application.evaluate(({ app, BrowserWindow }) => ({ disabled: app.commandLine.hasSwitch('no-sandbox'), renderer: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox }));
    expect(isolation).toEqual({ disabled: false, renderer: true });
  }
  await page.screenshot({ path: path.join(output, 'welcome.png') });
  await page.getByRole('button', { name: 'Take a look around' }).click();
  await expect(page.getByRole('heading', { name: 'A clearer view of your project', exact: true })).toBeVisible();
  const firstOrigin = new URL(page.url()).origin;
  await expect(page.locator('.mermaid-canvas svg')).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => typeof window.halite)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  expect(await page.evaluate(async () => (await navigator.permissions.query({ name: 'clipboard-write' })).state)).toBe('granted');
  expect(await page.evaluate(async () => (await navigator.permissions.query({ name: 'clipboard-read' })).state)).toBe('denied');
  await page.screenshot({ path: path.join(output, 'reader.png') });
  await page.getByRole('link', { name: 'crystal notes', exact: true }).click();
  await expect(page.locator('.katex-display')).toHaveCount(2);
  await checkFind(application, page, output, errors);
  await welcome();
  await expect(page.locator('#empty')).toBeVisible();
  await expect.poll(async () => fetch(`${firstOrigin}/api/bootstrap`).then(() => false, () => true)).toBe(true);

  // Exercise the real native-picker callback with a deterministic selection.
  await application.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, fixture);
  await page.getByRole('button', { name: 'Open a folder', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  const projectOrigin = new URL(page.url()).origin;
  const documentFile = path.join(fixture, 'docs/README.md');
  const before = await readFile(documentFile, 'utf8');
  await writeFile(documentFile, `${before}\nDesktop live refresh works.\n`);
  await expect(page.locator('.prose')).toContainText('Desktop live refresh works.', { timeout: 10000 });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect.poll(async () => (await (await fetch(`${projectOrigin}/api/bootstrap`)).json()).preferences.theme).toBe('dark');
  await welcome();
  await expect(page.locator('.recent')).toContainText('my-project');
  await application.close(); application = undefined;
  await expect.poll(async () => fetch(`${projectOrigin}/api/bootstrap`).then(() => false, () => true)).toBe(true);

  launched = await launch(); application = launched.instance; page = launched.page;
  await expect(page.locator('.recent')).toContainText('my-project');
  await page.locator('.recent').click();
  await expect(page.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await welcome();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('#empty')).toBeVisible();
  expect(JSON.parse(await readFile(path.join(env.HALITE_DESKTOP_STATE_DIR, 'recent-projects.json'), 'utf8'))).toEqual([]);
  expect(errors).toEqual([]);
  console.log(`${source ? 'Source app' : installedBinary ? 'System package' : 'Desktop archive'} passed: welcome, example, diagrams, math, document find (counts, buttons, keyboard, case, navigation cleanup), source preview, folder picker callback, IPC isolation, live refresh, recent projects, restart, preferences, and server cleanup.`);
  console.log(`Chromium sandbox: ${process.env.HALITE_TEST_NO_SANDBOX === '1' ? 'disabled by explicit test override' : 'enabled'}. Screenshots: test-results/desktop/`);
} finally {
  await application?.close();
  await rm(temporary, { recursive: true, force: true });
}
