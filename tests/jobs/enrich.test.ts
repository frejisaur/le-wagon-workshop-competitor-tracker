import {describe, expect, it} from 'vitest';
import {assertDistinctFixturePaths} from '@/jobs/enrich';

describe('enrich CLI fixture safety', () => {
  it('rejects resolved-equal fixture input and output paths before any write', () => {
    expect(() => assertDistinctFixturePaths('tests/fixtures/airtable/base-snapshot.json', './tests/fixtures/airtable/base-snapshot.json')).toThrow('output-state must not resolve to fixture-state');
  });
});
