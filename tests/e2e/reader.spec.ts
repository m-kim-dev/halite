import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('opens folders, searches files, follows encoded links, and previews source', async ({ page }) => {
  await page.goto('/?path=docs/README.md');
  await expect(page.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  await expect(page.getByRole('tree', { name: 'Project documents' })).toBeVisible();
  await page.getByRole('link', { name: 'A file with spaces', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A file with spaces' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Source example' }).click();
  await expect(page.getByRole('heading', { name: 'example.py' })).toBeVisible();
  await expect(page.locator('.code-block')).toContainText('def read_document');
  await expect(page.locator('.code-block .shiki')).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('equations');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Equations', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('renders math dialects, code, disabled tasks, and local images safely', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?path=docs/math.md');
  await expect(page.locator('.katex')).toHaveCount(5);
  await expect(page.locator('.katex-display')).toHaveCount(2);
  await expect(page.locator('.prose')).not.toContainText('[object Object]');
  await expect(page.locator('.prose')).toContainText('For $10,000 NAV, buy $5,000 long and $5,000 short.');
  await expect(page.locator('.code-block')).toContainText(String.raw`\(keep this as source\)`);
  await page.goto('/?path=docs/guide.md');
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(page.getByRole('checkbox').first()).toBeDisabled();
  const image = page.getByRole('img', { name: 'Example plot' });
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  expect(await image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  await page.getByRole('button', { name: 'Expand image: Example plot' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.zoom-value')).toHaveText('125%');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { markdownExecuted?: boolean }).markdownExecuted)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('renders Mermaid, expands diagrams, and isolates invalid diagram errors', async ({ page }) => {
  await page.goto('/?path=docs/architecture.md');
  await expect(page.locator('.mermaid-canvas svg').first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Expand diagram', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.mermaid-expanded svg')).toBeVisible();
  await page.keyboard.press('Escape');
  const firstId = await page.locator('.mermaid-canvas svg').first().getAttribute('id');
  await page.getByRole('heading', { name: 'Invalid diagram', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator('.render-error')).toContainText('Unable to render this diagram');
  await expect(page.locator('.prose')).toContainText('The rest of the document remains readable');
  await expect(page.locator('.mermaid-canvas svg').first()).toHaveAttribute('id', firstId!);
});

test('restores scroll through history and reload, and switches theme', async ({ page }) => {
  await page.goto('/?path=docs/long.md');
  await expect(page.getByRole('heading', { name: 'Long document' })).toBeVisible();
  await page.getByRole('link', { name: 'Section 25', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Section 25', exact: true })).toBeInViewport();
  const top = await page.locator('.reader').evaluate(node => node.scrollTop);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('architecture'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Architecture', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Section 25', exact: true })).toBeInViewport();
  await expect.poll(() => page.locator('.reader').evaluate(node => node.scrollTop)).toBeGreaterThan(top - 80);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(async () => (await (await page.request.get('/api/bootstrap')).json()).preferences.theme).toBe('dark');
  await page.locator('.reader').evaluate(node => node.scrollTop += 450);
  const beforeReload = await page.locator('.reader').evaluate(node => node.scrollTop);
  await expect.poll(async () => (await page.evaluate(() => history.state.position?.top))).toBeGreaterThan(beforeReload - 20);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.locator('.reader').evaluate(node => node.scrollTop)).toBeGreaterThan(beforeReload - 80);
});

test('refreshes an externally edited document and reports missing files', async ({ page, request }) => {
  const { root } = await (await request.get('/api/bootstrap')).json();
  const file = path.join(root, 'docs/A file.md');
  const before = await readFile(file, 'utf8');
  await page.goto('/?path=docs/A%20file.md');
  await expect(page.getByRole('heading', { name: 'A file with spaces' })).toBeVisible();
  try {
    await writeFile(file, before + '\nExternal edit arrived.\n');
    await expect(page.locator('.prose')).toContainText('External edit arrived.', { timeout: 10000 });
  } finally { await writeFile(file, before); }
  await page.goto('/?path=docs/missing.md');
  await expect(page.getByRole('heading', { name: 'Unable to open this document' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find a document', exact: true })).toBeVisible();
});

test('provides navigation on a narrow screen without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?path=docs/README.md');
  await expect(page.getByRole('heading', { name: 'Welcome to the project', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show explorer' }).click();
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toBeVisible();
  await page.getByRole('treeitem', { name: 'guide.md', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reading guide', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'File explorer' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/reader-mobile.png' });
});
