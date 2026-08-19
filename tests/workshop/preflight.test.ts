import {describe, expect, it} from 'vitest';
import {runWorkshopPreflight} from '@/lib/workshop/preflight';

describe('workshop preflight', () => {
  it('reports secret names as present or missing without values', async () => {
    const report = await runWorkshopPreflight({phase: 'deploy', environment: {AIRTABLE_PAT: 'pat-secret-value', APIFY_TOKEN: 'apify-secret-value'}, fileExists: () => true, probeCommand: async () => ({ok: true})});
    const output = JSON.stringify(report);
    expect(output).toContain('AIRTABLE_PAT'); expect(output).toContain('APIFY_TOKEN');
    expect(output).not.toContain('pat-secret-value'); expect(output).not.toContain('apify-secret-value');
  });
  it('deduplicates checks in the all phase', async () => {
    const report = await runWorkshopPreflight({phase: 'all', environment: {}, fileExists: () => false, probeCommand: async () => ({ok: false})});
    expect(new Set(report.checks.map((check) => `${check.category}:${check.name}`)).size).toBe(report.checks.length);
  });
});
