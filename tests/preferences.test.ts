import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PreferenceStore } from '../server/preferences';
import type { Preferences } from '../shared/types';

let temporary: string;
let root: string;
let userState: string;

beforeEach(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), 'halite-preferences-'));
  root = path.join(temporary, 'project');
  userState = path.join(temporary, 'state');
  vi.stubEnv('XDG_STATE_HOME', userState);
  vi.stubEnv('HALITE_STATE_DIR', undefined);
  vi.stubEnv('MDVIEW_STATE_DIR', undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(temporary, { recursive: true, force: true });
});

async function seed(directory: string, preferences: Preferences) {
  await new PreferenceStore(root, directory).save(preferences);
  return path.join(directory, (await readdir(directory))[0]);
}

describe('Halite preference storage', () => {
  it('saves a new project under the Halite state directory', async () => {
    const store = new PreferenceStore(root);
    expect(await store.load()).toEqual({});
    await store.save({ theme: 'dark', lastPath: 'docs/guide.md' });
    expect(await new PreferenceStore(root).load()).toMatchObject({ theme: 'dark', lastPath: 'docs/guide.md' });
    expect(await readdir(userState)).toEqual(['halite']);
  });

  it('preserves old reading preferences on the next save without changing the original file', async () => {
    const preferences: Preferences = {
      theme: 'dark', fontSize: 19, lastPath: 'docs/guide.md', expanded: ['docs'],
      positions: { 'docs/guide.md': { top: 480, heading: 'setup', offset: 24 } },
    };
    const legacyFile = await seed(path.join(userState, 'markdown-viewer'), preferences);
    const original = await readFile(legacyFile, 'utf8');
    const store = new PreferenceStore(root);
    expect(await store.load()).toEqual(preferences);
    await expect(readdir(path.join(userState, 'halite'))).rejects.toMatchObject({ code: 'ENOENT' });

    await store.save({ fontSize: 20 });
    expect(await new PreferenceStore(root).load()).toEqual({ ...preferences, fontSize: 20 });
    expect(await readFile(legacyFile, 'utf8')).toBe(original);
  });

  it('prefers existing Halite preferences over the old state', async () => {
    await seed(path.join(userState, 'markdown-viewer'), { theme: 'dark', lastPath: 'old.md' });
    await seed(path.join(userState, 'halite'), { theme: 'light', lastPath: 'new.md' });
    expect(await new PreferenceStore(root).load()).toMatchObject({ theme: 'light', lastPath: 'new.md' });
  });

  it.each([
    { selected: 'explicit', haliteEnv: true, legacyEnv: true },
    { selected: 'halite', haliteEnv: true, legacyEnv: true },
    { selected: 'legacy', haliteEnv: false, legacyEnv: true },
  ])('honors the $selected directory override for both reads and writes', async ({ selected, haliteEnv, legacyEnv }) => {
    const directories = Object.fromEntries(['explicit', 'halite', 'legacy'].map(name => [name, path.join(temporary, name)]));
    for (const [name, directory] of Object.entries(directories)) {
      await seed(directory, { lastPath: `${name}.md`, fontSize: 17 });
    }
    if (haliteEnv) vi.stubEnv('HALITE_STATE_DIR', directories.halite);
    if (legacyEnv) vi.stubEnv('MDVIEW_STATE_DIR', directories.legacy);
    const store = new PreferenceStore(root, selected === 'explicit' ? directories.explicit : undefined);
    expect(await store.load()).toMatchObject({ lastPath: `${selected}.md` });
    await store.save({ fontSize: 20 });
    for (const [name, directory] of Object.entries(directories)) {
      expect(await new PreferenceStore(root, directory).load()).toMatchObject({ fontSize: name === selected ? 20 : 17 });
    }
  });

  it('does not import default preferences into an explicit state directory', async () => {
    await seed(path.join(userState, 'markdown-viewer'), { theme: 'dark' });
    expect(await new PreferenceStore(root, path.join(temporary, 'custom')).load()).toEqual({});
  });

  it('does not restore stale preferences when the Halite file exists but is invalid', async () => {
    await seed(path.join(userState, 'markdown-viewer'), { lastPath: 'old.md' });
    const currentFile = await seed(path.join(userState, 'halite'), { lastPath: 'new.md' });
    await writeFile(currentFile, '{invalid');
    expect(await new PreferenceStore(root).load()).toEqual({});
  });

  it('keeps old preferences scoped to their project', async () => {
    await seed(path.join(userState, 'markdown-viewer'), { lastPath: 'docs/guide.md' });
    expect(await new PreferenceStore(path.join(temporary, 'other-project')).load()).toEqual({});
  });
});
