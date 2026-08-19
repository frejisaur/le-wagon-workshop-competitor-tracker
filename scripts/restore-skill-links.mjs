import {access, lstat, mkdir, readlink, realpath, rm, symlink} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const canonicalSkills = [
  'competitor-data-contracts',
  'building-competitor-dashboard',
  'generating-gtm-battlecards',
  'operating-competitor-intelligence',
];

export async function restoreClaudeSkillLinks({root = process.cwd(), skills = canonicalSkills} = {}) {
  const repositoryRoot = resolve(root);
  const agentsRoot = join(repositoryRoot, '.agents', 'skills');
  const claudeRoot = join(repositoryRoot, '.claude', 'skills');
  await mkdir(claudeRoot, {recursive: true});

  for (const skill of skills) {
    if (!/^[a-z0-9-]+$/.test(skill)) throw new Error(`Invalid skill name: ${skill}`);
    const canonical = join(agentsRoot, skill);
    await access(join(canonical, 'SKILL.md'));
    const resolvedCanonical = await realpath(canonical);
    if (!resolvedCanonical.startsWith(`${await realpath(agentsRoot)}${sep}`)) {
      throw new Error(`Skill resolves outside the canonical directory: ${skill}`);
    }

    const mirror = join(claudeRoot, skill);
    const target = relative(dirname(mirror), canonical);
    try {
      if ((await lstat(mirror)).isSymbolicLink() && await readlink(mirror) === target) continue;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await rm(mirror, {recursive: true, force: true});
    await symlink(target, mirror, 'dir');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await restoreClaudeSkillLinks();
}
