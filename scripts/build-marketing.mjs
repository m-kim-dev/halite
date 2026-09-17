import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'marketing/config.json'), 'utf8'));
const origin = new URL(config.url).origin;
if (!origin.startsWith('https://')) throw new Error('The public site URL must use HTTPS.');
const output = path.join(root, 'dist/marketing');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'assets'), { recursive: true });
await cp(path.join(root, 'marketing/public'), output, { recursive: true });
for (const name of ['halite-reader.png', 'halite-project-tabs.png', 'halite-demo.mp4']) {
  await cp(path.join(root, 'docs/images', name), path.join(output, 'assets', name));
}
await cp(path.join(root, 'desktop/icon.svg'), path.join(output, 'assets/halite.svg'));
const htmlPath = path.join(output, 'index.html');
const html = await readFile(htmlPath, 'utf8');
await writeFile(htmlPath, html.replace('</head>', `  <link rel="canonical" href="${origin}/">\n    <meta property="og:url" content="${origin}/">\n  </head>`));
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
console.log(`Built static Halite marketing page in ${path.relative(root, output)} for ${origin}`);
