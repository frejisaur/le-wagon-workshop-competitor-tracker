import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {transformSemrushCompany, type TransformSemrushContext} from '@/lib/transforms/semrush-to-domain';

const fixtureDirectory = resolve(process.cwd(), 'tests/fixtures/providers');
const semrushFixture = parseSemrushPayload(JSON.parse(readFileSync(resolve(fixtureDirectory, 'semrush-sample.json'), 'utf8'))).records;
const context: TransformSemrushContext = {
  companyId: 'company-alpha',
  identity: {canonicalDomain: 'alpha.example', apolloAccountId: 'acct-alpha', apolloRecordId: 'rec-alpha'},
  observedAt: '2026-03-03T00:00:00.000Z',
  calculatedAt: '2026-03-03T00:00:00.000Z',
  rawRef: 'apify://dataset/sanitized-alpha',
  trackedSetTotalTraffic: 640,
};

describe('transformSemrushCompany', () => {
  it('keeps conflicting backlink totals independent', () => {
    const record = structuredClone(semrushFixture[0]);
    record.backlinks = 100;
    record.follow_backlinks = 60;
    record.nofollow_backlinks = 30;

    const evidence = transformSemrushCompany(record, context);

    expect(evidence.company.observed.backlinks).toBe(100);
    expect(evidence.company.observed.followBacklinks).toBe(60);
    expect(evidence.company.observed.noFollowBacklinks).toBe(30);
  });

  it('filters self competitors and zero AI countries without erasing raw meaning', () => {
    const record = structuredClone(semrushFixture[0]);
    record.organic!.competitors.push({...record.organic!.competitors[0], domain: 'other.example'});
    record.ai_search!.by_country = [
      {country: 'ca', mentions: 2, visibility: 1},
      {country: 'us', mentions: 0, visibility: 0},
    ];

    const evidence = transformSemrushCompany(record, context);

    expect(evidence.company.observed.organicCompetitors.every((item) => item.domain !== 'alpha.example')).toBe(true);
    expect(evidence.company.observed.aiCountries).toEqual([{country: 'ca', mentions: 2, visibility: 1}]);
    expect(evidence.company.observed.aiCountriesObservedCount).toBe(2);
  });

  it('projects classified direct-field groups and identifies normalized keyword and ad records', () => {
    const evidence = transformSemrushCompany(semrushFixture[0], context);

    expect(evidence.company.observed).toMatchObject({classification: 'observed', source: 'semrush', observedAt: context.observedAt});
    expect(evidence.company.observed).not.toHaveProperty('data');
    expect(evidence.company.calculated).toMatchObject({classification: 'calculated', calculatedAt: context.calculatedAt});
    expect(evidence.company.calculated).not.toHaveProperty('data');
    expect(evidence.keywords[0]).toMatchObject({
      companyId: 'company-alpha',
      keyword: 'alpha topic',
      normalizedLandingUrl: 'https://alpha.example/page',
      rawSerpCodes: [999],
      classification: 'observed',
    });
    expect(evidence.keywords[0].keywordId).toBe('company-alpha\u0000alpha topic\u0000https://alpha.example/page');
  });

  it('omits suspicious Moz pages from display data while retaining a quality issue and observed summary', () => {
    const evidence = transformSemrushCompany(semrushFixture[0], context);

    expect(evidence.company.observed.mozTopPagesObservedCount).toBe(1);
    expect(evidence.company.observed.mozTopPages).toEqual([]);
    expect(evidence.qualityIssues).toContainEqual(expect.objectContaining({code: 'suspicious_moz_top_page'}));
  });

  it('calculates compact trends, tracked-set share, and paid activity only from the validated record and context', () => {
    const record = structuredClone(semrushFixture[1]);
    record.organic!.trend_global_daily = [
      {...semrushFixture[0].organic!.trend_global_daily[0], date: '2026-01-01', organic_traffic: 20},
      {...semrushFixture[0].organic!.trend_global_daily[0], date: '2026-01-31', organic_traffic: 30},
    ];
    record.organic!.trend_global_monthly = Array.from({length: 25}, (_, index) => ({
      ...semrushFixture[0].organic!.trend_global_monthly[0],
      date: `2024-${String((index % 12) + 1).padStart(2, '0')}-01`,
      organic_traffic: index + 1,
    }));

    const evidence = transformSemrushCompany(record, {...context, trackedSetTotalTraffic: 80});

    expect(evidence.company.calculated.trackedSetTrafficShare).toBe(0.25);
    expect(evidence.company.calculated.organicTraffic30DayMovement).toBe(0.5);
    expect(evidence.company.calculated.compactOrganicTrend).toHaveLength(24);
    expect(evidence.company.calculated.paidActivityPresent).toBe(true);
    expect(evidence.paidAds[0].paidAdId).toHaveLength(64);
  });

  it('uses the analogous calendar month for the 12-month monthly movement', () => {
    const record = structuredClone(semrushFixture[1]);
    record.organic!.trend_global_monthly = [
      {...semrushFixture[0].organic!.trend_global_monthly[0], date: '2023-03-31', organic_traffic: 100},
      {...semrushFixture[0].organic!.trend_global_monthly[0], date: '2023-04-01', organic_traffic: 110},
      {...semrushFixture[0].organic!.trend_global_monthly[0], date: '2024-03-31', organic_traffic: 125},
    ];

    expect(transformSemrushCompany(record, context).company.calculated.organicTraffic12MonthMovement).toBe(0.25);
  });

  it('remains usable when a validated record has a missing nested section', () => {
    const invalidFixture = parseSemrushPayload(JSON.parse(readFileSync(resolve(fixtureDirectory, 'semrush-invalid-subsection.json'), 'utf8'))).records[0];
    const evidence = transformSemrushCompany(invalidFixture, context);

    expect(evidence.keywords).toEqual([]);
    expect(evidence.company.observed.organicCompetitors).toEqual([]);
    expect(evidence.company.calculated.nonBrandShare).toBeNull();
  });
});
