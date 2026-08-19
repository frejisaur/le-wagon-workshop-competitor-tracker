import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {auditSkillCandidate} from '@/lib/workshop/skill-audit';

describe('workshop skill audit', () => {
  it('accepts the canonical skills and rejects an overlapping vague candidate', () => {
    const data = readFileSync('.agents/skills/competitor-data-contracts/SKILL.md', 'utf8');
    const dashboard = readFileSync('.agents/skills/building-competitor-dashboard/SKILL.md', 'utf8');
    expect(auditSkillCandidate(data, data, 'data')).toMatchObject({valid: true, missingRules: []});
    expect(auditSkillCandidate(dashboard, dashboard, 'dashboard')).toMatchObject({valid: true, missingRules: []});
    expect(auditSkillCandidate('---\nname: seo\ndescription: Helps with data\n---\nDo the task.', data, 'data').valid).toBe(false);
  });
});
