import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server/app';

const temporary = await mkdtemp(path.join(tmpdir(), 'halite-browser-'));
const root = path.join(temporary, 'project');
await cp('tests/fixtures/project', root, { recursive: true });
await mkdir(path.join(root, 'docs/notes'), { recursive: true });
await writeFile(path.join(root, 'docs/long.md'), '# Long document\n\n' + Array.from({ length: 50 }, (_, index) => `## Section ${index + 1}\n\n${'A document reader should preserve your place as you explore the project. '.repeat(12)}\n\n`).join(''));
const app = await startServer({ input: root, root, port: 4187, stateDirectory: path.join(temporary, 'state') });
console.log(`Test fixture: ${app.url}`);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await app.close(); await rm(temporary, { recursive: true, force: true }); process.exit(0); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
