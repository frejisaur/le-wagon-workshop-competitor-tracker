import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {buildWorkshopContext} from '@/lib/workshop/context-generator';

describe('workshop context generator', () => {
  it('returns counts and issue categories without provider identities', () => {
    const result = buildWorkshopContext({apolloCsv: readFileSync('tests/fixtures/providers/apollo-sample.csv', 'utf8'), semrushJson: readFileSync('tests/fixtures/providers/semrush-sample.json', 'utf8'), sourceLabel: 'sanitized-fixture', generatedAt: '2026-08-19T00:00:00.000Z'});
    expect(result.expectedCounts).toMatchObject({apolloRows: 3, acceptedCompanies: 2, rejectedRows: 1});
    expect(result.expectedCounts.rejectionCodes).toEqual({missing_apollo_website: 1});
    expect(JSON.stringify(result)).not.toMatch(/alpha\.example|acct-|rec-/);
  });
});
