import {readFileSync, realpathSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {estimateRecordBudget} from '@/lib/airtable/record-budget';

const read = (path: string) => readFileSync(path, 'utf8');

describe('release contracts', () => {
  it('keeps repository skills discoverable and operational commands synchronized', () => {
    const packageJson = JSON.parse(read('package.json')) as {scripts: Record<string, string>};
    const discovery = read('AGENTS.md');
    const docs = [
      read('.agents/skills/operating-competitor-intelligence/SKILL.md'),
      read('.agents/skills/operating-competitor-intelligence/references/runbook.md'),
      read('docs/operations/deployment.md'), read('docs/operations/workshop-runbook.md'), read('README.md'),
    ].join('\n');
    for (const skill of ['competitor-data-contracts', 'building-competitor-dashboard', 'generating-gtm-battlecards', 'operating-competitor-intelligence']) {
      expect(discovery).toContain(skill);
      expect(read(`.agents/skills/${skill}/SKILL.md`)).toContain('---');
      expect(read(`.agents/skills/${skill}/agents/openai.yaml`)).toMatch(/display_name:/);
      expect(realpathSync(`.claude/skills/${skill}`)).toBe(realpathSync(`.agents/skills/${skill}`));
    }
    for (const name of ['enrich', 'insights:prepare', 'insights:submit', 'insights:publish-approved']) {
      expect(packageJson.scripts[name]).toBeTruthy();
      expect(docs).toContain(`npm run ${name}`);
    }
  });

  it('defines one shared Node 22 image and distinct safe Railway service contracts', () => {
    const dockerfile = read('Dockerfile');
    const railway = read('railway.toml');
    const deployment = read('docs/operations/deployment.md');
    expect(dockerfile).toMatch(/FROM node:22-/);
    expect(dockerfile).toMatch(/USER app/);
    expect(dockerfile).toContain('CMD ["npm", "start"]');
    expect(dockerfile).not.toMatch(/^HEALTHCHECK/m);
    expect(railway).toMatch(/builder\s*=\s*"DOCKERFILE"/);
    expect(railway).not.toMatch(/startCommand|cronSchedule|healthcheckPath/);
    expect(deployment).toContain('npm start');
    expect(deployment).toContain('npm run enrich');
    expect(deployment).toContain('0 15 * * 1');
    expect(deployment).toMatch(/no public domain/i);
    expect(deployment).toMatch(/timeout.*20m/i);
    expect(deployment).toMatch(/present.*missing/i);
    expect(deployment).not.toMatch(/echo \$|printenv/i);
  });

  it('keeps the supplied release estimate below the strict free-plan limit', () => {
    expect(estimateRecordBudget({companies: 52, keywords: 358, paidAds: 16, insights: 52, reviews: 52, system: 1}))
      .toEqual({total: 531, withinFreeLimit: true});
  });
});
