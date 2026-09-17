import { expect } from '@playwright/test';
import path from 'node:path';

// Called with the bundled crystal notes open. These checks run against the
// actual Electron controller and renderer, including in installed-package QA.
export async function checkFind(application, page, output, errors) {
  const open = async (keyboard = false) => {
    const pending = application.waitForEvent('window', { timeout: 10000 });
    if (keyboard) await application.evaluate(({ BrowserWindow }) => {
      const reader = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('http://127.0.0.1:'));
      reader.focus();
      reader.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'f', modifiers: ['control'] });
      reader.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'f', modifiers: ['control'] });
    });
    else await application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'Edit').submenu.items.find(item => item.label === 'Find in Document…').click());
    const panel = await pending;
    panel.on('pageerror', error => errors.push(error.message));
    await expect(panel.getByRole('searchbox')).toBeFocused();
    return panel;
  };

  let panel = await open(true);
  await panel.getByRole('searchbox').fill('cubic');
  await expect(panel.getByRole('status')).toHaveText('1 of 2');
  await panel.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('2 of 2');
  await panel.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('1 of 2');
  await panel.getByRole('button', { name: 'Previous match', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('2 of 2');
  await panel.keyboard.press('Enter');
  await expect(panel.getByRole('status')).toHaveText('1 of 2');
  await panel.keyboard.press('Shift+Enter');
  await expect(panel.getByRole('status')).toHaveText('2 of 2');
  await panel.keyboard.press('F3');
  await expect(panel.getByRole('status')).toHaveText('1 of 2');
  await panel.keyboard.press('Shift+F3');
  await expect(panel.getByRole('status')).toHaveText('2 of 2');

  await panel.getByRole('searchbox').fill('BRAGG');
  await expect(panel.getByRole('status')).toHaveText('1 of 1');
  await panel.getByRole('checkbox', { name: 'Match case' }).check();
  await expect(panel.getByRole('status')).toHaveText('No matches');
  await panel.getByRole('checkbox', { name: 'Match case' }).uncheck();
  await expect(panel.getByRole('status')).toHaveText('1 of 1');

  // Reading-position persistence uses replaceState without changing the file.
  await page.evaluate(() => history.replaceState({ ...history.state, scrollTop: 200 }, '', location.href));
  await expect(panel.getByRole('searchbox')).toHaveValue('BRAGG');
  expect(await page.evaluate(() => typeof window.haliteFind)).toBe('undefined');
  expect(await panel.evaluate(() => typeof window.require)).toBe('undefined');
  await panel.screenshot({ path: path.join(output, 'find.png') });
  await panel.getByRole('searchbox').fill('');
  await expect(panel.getByRole('status')).toHaveText('Type to search');
  // Escape closes the window on keydown, sometimes before Playwright sends keyup.
  await panel.keyboard.press('Escape').catch(error => { if (!panel.isClosed()) throw error; });
  await expect.poll(() => application.windows().length).toBe(1);

  panel = await open();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect.poll(() => application.windows().length).toBe(1);
  panel = await open();
  await panel.getByRole('searchbox').fill('cubic');
  await expect(panel.getByRole('status')).toHaveText('1 of 2');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect.poll(() => application.windows().length).toBe(1);

  panel = await open();
  await panel.getByRole('searchbox').fill('cubic');
  await expect(panel.getByRole('status')).toHaveText('1 of 2');
  await page.getByRole('link', { name: 'Python calculation', exact: true }).click();
  await expect.poll(() => application.windows().length).toBe(1);
  await expect(page.getByRole('heading', { name: 'spacing.py', exact: true })).toBeVisible();
}
