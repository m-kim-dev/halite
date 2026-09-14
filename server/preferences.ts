import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Preferences, ReadingPosition } from '../shared/types.js';

export function cleanPreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  const output: Preferences = {};
  if (typeof input.lastPath === 'string' && input.lastPath.length < 4096) output.lastPath = input.lastPath;
  if (input.theme === 'light' || input.theme === 'dark') output.theme = input.theme;
  if (typeof input.fontSize === 'number' && Number.isFinite(input.fontSize)) output.fontSize = Math.max(14, Math.min(24, input.fontSize));
  if (Array.isArray(input.expanded)) output.expanded = input.expanded.filter((x): x is string => typeof x === 'string' && x.length < 4096).slice(0, 500);
  if (input.positions && typeof input.positions === 'object') {
    output.positions = Object.create(null) as Record<string, ReadingPosition>;
    for (const [key, value] of Object.entries(input.positions).slice(-200)) {
      if (key.length > 4096 || !value || typeof value !== 'object') continue;
      const p = value as ReadingPosition;
      if (!Number.isFinite(p.top)) continue;
      output.positions[key] = {
        top: Math.max(0, p.top),
        ...(typeof p.heading === 'string' ? { heading: p.heading.slice(0, 500) } : {}),
        ...(typeof p.offset === 'number' && Number.isFinite(p.offset) ? { offset: p.offset } : {}),
      };
    }
  }
  return output;
}

export class PreferenceStore {
  private file: string;
  private legacyFile?: string;
  private value: Preferences = {};
  private queue: Promise<void> = Promise.resolve();
  constructor(root: string, stateDirectory?: string) {
    const userState = process.env.XDG_STATE_HOME || path.join(homedir(), '.local/state');
    const directory = stateDirectory || process.env.HALITE_STATE_DIR || process.env.MDVIEW_STATE_DIR;
    const filename = `${createHash('sha256').update(root).digest('hex').slice(0, 24)}.json`;
    this.file = path.join(directory || path.join(userState, 'halite'), filename);
    if (!directory) this.legacyFile = path.join(userState, 'markdown-viewer', filename);
  }
  async load() {
    try { this.value = cleanPreferences(JSON.parse(await readFile(this.file, 'utf8'))); }
    catch (error) {
      this.value = {};
      // Only a missing default Halite file should fall back to the old app's state.
      if (this.legacyFile && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        try { this.value = cleanPreferences(JSON.parse(await readFile(this.legacyFile, 'utf8'))); } catch { /* Start with defaults. */ }
      }
    }
    return this.value;
  }
  get current() { return this.value; }
  save(patch: unknown) {
    const clean = cleanPreferences(patch);
    this.value = { ...this.value, ...clean, positions: { ...this.value.positions, ...clean.positions } };
    this.value = cleanPreferences(this.value);
    const content = JSON.stringify(this.value, null, 2) + '\n';
    this.queue = this.queue.catch(() => {}).then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
      const temporary = `${this.file}.${process.pid}.tmp`;
      await writeFile(temporary, content, { mode: 0o600 });
      await rename(temporary, this.file);
    });
    return this.queue;
  }
}
