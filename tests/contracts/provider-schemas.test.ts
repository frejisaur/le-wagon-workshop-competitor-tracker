import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseSemrushPayload} from '@/lib/schemas/semrush';

const fixtureDirectory = resolve(process.cwd(), 'tests/fixtures/providers');

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureDirectory, name), 'utf8'));
}

describe('provider boundary schemas', () => {
  it('accepts valid top-level metrics while isolating a malformed Moz subsection', () => {
    const result = parseSemrushPayload(loadJson('semrush-invalid-subsection.json'));

    expect(result.records[0].domain).toBe('alpha.example');
    expect(result.records[0].moz).toBeUndefined();
    expect(result.issues[0]).toMatchObject({domain: 'alpha.example', section: 'moz'});
  });

  it('rejects a non-array Semrush payload', () => {
    expect(() => parseSemrushPayload({domain: 'alpha.example'})).toThrow(/array/);
  });

  it('preserves Apollo source identifiers and a missing Website', () => {
    const [row] = parseApolloCsv(
      'Company Name,Website,Apollo Account Id,Apollo Record Id\nAlpha,,acct-1,rec-1',
    );

    expect(row).toMatchObject({
      'Company Name': 'Alpha',
      Website: '',
      'Apollo Account Id': 'acct-1',
      'Apollo Record Id': 'rec-1',
    });
  });

  it('parses the complete sanitized provider fixtures without provider data leaking into output', () => {
    const result = parseSemrushPayload(loadJson('semrush-sample.json'));

    expect(result.issues).toEqual([]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      domain: 'alpha.example',
      backlinks: 1000,
      follow_backlinks: 400,
      nofollow_backlinks: 200,
      moz_domain_authority: '1.6k',
      moz_spam_score: '3%',
    });
    expect(result.records[0].organic?.trend_global_daily).toHaveLength(31);
    expect(result.records[0].organic?.trend_global_monthly).toHaveLength(25);
    expect(result.records[0].organic?.top_keywords[0].serp_features_codes).toContain(999);
    expect(result.records[0].paid?.top_ads).toEqual([]);
    expect(result.records[1].paid?.top_ads).toHaveLength(1);
  });

  it('rejects a Semrush record missing strict identity fields', () => {
    expect(() => parseSemrushPayload([{database: 'us'}])).toThrow(/domain/i);
  });
});
