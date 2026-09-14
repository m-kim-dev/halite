// Optional compatibility check against an already running local viewer.
// Usage: node scripts/check-rendering.mjs http://127.0.0.1:4173 docs/README.md ...
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const [base = 'http://127.0.0.1:4173', ...paths] = process.argv.slice(2);
if (!paths.length) throw new Error('Supply one or more project-relative document paths.');
await mkdir('test-results/compatibility', { recursive: true });
const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index];
    await page.goto(`${base}/?path=${encodeURIComponent(path)}`);
    await page.locator('.prose').waitFor();
    // User scrolling cancels the short restoration observer.
    await page.locator('.reader').hover();
    await page.mouse.wheel(0, 1);
    const diagrams = page.locator('.diagram-block');
    const diagramCount = await diagrams.count();
    for (let i = 0; i < diagramCount; i++) {
      await diagrams.nth(i).scrollIntoViewIfNeeded();
      await diagrams.nth(i).locator('.mermaid-canvas svg, .render-error').waitFor({ timeout: 20000 });
    }
    const images = page.locator('.document-image img');
    const imageCount = await images.count();
    for (let i = 0; i < imageCount; i++) {
      await images.nth(i).scrollIntoViewIfNeeded();
      await images.nth(i).evaluate(image => image.decode());
    }
    const result = {
      path, headings: await page.locator('.prose :is(h1,h2,h3,h4,h5,h6)').count(),
      math: await page.locator('.katex').count(), mathErrors: await page.locator('.katex-error').count(),
      diagrams: diagramCount, renderErrors: await page.locator('.render-error').allTextContents(),
      images: imageCount, imageErrors: await page.locator('.image-error').count(),
    };
    if (result.mathErrors || result.renderErrors.length || result.imageErrors) failed = true;
    console.log(JSON.stringify(result));
    await page.locator('.reader').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: `test-results/compatibility/${index + 1}.png` });
  }
  console.log(JSON.stringify({ pageErrors }));
  if (pageErrors.length) failed = true;
} finally { await browser.close(); }
if (failed) process.exitCode = 1;
