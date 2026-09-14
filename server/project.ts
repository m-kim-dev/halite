import { access, lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';
import type { DocFile, DocumentData } from '../shared/types.js';

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const markdownPattern = /\.(md|markdown)$/i;
export const skippedNames = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'venv', '__pycache__', 'coverage', '.cache']);
export const imageTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };
const textExtensions = new Set(['.txt', '.json', '.jsonl', '.py', '.js', '.jsx', '.ts', '.tsx', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.css', '.scss', '.html', '.xml', '.sh', '.bash', '.sql', '.rs', '.go', '.java', '.c', '.h', '.cpp', '.lua', '.vim', '.csv', '.log', '.mdx', '.example']);

export class FileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function isInside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function resolveFile(root: string, relative: string): Promise<string> {
  if (relative.includes('\0') || path.isAbsolute(relative) || relative.includes('\\')) throw new FileError('This path is not inside the open project.', 403);
  const candidate = path.resolve(root, relative);
  if (!isInside(root, candidate)) throw new FileError('This link leaves the open project.', 403);
  let resolved: string;
  try { resolved = await realpath(candidate); } catch { throw new FileError('This file or folder no longer exists.', 404); }
  if (!isInside(root, resolved)) throw new FileError('This symbolic link leaves the open project.', 403);
  return resolved;
}

export async function discoverProject(input: string, explicitRoot?: string) {
  let target: string;
  try { target = await realpath(path.resolve(input)); } catch { throw new FileError(`Cannot open ${input}: path does not exist.`); }
  const targetStat = await stat(target);
  if (!targetStat.isFile() && !targetStat.isDirectory()) throw new FileError('Open a regular file or directory.');
  const directory = targetStat.isDirectory() ? target : path.dirname(target);
  let root = directory;
  if (explicitRoot) {
    root = await realpath(path.resolve(explicitRoot));
    if (!(await stat(root)).isDirectory() || !isInside(root, target)) throw new FileError('--root must be a directory containing the requested path.');
  } else {
    let current = directory;
    while (true) {
      try { await access(path.join(current, '.git')); root = current; break; } catch { /* Search ancestors. */ }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  let focus = path.relative(root, directory).split(path.sep).join('/');
  if (!focus) {
    try { if ((await stat(path.join(root, 'docs'))).isDirectory()) focus = 'docs'; } catch { /* No conventional docs directory. */ }
  }
  return { root, focus, requestedFile: targetStat.isFile() ? path.relative(root, target).split(path.sep).join('/') : undefined };
}

type IgnoreRule = { base: string; matcher: Ignore };

export async function scanDocuments(root: string): Promise<DocFile[]> {
  const files: DocFile[] = [];
  async function walk(directory: string, inherited: IgnoreRule[]) {
    let rules = inherited;
    try { rules = [...rules, { base: directory, matcher: ignore().add(await readFile(path.join(directory, '.gitignore'), 'utf8')) }]; } catch { /* Optional. */ }
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || skippedNames.has(entry.name) || entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (rules.some(rule => rule.matcher.ignores(path.relative(rule.base, absolute).split(path.sep).join('/') + (entry.isDirectory() ? '/' : '')))) continue;
      try {
        if (entry.isDirectory()) await walk(absolute, rules);
        else if (entry.isFile() && markdownPattern.test(entry.name)) {
          const info = await stat(absolute);
          if (info.size > MAX_DOCUMENT_BYTES) continue;
          const content = await readFile(absolute, 'utf8');
          const title = content.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.replace(/[`*_]/g, '') || entry.name.replace(markdownPattern, '');
          files.push({ path: path.relative(root, absolute).split(path.sep).join('/'), title, size: info.size });
        }
      } catch { /* An unreadable or disappearing entry must not break discovery. */ }
    }
  }
  await walk(root, []);
  return files;
}

export async function readDocument(root: string, relative: string): Promise<DocumentData> {
  const absolute = await resolveFile(root, relative);
  const info = await stat(absolute);
  if (info.isDirectory()) {
    const entries = await readdir(absolute, { withFileTypes: true });
    const readme = entries.find(e => e.isFile() && /^readme\.(md|markdown)$/i.test(e.name));
    if (readme) return readDocument(root, path.posix.join(relative, readme.name));
    return {
      path: relative, kind: 'directory', content: '',
      entries: entries.filter(e => !e.name.startsWith('.') && !skippedNames.has(e.name) && !e.isSymbolicLink() && (e.isDirectory() || markdownPattern.test(e.name)))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
        .map(e => ({ name: e.name, path: path.posix.join(relative, e.name), directory: e.isDirectory() })),
    };
  }
  if (!(await lstat(absolute)).isFile()) throw new FileError('Only regular files can be previewed.', 415);
  if (info.size > MAX_DOCUMENT_BYTES) throw new FileError('This file is larger than the 2 MB preview limit.', 413);
  const extension = path.extname(absolute).toLowerCase();
  const markdown = markdownPattern.test(absolute);
  if (!markdown && !textExtensions.has(extension) && !/^(Dockerfile|Makefile|LICENSE|NOTICE|Caddyfile)$/i.test(path.basename(absolute))) {
    throw new FileError('This file type cannot be previewed. Markdown, source code, and text configuration files are supported.', 415);
  }
  const content = await readFile(absolute, 'utf8');
  if (content.includes('\0')) throw new FileError('This appears to be a binary file and cannot be shown as text.', 415);
  return { path: relative, kind: markdown ? 'markdown' : 'text', content, modified: info.mtimeMs };
}
