import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { discoverProject, readDocument, resolveFile, scanDocuments } from '../server/project';
import { startServer } from '../server/app';

let temporary: string;
let root: string;
beforeEach(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), 'halite-unit-')); root = path.join(temporary, 'project');
  await mkdir(path.join(root, 'docs'), { recursive: true }); await mkdir(path.join(root, '.git'));
  await writeFile(path.join(root, 'README.md'), '# Project\n');
  await writeFile(path.join(root, 'docs/guide.md'), '# Guide\n');
});
afterEach(async () => { await rm(temporary, { recursive: true, force: true }); });

describe('Read-only filesystem service', () => {
  it('discovers the enclosing project while focusing on the requested directory', async () => {
    const project = await discoverProject(path.join(root, 'docs/guide.md'));
    expect(project.root).toBe(root); expect(project.focus).toBe('docs'); expect(project.requestedFile).toBe('docs/guide.md');
  });
  it('rejects traversal and symlinks that leave the project', async () => {
    await writeFile(path.join(temporary, 'outside.md'), 'private');
    await symlink(path.join(temporary, 'outside.md'), path.join(root, 'escape.md'));
    await expect(resolveFile(root, '../outside.md')).rejects.toThrow('leaves');
    await expect(resolveFile(root, 'escape.md')).rejects.toThrow('symbolic link');
    await expect(resolveFile(root, '/etc/passwd')).rejects.toThrow('not inside');
  });
  it('honors nested ignore files and excludes dependency trees', async () => {
    await writeFile(path.join(root, 'docs/.gitignore'), 'draft*\n');
    await writeFile(path.join(root, 'docs/draft.md'), '# Draft');
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'node_modules/noise.md'), '# Noise');
    expect((await scanDocuments(root)).map(file => file.path).sort()).toEqual(['README.md', 'docs/guide.md']);
  });
  it('opens folder READMEs and previews linked source files as text', async () => {
    await writeFile(path.join(root, 'docs/README.md'), '# Documentation');
    await writeFile(path.join(root, 'app.py'), 'print("hello")');
    expect((await readDocument(root, 'docs')).path).toBe('docs/README.md');
    expect((await readDocument(root, 'app.py')).kind).toBe('text');
    await writeFile(path.join(root, 'binary.txt'), Buffer.from([0, 2, 3]));
    await expect(readDocument(root, 'binary.txt')).rejects.toThrow('binary');
  });
  it('enforces HTTP read-only access, origin checks, and separate preference storage', async () => {
    const app = await startServer({ input: root, port: 0, stateDirectory: path.join(temporary, 'state') });
    try {
      const before = await readFile(path.join(root, 'README.md'), 'utf8');
      expect((await fetch(`${app.url}/api/document?path=README.md`)).status).toBe(200);
      expect((await fetch(`${app.url}/api/document?path=README.md`, { method: 'PUT', body: 'changed' })).status).toBe(405);
      expect((await fetch(`${app.url}/api/bootstrap`, { headers: { Origin: 'https://unrelated.example' } })).status).toBe(403);
      expect((await fetch(`${app.url}/api/document?path=..%2Foutside.md`)).status).toBe(403);
      const saved = await fetch(`${app.url}/api/preferences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: 'dark', lastPath: 'docs/guide.md', fontSize: 200 }) });
      expect(saved.status).toBe(200);
      const stateFiles = await readdir(path.join(temporary, 'state'));
      const state = JSON.parse(await readFile(path.join(temporary, 'state', stateFiles[0]), 'utf8'));
      expect(state.theme).toBe('dark'); expect(state.fontSize).toBe(24);
      expect(await readFile(path.join(root, 'README.md'), 'utf8')).toBe(before);
    } finally { await app.close(); }
  });
});
