import { _electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Record the actual packaged reader using public example files. No project or
// preference files belonging to the person running the script are changed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'halite-demo-'));
const output = path.join(root, 'test-results/demo');
await mkdir(output, { recursive: true });
const env = { ...process.env, HALITE_DESKTOP_STATE_DIR: path.join(temporary, 'desktop-state'), HALITE_STATE_DIR: path.join(temporary, 'reader-state') };
delete env.ELECTRON_RUN_AS_NODE;
let application;
try {
  application = await _electron.launch({
    executablePath: path.join(root, `release/Halite-linux-${process.arch}/halite`),
    cwd: temporary, env,
    chromiumSandbox: process.env.HALITE_DEMO_NO_SANDBOX !== '1',
    recordVideo: { dir: temporary, size: { width: 1280, height: 800 } },
  });
  const page = await application.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 800));
  const hold = ms => new Promise(resolve => setTimeout(resolve, ms));
  await expect(page.getByRole('heading', { name: 'A quiet place to read your project.' })).toBeVisible();
  await hold(1600);
  await page.getByRole('button', { name: 'Take a look around' }).click();
  await expect(page.locator('.mermaid-canvas svg')).toBeVisible({ timeout: 20000 });
  await hold(2600);
  await page.getByRole('button', { name: 'Expand diagram', exact: true }).click();
  await expect(page.locator('.mermaid-expanded svg')).toBeVisible();
  await hold(2200);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').pressSequentially('crystal', { delay: 120 });
  await hold(1200);
  await page.keyboard.press('Enter');
  await expect(page.locator('.katex-display')).toHaveCount(2);
  await hold(3500);
  await page.getByRole('link', { name: 'Python calculation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'spacing.py', exact: true })).toBeVisible();
  await hold(2600);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.locator('.katex-display')).toHaveCount(2);
  await page.locator('.reader').evaluate(node => node.scrollTo({ top: 0, behavior: 'smooth' }));
  await hold(500);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await hold(3000);
  expect(errors).toEqual([]);
  const video = page.video();
  await application.close(); application = undefined;
  await video.saveAs(path.join(output, 'halite-demo.webm'));
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(output, 'halite-demo.webm'), '-an', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'halite-demo.mp4')]);
  // A smaller, silent animation can be embedded directly in GitHub Markdown.
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(output, 'halite-demo.mp4'), '-filter_complex', 'fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', path.join(output, 'halite-demo.gif')]);
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  console.log(`Recorded Halite ${metadata.version}: welcome, Mermaid expansion, quick open, equations, source preview, and dark theme.`);
  console.log(`Output: ${output}`);
  console.log(`Chromium sandbox: ${process.env.HALITE_DEMO_NO_SANDBOX === '1' ? 'disabled for this recording only; not installation validation' : 'enabled'}.`);
} finally {
  await application?.close();
  await rm(temporary, { recursive: true, force: true });
}
