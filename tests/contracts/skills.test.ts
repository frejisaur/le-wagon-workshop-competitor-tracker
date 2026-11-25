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
      read('docs/operations/deployment.md'), read('README.md'),
    ].join('\n');
    for (const skill of ['competitor-data-contracts', 'building-competitor-dashboard', 'generating-gtm-battlecards', 'operating-competitor-intelligence']) {
      expect(discovery).toContain(skill);
      expect(read(`.agents/skills/${skill}/SKILL.md`)).toContain('---');
      expect(realpathSync(`.claude/skills/${skill}`)).toBe(realpathSync(`.agents/skills/${skill}`));
    }
    for (const name of ['enrich', 'insights:prepare', 'insights:submit', 'insights:publish-approved']) {
      expect(packageJson.scripts[name]).toBeTruthy();
      expect(docs).toContain(`npm run ${name}`);
    }
  });

  it('keeps the supplied release estimate below the strict free-plan limit', () => {
    expect(estimateRecordBudget({companies: 52, keywords: 358, paidAds: 16, insights: 52, reviews: 52, system: 1}))
      .toEqual({total: 531, withinFreeLimit: true});
  });
});
