import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {transformSemrushCompany, type TransformSemrushContext} from '@/lib/transforms/semrush-to-domain';
import {toAirtableCompanyFields} from '@/lib/airtable/mappers';

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
  it('requires an immutable company ID before producing persistence-ready child identities', () => {
    // @ts-expect-error companyId is required to build child identities.
    const missingIdContext: TransformSemrushContext = {
      identity: context.identity,
      observedAt: context.observedAt,
      calculatedAt: context.calculatedAt,
    };

    expect(() => transformSemrushCompany(semrushFixture[0], missingIdContext as unknown as TransformSemrushContext)).toThrow('companyId is required');
    expect(transformSemrushCompany(semrushFixture[0], context).keywords[0].calculated.keywordId)
      .toBe(transformSemrushCompany(semrushFixture[0], context).keywords[0].calculated.keywordId);
    expect(transformSemrushCompany(semrushFixture[1], context).paidAds[0].calculated.paidAdId)
      .toBe(transformSemrushCompany(semrushFixture[1], context).paidAds[0].calculated.paidAdId);
  });

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

    expect(evidence.company.observed.organicCompetitors.some((item) => item.domain === 'alpha.example')).toBe(true);
    expect(evidence.company.observed.aiCountries).toEqual([
      {country: 'ca', mentions: 2, visibility: 1},
      {country: 'us', mentions: 0, visibility: 0},
    ]);
    expect(evidence.company.calculated.organicCompetitors.every((item) => item.domain !== 'alpha.example')).toBe(true);
    expect(evidence.company.calculated.aiCountries).toEqual([{country: 'ca', mentions: 2, visibility: 1}]);
    expect(evidence.company.calculated.aiCountriesObservedCount).toBe(2);
  });

  it('preserves provider-ranked AI cited sources as observed evidence', () => {
    const evidence = transformSemrushCompany(semrushFixture[0], context);

    expect(evidence.company.observed.aiTopCitedSources).toEqual([
      {domain: 'source.example', mentions: 1},
    ]);
  });

  it('projects classified direct-field groups and identifies normalized keyword and ad records', () => {
    const evidence = transformSemrushCompany(semrushFixture[0], context);

    expect(evidence.company.observed).toMatchObject({classification: 'observed', source: 'semrush', observedAt: context.observedAt});
    expect(evidence.company.observed).not.toHaveProperty('data');
    expect(evidence.company.calculated).toMatchObject({classification: 'calculated', calculatedAt: context.calculatedAt});
    expect(evidence.company.calculated).not.toHaveProperty('data');
    expect(evidence.keywords[0].observed).toMatchObject({
      keyword: 'alpha topic', rawSerpCodes: [999], classification: 'observed',
    });
    expect(evidence.keywords[0].observed).not.toHaveProperty('keywordId');
    expect(evidence.keywords[0].observed).not.toHaveProperty('normalizedLandingUrl');
    expect(evidence.keywords[0].observed).not.toHaveProperty('data');
    expect(evidence.keywords[0].calculated).toMatchObject({
      companyId: 'company-alpha', normalizedLandingUrl: 'https://alpha.example/page', classification: 'calculated',
    });
    expect(evidence.keywords[0].calculated.keywordId).toBe('company-alpha\u0000alpha topic\u0000https://alpha.example/page');
    const paidAd = transformSemrushCompany(semrushFixture[1], context).paidAds[0];
    expect(paidAd.observed).not.toHaveProperty('paidAdId');
    expect(paidAd.observed).not.toHaveProperty('normalizedLandingUrl');
    expect(paidAd.calculated).not.toHaveProperty('data');
    expect(paidAd.calculated).toMatchObject({companyId: 'company-alpha', normalizedLandingUrl: 'https://beta.example/ad', classification: 'calculated'});
    expect(evidence.company.observed).not.toHaveProperty('aiCountriesObservedCount');
    expect(evidence.company.observed).not.toHaveProperty('mozDomainAuthority');
    expect(evidence.company.calculated.mozDomainAuthority).toEqual({raw: '1.6k', normalized: 1600});
  });

  it('keeps one provider-ranked row per stable keyword identity and records repeated observations', () => {
    const record = structuredClone(semrushFixture[0]);
    const first = record.organic!.top_keywords[0];
    record.organic!.top_keywords = [
      first,
      {...first, position: 99, traffic: (first.traffic ?? 0) + 1},
    ];

    const evidence = transformSemrushCompany(record, context);

    expect(evidence.keywords).toHaveLength(1);
    expect(evidence.keywords[0].observed.position).toBe(first.position);
    expect(evidence.company.calculated.landingPagePortfolio).toEqual([
      expect.objectContaining({keywordCount: 1}),
    ]);
    expect(evidence.qualityIssues).toContainEqual({
      code: 'duplicate_keyword_identity',
      message: 'Repeated keyword identity omitted after the first provider-ranked observation',
      sourcePath: 'organic.top_keywords[1]',
      summary: 'repeated company, keyword, and normalized landing URL',
    });
  });

  it('omits suspicious Moz pages from display data while retaining a quality issue and observed summary', () => {
    const evidence = transformSemrushCompany(semrushFixture[0], context);

    expect(evidence.company.observed.mozTopPagesObserved).toEqual([{url: 'alpha.example', pageAuthority: 2}]);
    expect(evidence.company.calculated.mozTopPagesObservedCount).toBe(1);
    expect(evidence.company.calculated.mozTopPages).toEqual([]);
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
    expect(evidence.paidAds[0].calculated.paidAdId).toHaveLength(64);
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
    expect(evidence.company.calculated.organicCompetitors).toEqual([]);
    expect(evidence.company.calculated.nonBrandShare).toBeNull();
  });

  it('models paid activity as true, explicit false, or unknown without an invalid paid section', () => {
    const positive = transformSemrushCompany(semrushFixture[1], context);
    const explicitZero = transformSemrushCompany({...structuredClone(semrushFixture[0]), paid_traffic: 0, paid_keywords: 0}, context);
    const missingPaid = structuredClone(semrushFixture[0]);
    delete missingPaid.paid;

    expect(positive.company.calculated.paidActivityPresent).toBe(true);
    expect(explicitZero.company.calculated.paidActivityPresent).toBe(false);
    expect(transformSemrushCompany(missingPaid, context).company.calculated.paidActivityPresent).toBeNull();
  });

  it('preserves paid competitor traffic and keywords independently of organic competitor fields through Airtable mapping', () => {
    const record = structuredClone(semrushFixture[1]);
    record.paid!.competitors = [{...record.paid!.competitors[0]!, domain: 'paid-rival.example', ad_traffic: 71, paid_keywords: 17, organic_keywords: 999, common_keywords: 5}];

    const evidence = transformSemrushCompany(record, context);
    const fields = toAirtableCompanyFields({...evidence.company, companyId: context.companyId, qualityIssues: evidence.qualityIssues});
    const paidCompetitor = JSON.parse(fields['Observed • Paid Competitors JSON'] as string)[0];

    expect(evidence.company.observed.paidCompetitors[0]).toMatchObject({paidTraffic: 71, paidKeywords: 17, organicKeywords: 999});
    expect(paidCompetitor).toMatchObject({paidTraffic: 71, paidKeywords: 17, organicKeywords: 999});
  });

  it('sorts actual ISO dates by epoch and records bounded issues for invalid calendar strings', () => {
    const record = structuredClone(semrushFixture[1]);
    record.organic!.trend_global_monthly = [
      ...Array.from({length: 12}, (_, index) => ({...semrushFixture[0].organic!.trend_global_monthly[0], date: `2024-02-${String(30 + index).padStart(2, '0')}`, organic_traffic: 900})),
      {...semrushFixture[0].organic!.trend_global_monthly[0], date: '2024-01-01', organic_traffic: 10},
      {...semrushFixture[0].organic!.trend_global_monthly[0], date: '2024-03-01', organic_traffic: 30},
      {...semrushFixture[0].organic!.trend_global_monthly[0], date: '2024-02-01', organic_traffic: 20},
    ];
    const evidence = transformSemrushCompany(record, context);

    expect(evidence.company.calculated.compactOrganicTrend.map((point) => point.date)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
    expect(evidence.qualityIssues).toContainEqual(expect.objectContaining({code: 'invalid_trend_date', sourcePath: 'organic.trend_global_monthly[0].date', summary: 'invalid ISO calendar date omitted'}));
    expect(evidence.qualityIssues.filter((issue) => issue.code === 'invalid_trend_date')).toHaveLength(10);
  });
});
