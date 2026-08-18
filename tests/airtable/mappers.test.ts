import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {toAirtableCompanyFields, toAirtableKeywordFields} from '@/lib/airtable/mappers';
import type {CompanyWrite} from '@/lib/airtable/types';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';

const company: CompanyWrite = {
  companyId: 'company-alpha',
  identity: {canonicalDomain: 'alpha.example', apolloAccountId: 'acct-alpha', apolloRecordId: 'rec-alpha'},
  observed: {
    classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', rawRef: 'apify://dataset/sanitized-alpha',
    domain: 'alpha.example', authorityScore: 20, backlinks: 100, referringDomains: 10, followBacklinks: 60, noFollowBacklinks: 40,
    organicTraffic: 200, totalTraffic: 240, organicKeywords: 12, organicTrafficCostUsd: 10, paidTraffic: 0, paidKeywords: 0, paidTrafficCostUsd: 0,
    aiVisibility: 1, aiVisibilityBenchmark: 2, aiMentions: 3, aiCitedPages: 4, topCountry: 'us', topCountryTraffic: 100,
    mozDomainAuthorityRaw: '1.6k', mozSpamScoreRaw: '3%', organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiByLlm: [], rawSerpCodes: [999], mozTopPagesObserved: [{url: 'alpha.example', pageAuthority: 2}],
  },
  calculated: {
    classification: 'calculated', inputs: ['example'], calculatedAt: '2026-03-03T00:00:00.000Z',
    organicTraffic30DayMovement: 0.1, organicTraffic12MonthMovement: 0.2, nonBrandShare: 0.3, aiBenchmarkGap: -1, trackedSetTrafficShare: 0.4,
    organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiCountriesObservedCount: 0, mozDomainAuthority: {raw: '1.6k', normalized: 1600}, mozSpamScore: {raw: '3%', normalized: 0.03}, mozTopPages: [], mozTopPagesObservedCount: 1, topKeywordSampleCount: 1, compactOrganicTrend: [], landingPagePortfolio: [], paidActivityPresent: false,
  },
  qualityIssues: Array.from({length: 30}, (_, index) => ({code: 'invalid_trend_date' as const, message: 'not persisted', sourcePath: `organic[${index}]`, summary: `bad\nsummary ${index}`})),
};

describe('Airtable mappers', () => {
  it('maps observed and calculated company fields to visibly separate namespaces without raw records', () => {
    const fields = toAirtableCompanyFields(company);

    expect(fields).toMatchObject({
      'Identity • Company ID': 'company-alpha',
      'Observed • Organic Traffic': 200,
      'Calculated • Non-brand Share': 0.3,
      'Observed • Moz Domain Authority Raw': '1.6k',
      'Calculated • Moz Domain Authority': 1600,
    });
    expect(JSON.parse(fields['Quality • Issues JSON'] as string)).toHaveLength(25);
    expect(JSON.stringify(fields)).not.toContain('not persisted');
    expect(JSON.stringify(fields)).not.toContain('raw provider');
  });

  it('preserves deterministic keyword identity apart from observed keyword data', () => {
    const fields = toAirtableKeywordFields({
      observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', keyword: 'alpha topic', landingUrl: 'https://alpha.example/page', position: 1, previousPosition: 2, positionDifference: 1, volume: 10, cpcUsd: 2, keywordDifficulty: 3, competition: 0.2, traffic: 4, trafficSharePct: 5, trafficCostUsd: 6, intents: ['informational'], rawSerpCodes: [999], results: 7},
      calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: '2026-03-03T00:00:00.000Z', companyId: 'company-alpha', keywordId: 'company-alpha\u0000alpha topic\u0000https://alpha.example/page', normalizedLandingUrl: 'https://alpha.example/page'},
    });

    expect(fields).toMatchObject({'Identity • Keyword ID': 'company-alpha\u0000alpha topic\u0000https://alpha.example/page', 'Observed • Keyword': 'alpha topic', 'Calculated • Normalized Landing URL': 'https://alpha.example/page'});
  });

  it('uses a sanitized fixture snapshot only', () => {
    const path = resolve(process.cwd(), 'tests/fixtures/airtable/base-snapshot.json');
    const before = readFileSync(path, 'utf8');
    const snapshot = JSON.parse(before) as Record<string, unknown>;
    expect(snapshot).toHaveProperty('companies');
    expect(JSON.stringify(snapshot)).not.toMatch(/token|authorization|apollo-accounts-semrush-scraper/i);
    const repository = FixtureCompetitorRepository.fromSnapshot(path);
    expect(repository.resolveCompanyIdentity({apolloAccountId: 'acct-alpha', canonicalDomain: 'other.example'}))
      .resolves.toEqual({companyId: 'company-alpha', source: 'apollo_account_id'});
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
});
