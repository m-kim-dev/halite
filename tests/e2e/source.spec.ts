import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('shows literal Markdown and copies the original text from both views', async ({ page, request }) => {
  const { root } = await (await request.get('/api/bootstrap')).json();
  const original = await readFile(path.join(root, 'docs/source.md'), 'utf8');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async (text: string) => { (window as unknown as { copiedMarkdown: string }).copiedMarkdown = text; },
  } }));
  await page.goto('/?path=docs/source.md');
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { copiedMarkdown: string }).copiedMarkdown)).toBe(original);
  await expect(page.getByRole('button', { name: 'Copy Markdown', exact: true })).toHaveText('Copied!');
  await page.getByRole('group', { name: 'Document view' }).getByRole('button', { name: 'Source', exact: true }).click();
  expect(await page.locator('.markdown-source').textContent()).toBe(original);
  await expect(page.getByRole('complementary', { name: 'Document outline' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { copiedMarkdown: string }).copiedMarkdown)).toBe(original);
  expect(await page.evaluate(() => (window as unknown as { markdownExecuted?: boolean }).markdownExecuted)).toBeUndefined();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reply draft', exact: true })).toBeVisible();
});

test('selects source for manual copying when the clipboard is unavailable', async ({ page, request }) => {
  const { root } = await (await request.get('/api/bootstrap')).json();
  const original = await readFile(path.join(root, 'docs/guide.md'), 'utf8');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
  } }));
  await page.goto('/?path=docs/guide.md');
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await expect(page.locator('.markdown-source')).toBeFocused();
  await expect(page.getByRole('status')).toContainText('press Ctrl+C or ⌘C');
  // Chromium's rendered selection string omits a final newline. The range must
  // still cover the complete original source node, including that newline.
  expect(await page.evaluate(() => window.getSelection()?.getRangeAt(0).cloneContents().textContent)).toBe(original);
  await expect(page.getByRole('button', { name: 'Copy Markdown', exact: true })).not.toHaveText('Copied!');
});

test('keeps preview and source scroll positions separate through navigation and reload', async ({ page }) => {
  await page.goto('/?path=docs/long.md');
  await page.getByRole('link', { name: 'Section 25', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Section 25', exact: true })).toBeInViewport();
  const previewTop = await page.locator('.reader').evaluate(el => el.scrollTop);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect.poll(() => page.locator('.reader').evaluate(el => el.scrollTop)).toBe(0);
  await page.locator('.reader').evaluate(el => el.scrollTop = 900);
  await expect.poll(() => page.locator('.reader').evaluate(el => el.scrollTop)).toBe(900);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect.poll(() => page.locator('.reader').evaluate(el => el.scrollTop)).toBeCloseTo(previewTop, 0);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect.poll(() => page.locator('.reader').evaluate(el => el.scrollTop)).toBe(900);
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('guide'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Reading guide', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Section 25', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Section 25', exact: true })).toBeInViewport();
});

test('copies live edits and empty files, and hides Markdown actions for other content', async ({ page, request }) => {
  const { root } = await (await request.get('/api/bootstrap')).json();
  const file = path.join(root, 'docs/source.md');
  const original = await readFile(file, 'utf8');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async (text: string) => { (window as unknown as { copiedMarkdown: string }).copiedMarkdown = text; },
  } }));
  await page.goto('/?path=docs/source.md');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  try {
    await writeFile(file, original + '\nUpdated draft.\n');
    await expect(page.locator('.markdown-source')).toContainText('Updated draft.');
    await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as { copiedMarkdown: string }).copiedMarkdown)).toBe(original + '\nUpdated draft.\n');
  } finally { await writeFile(file, original); }
  await page.goto('/?path=docs/empty.md');
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { copiedMarkdown: string }).copiedMarkdown)).toBe('');
  for (const target of ['example.py', 'docs/notes', 'docs/missing.md']) {
    await page.goto(`/?path=${target}`);
    await expect(page.locator('.reader')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('group', { name: 'Document view' })).toHaveCount(0);
  }
});

test('ignores late clipboard failures after navigation and fits a narrow screen', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: () => new Promise((_resolve, reject) => { (window as unknown as { rejectCopy: () => void }).rejectCopy = () => reject(new Error('Denied')); }),
  } }));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/?path=docs/source.md');
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('guide'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Reading guide', exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { rejectCopy: () => void }).rejectCopy());
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.notice')).toHaveCount(0);
  const source = page.getByRole('button', { name: 'Source', exact: true });
  await source.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.markdown-source')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/markdown-source-mobile.png' });
});

test('does not copy the previous document while the next document is loading', async ({ page, request }) => {
  const { root } = await (await request.get('/api/bootstrap')).json();
  const expected = await readFile(path.join(root, 'docs/math.md'), 'utf8');
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: {
    writeText: async (text: string) => { (window as unknown as { copiedMarkdown: string }).copiedMarkdown = text; },
  } }));
  await page.goto('/?path=docs/guide.md');
  await expect(page.getByRole('heading', { name: 'Reading guide', exact: true })).toBeVisible();
  let finishRequest!: () => void;
  const pending = new Promise<void>(resolve => { finishRequest = resolve; });
  await page.route('**/api/document?path=docs%2Fmath.md', async route => { await pending; await route.continue(); });
  try {
    await page.getByRole('link', { name: 'equations', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copy Markdown', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Source', exact: true })).toBeDisabled();
  } finally { finishRequest(); }
  await expect(page.getByRole('heading', { name: 'Equations', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { copiedMarkdown: string }).copiedMarkdown)).toBe(expected);
});
