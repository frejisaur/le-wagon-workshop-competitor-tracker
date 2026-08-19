import {existsSync} from 'node:fs';
import {lstat, mkdir, mkdtemp, readFile, readlink, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {describe, expect, it} from 'vitest';

describe('skill-link restoration', () => {
  it('restores a dereferenced Claude skill copy to the canonical repository link', async () => {
    const scriptPath = resolve('scripts/restore-skill-links.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    if (!existsSync(scriptPath)) return;

    const root = await mkdtemp(join(tmpdir(), 'competitor-skill-links-'));
    const skill = 'competitor-data-contracts';
    const canonical = join(root, '.agents', 'skills', skill);
    const mirror = join(root, '.claude', 'skills', skill);
    try {
      await mkdir(canonical, {recursive: true});
      await mkdir(mirror, {recursive: true});
      await writeFile(join(canonical, 'SKILL.md'), 'canonical instructions');
      await writeFile(join(mirror, 'SKILL.md'), 'dereferenced upload copy');

      const module = await import(pathToFileURL(scriptPath).href) as {
        restoreClaudeSkillLinks(options: {root: string; skills: string[]}): Promise<void>;
      };
      await module.restoreClaudeSkillLinks({root, skills: [skill]});

      expect((await lstat(mirror)).isSymbolicLink()).toBe(true);
      expect(await readlink(mirror)).toBe('../../.agents/skills/competitor-data-contracts');
      expect(await realpath(mirror)).toBe(await realpath(canonical));
      expect(await readFile(join(mirror, 'SKILL.md'), 'utf8')).toBe('canonical instructions');
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  });
});
