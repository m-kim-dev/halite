import { _electron, expect } from '@playwright/test';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
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
const control = action => new Promise((resolve, reject) => {
  const directory = path.join(tmpdir(), `halite-${process.getuid()}-${createHash('sha256').update(path.resolve(env.HALITE_STATE_DIR)).digest('hex').slice(0, 16)}`);
  const req = request({ socketPath: path.join(directory, 'control.sock'), path: '/command', method: 'POST' }, response => {
    let data = ''; response.on('data', chunk => { data += chunk; }); response.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
  });
  req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Test control timeout'))); req.end(JSON.stringify({ protocol: 1, action }));
});
let application;
const errors = [];
const launch = async () => {
  const executablePath = source ? path.join(root, 'node_modules/electron/dist/electron') : installedBinary || path.join(installation, 'opt/halite/halite');
  const instance = await _electron.launch({ executablePath, args: source ? [root] : [], cwd: temporary, env, chromiumSandbox: process.env.HALITE_TEST_NO_SANDBOX !== '1', timeout: 30000 });
  const page = await instance.firstWindow();
  instance.process().stderr.on('data', data => { if (process.env.HALITE_TEST_DEBUG) process.stderr.write(data); });
  page.on('pageerror', error => errors.push(error.message));
  return { instance, page };
};
const menu = async (label, section = 'File') => application.evaluate(({ Menu }, { label, section }) => Menu.getApplicationMenu().items.find(item => item.label === section).submenu.items.find(item => item.label === label).click(), { label, section });
const welcome = async () => menu('Welcome');
const reader = async page => {
  await expect(page.locator('iframe:not([hidden])')).toHaveCount(1);
  const handle = await page.locator('iframe:not([hidden])').elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForLoadState(); return frame;
};
let serviceURL;

try {
  let launched = await launch(); application = launched.instance; let page = launched.page;
  await expect(page.getByRole('heading', { name: 'A quiet place to read your project.' })).toBeVisible();
  if (installedBinary) {
    const isolation = await application.evaluate(({ app, BrowserWindow }) => ({ disabled: app.commandLine.hasSwitch('no-sandbox'), renderer: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox }));
    expect(isolation).toEqual({ disabled: false, renderer: true });
  }
  await page.screenshot({ path: path.join(output, 'welcome.png') });
  await page.getByRole('button', { name: 'Take a look around' }).click();
  let document = await reader(page);
  await expect(document.getByRole('heading', { name: 'A clearer view of your project', exact: true })).toBeVisible();
  serviceURL = new URL(page.url()).origin;
  const firstOrigin = serviceURL;
  await expect(document.locator('.mermaid-canvas svg')).toBeVisible({ timeout: 20000 });
  expect(await document.evaluate(() => typeof window.halite)).toBe('undefined');
  expect(await document.evaluate(() => typeof window.require)).toBe('undefined');
  expect(await document.evaluate(async () => (await navigator.permissions.query({ name: 'clipboard-write' })).state)).toBe('granted');
  expect(await document.evaluate(async () => (await navigator.permissions.query({ name: 'clipboard-read' })).state)).toBe('denied');
  await page.screenshot({ path: path.join(output, 'reader.png') });
  await document.getByRole('link', { name: 'crystal notes', exact: true }).click();
  await expect(document.locator('.katex-display')).toHaveCount(2);
  await checkFind(application, document, output, errors);
  await welcome();
  await expect(page.getByRole('heading', { name: 'A quiet place to read your project.' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'example', exact: true })).toHaveCount(1);

  // Exercise the real native-picker callback with a deterministic selection.
  await application.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, fixture);
  await page.getByRole('button', { name: 'Open a folder', exact: false }).click();
  document = await reader(page);
  await expect(document.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  const projectId = new URL(document.url()).pathname.split('/')[2];
  const projectOrigin = `${serviceURL}/api/projects/${projectId}`;
  await expect(page.getByRole('tab')).toHaveCount(2);
  const documentFile = path.join(fixture, 'docs/README.md');
  const before = await readFile(documentFile, 'utf8');
  await writeFile(documentFile, `${before}\nDesktop live refresh works.\n`);
  await expect(document.locator('.prose')).toContainText('Desktop live refresh works.', { timeout: 10000 });
  await document.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect.poll(async () => (await (await fetch(`${projectOrigin}/bootstrap`)).json()).preferences.theme).toBe('dark');
  await welcome();
  await expect(page.locator('.recent-project-list')).toContainText('my-project');
  // The packaged CLI uses the bundled runtime and joins the desktop's daemon.
  const binary = source ? path.join(root, 'node_modules/electron/dist/electron') : installedBinary || path.join(installation, 'opt/halite/halite');
  const cliFile = source ? path.join(root, 'dist/server/server/cli.js') : path.join(path.dirname(binary), 'resources/app/dist/server/server/cli.js');
  const cli = args => execFileSync(binary, [cliFile, ...args], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 15000 });
  const shared = await control('status');
  expect(cli(['status'])).toContain(serviceURL);
  expect(cli([fixture, '--no-open'])).toContain(serviceURL);
  await expect(page.getByRole('tab')).toHaveCount(2);
  const extra = path.join(temporary, 'another-project');
  await mkdir(path.join(extra, '.git'), { recursive: true });
  await writeFile(path.join(extra, 'README.md'), '# Another project\n');
  const cliWindowPromise = application.waitForEvent('window');
  cli([extra, '--window', '--no-open']);
  const cliWindow = await cliWindowPromise;
  await expect((await reader(cliWindow)).getByRole('heading', { name: 'Another project', exact: true })).toBeVisible();
  expect(new URL(cliWindow.url()).origin).toBe(serviceURL);
  expect((await control('status')).pid).toBe(shared.pid);
  await application.evaluate(({ BrowserWindow }, url) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url); w.focus(); w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'w', modifiers: ['control', 'shift'] }); }, cliWindow.url());
  await expect.poll(() => application.windows().length).toBe(1);
  // Tabs retain their reader and can move between native windows on the same port.
  await page.getByRole('tab', { name: 'my-project', exact: true }).click();
  await page.getByRole('tab', { name: 'my-project', exact: true }).click({ button: 'right' });
  const pendingWindow = application.waitForEvent('window');
  await page.getByRole('menuitem', { name: 'Move to new window' }).click();
  const second = await pendingWindow;
  const secondReader = await reader(second);
  await expect(secondReader.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  expect(new URL(second.url()).origin).toBe(firstOrigin);
  expect(new URL(secondReader.url()).pathname.split('/')[2]).toBe(projectId);
  await expect(secondReader.locator('html')).toHaveAttribute('data-theme', 'dark');
  await second.getByRole('tab', { name: 'my-project', exact: true }).click({ button: 'right' });
  await second.getByRole('menuitem', { name: 'Move to example', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await application.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url).close(), second.url());
  await expect.poll(() => application.windows().length).toBe(1);
  await page.screenshot({ path: path.join(output, 'project-tabs.png') });
  console.log('Desktop check: closing first session');
  await application.close(); application = undefined;
  console.log('Desktop check: restarting');

  launched = await launch(); application = launched.instance; page = launched.page;
  await expect(page.locator('.recent-project-list')).toContainText('my-project');
  await page.locator('.recent-project-list button').filter({ hasText: 'my-project' }).click();
  document = await reader(page);
  await expect(document.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  await expect(document.locator('html')).toHaveAttribute('data-theme', 'dark');
  await welcome();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.recent-project-list')).toContainText('No recent projects yet.');
  expect(JSON.parse(await readFile(path.join(env.HALITE_STATE_DIR, 'workspace-settings.json'), 'utf8')).recents).toEqual([]);
  expect(errors).toEqual([]);
  console.log(`${source ? 'Source app' : installedBinary ? 'System package' : 'Desktop archive'} passed: welcome, example, diagrams, math, document find (counts, buttons, keyboard, case, navigation cleanup), source preview, folder picker callback, IPC isolation, live refresh, project tabs, moving between windows, recent projects, restart, preferences, and shared-service cleanup.`);
  console.log(`Chromium sandbox: ${process.env.HALITE_TEST_NO_SANDBOX === '1' ? 'disabled by explicit test override' : 'enabled'}. Screenshots: test-results/desktop/`);
} catch (error) {
  console.error('Desktop check failed:', error);
  console.error('Service state:', await control('status').catch(() => null));
  if (application) for (const p of application.windows()) { console.error('Window:', p.url(), await p.locator('body').innerText().catch(() => 'closed')); }
  throw error;
} finally {
  await application?.close().catch(() => {});
  await control('stop').catch(() => {});
  if (serviceURL) await expect.poll(async () => fetch(serviceURL).then(() => false, () => true)).toBe(true);
  await rm(temporary, { recursive: true, force: true });
}
