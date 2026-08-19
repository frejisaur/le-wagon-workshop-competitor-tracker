import {describe, expect, it} from 'vitest';
import {assertDistinctFixturePaths, runEnrichCli} from '@/jobs/enrich';

describe('enrich CLI fixture safety', () => {
  it('rejects resolved-equal fixture input and output paths before any write', () => {
    expect(() => assertDistinctFixturePaths('tests/fixtures/airtable/base-snapshot.json', './tests/fixtures/airtable/base-snapshot.json')).toThrow('output-state must not resolve to fixture-state');
  });

  it('returns a non-zero exit code for a partial refresh', async () => {
    const result = await runEnrichCli([
      '--provider-fixture', 'tests/fixtures/providers/semrush-sample.json',
      '--fixture-state', 'tests/fixtures/airtable/base-snapshot.json',
    ]);
    expect(JSON.parse(result.stdout)).toMatchObject({status: 'partial'});
    expect(result.exitCode).toBe(1);
  });
});
