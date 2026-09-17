import { chromium, expect } from '@playwright/test';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../dist/server/server/app.js';

const temporary = await mkdtemp(path.join(tmpdir(), 'halite-workspace-check-'));
const output = path.resolve('test-results/workspaces');
await mkdir(output, { recursive: true });
const service = await startServer({ port: 0, stateDirectory: path.join(temporary, 'state') });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const projects = [];
try {
  for (let i = 0; i < 8; i++) {
    const root = path.join(temporary, `project-${i + 1}`);
    await cp('tests/fixtures/project', root, { recursive: true });
    await mkdir(path.join(root, '.git'));
    await writeFile(path.join(root, 'docs/README.md'), `# Project ${i + 1}\n\n[Guide](guide.md)\n\n` + 'Reading across many projects.\n\n'.repeat(100));
    projects.push(await service.registry.command({ action: 'open', input: root, mode: 'tab' }));
  }
  await page.goto(projects[0].url);
  await expect(page.getByRole('tab')).toHaveCount(8);
  const active = () => page.frameLocator('iframe:not([hidden])');
  await expect(active().getByRole('heading', { name: 'Project 8', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'project-1', exact: true }).click();
  await expect(active().getByRole('heading', { name: 'Project 1', exact: true })).toBeVisible();
  await active().locator('.reader').evaluate(element => { element.scrollTop = 650; });
  await expect.poll(() => active().locator('.reader').evaluate(element => element.scrollTop)).toBeGreaterThan(600);
  await page.getByRole('tab', { name: 'project-8', exact: true }).click();
  await page.getByRole('tab', { name: 'project-1', exact: true }).click();
  await expect.poll(() => active().locator('.reader').evaluate(element => element.scrollTop)).toBeGreaterThan(600);
  await page.getByRole('tab', { name: 'project-8', exact: true }).click();
  await writeFile(path.join(projects[0].root, 'docs/README.md'), '# Background refresh arrived\n');
  await page.getByRole('tab', { name: 'project-1', exact: true }).click();
  await expect(active().getByRole('heading', { name: 'Background refresh arrived', exact: true })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(output, 'eight-projects.png') });
  // An already-connected workspace receives CLI-style open requests without another window.
  const before = service.registry.status();
  const reopened = await service.registry.command({ action: 'open', input: path.join(projects[1].root, 'docs/guide.md') });
  expect(reopened.shouldOpen).toBe(false);
  await expect(page.getByRole('tab', { name: 'project-2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(active().locator('.breadcrumbs')).toContainText('guide.md');
  expect(service.registry.status().projects).toEqual(before.projects);
  // User-initiated move opens a browser window and retains the project service.
  await page.getByRole('tab', { name: 'project-2', exact: true }).click({ button: 'right' });
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('menuitem', { name: 'Move to new window' }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('tab', { name: 'project-2', exact: true })).toBeVisible();
  expect(new URL(popup.url()).origin).toBe(service.url);
  await expect(popup.frameLocator('iframe:not([hidden])').locator('.breadcrumbs')).toContainText('guide.md');
  await expect(page.getByRole('tab')).toHaveCount(7);
  await popup.close();
  await page.getByRole('button', { name: 'New project tab', exact: true }).click();
  await page.getByRole('combobox', { name: 'Open projects in' }).selectOption('window');
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('project-5');
  await expect(page.locator('.recent-project-list button')).toHaveCount(1);
  await page.setViewportSize({ width: 500, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(output, 'narrow-welcome.png') });
  expect(errors).toEqual([]);
  console.log('Workspace browser passed: eight live projects, switching, scroll retention, background refresh, CLI activation, moving to a window, preferences, recent search, and narrow layout.');
} finally { await browser.close(); await service.close(); await rm(temporary, { recursive: true, force: true }); }
