import {describe, expect, it} from 'vitest';
import {COMPANY_ROW_FIELDS, mergePaidAdHistory, parseCompanyRecord, type StoredPaidAd} from '@/lib/airtable/company-row';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import type {AirtableClient} from '@/lib/airtable/client';
import type {AirtableFields, AirtableRecord, AirtableTable, CompanyWrite} from '@/lib/airtable/types';
import type {CuratedPaidAd} from '@/lib/domain/metrics';

function paidAd(id: string, observedAt = '2026-03-03T00:00:00.000Z', companyId = 'company-alpha'): CuratedPaidAd {
  return {
    observed: {classification: 'observed', source: 'semrush', observedAt, database: 'us', keyword: id, title: 'Sanitized title', description: 'Sanitized description', visibleUrl: 'alpha.example', landingUrl: `https://alpha.example/${id}`, position: 1, previousPosition: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: observedAt, companyId, paidAdId: id, normalizedLandingUrl: `https://alpha.example/${id}`},
  };
}

function stored(id: string, firstObservedAt: string, lastObservedAt: string): StoredPaidAd {
  const ad = paidAd(id, lastObservedAt);
  return {observed: {...ad.observed, firstObservedAt, lastObservedAt}, calculated: ad.calculated};
}

function companyWrite(paidAds: CuratedPaidAd[]): CompanyWrite {
  return {
    companyId: 'company-alpha', identity: {canonicalDomain: 'alpha.example', apolloAccountId: '', apolloRecordId: ''}, qualityIssues: [], paidAds,
    observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', domain: 'alpha.example', authorityScore: null, backlinks: null, referringDomains: null, followBacklinks: null, noFollowBacklinks: null, organicTraffic: 300, totalTraffic: null, organicKeywords: null, organicTrafficCostUsd: null, paidTraffic: null, paidKeywords: null, paidTrafficCostUsd: null, aiVisibility: null, aiVisibilityBenchmark: null, aiMentions: null, aiCitedPages: null, topCountry: null, topCountryTraffic: null, mozDomainAuthorityRaw: null, mozSpamScoreRaw: null, organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiByLlm: [], aiTopCitedSources: [], rawSerpCodes: [], mozTopPagesObserved: []},
    calculated: {classification: 'calculated', inputs: [], calculatedAt: '2026-03-03T00:00:00.000Z', organicTraffic30DayMovement: null, organicTraffic12MonthMovement: null, nonBrandShare: null, aiBenchmarkGap: null, trackedSetTrafficShare: null, organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiCountriesObservedCount: 0, mozDomainAuthority: {raw: null, normalized: null}, mozSpamScore: {raw: null, normalized: null}, mozTopPages: [], mozTopPagesObservedCount: 0, topKeywordSampleCount: 0, compactOrganicTrend: [], landingPagePortfolio: [], paidActivityPresent: true},
  };
}

const companyRecord = (ads: StoredPaidAd[]): AirtableRecord => ({id: 'rec-company-alpha', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example', [COMPANY_ROW_FIELDS.paidAds]: JSON.stringify(ads)}});

type FakeState = {companies: AirtableRecord[]; operations: string[]; patches: AirtableFields[]; failWrites?: boolean};

function productionRepository(state: FakeState): AirtableCompetitorRepository {
  const client = {
    list: async (table: AirtableTable) => table === 'Companies' ? structuredClone(state.companies) : [],
    create: async (table: AirtableTable) => { state.operations.push(`create:${table}`); throw new Error('refresh must not create rows'); },
    update: async (table: AirtableTable, writes: Array<{id?: string; fields: AirtableFields}>) => {
      state.operations.push(`update:${table}`);
      if (state.failWrites) throw new Error('write failed');
      for (const write of writes) {
        state.patches.push(structuredClone(write.fields));
        const record = state.companies.find((item) => item.id === write.id)!;
        record.fields = {...record.fields, ...JSON.parse(JSON.stringify(write.fields))};
      }
      return writes.map((write) => ({id: write.id!, fields: {}}));
    },
  } as unknown as AirtableClient;
  return new AirtableCompetitorRepository(client);
}

const fingerprint = () => 'f'.repeat(64);

describe('paid-ad history merge', () => {
  it('replaces the snapshot while preserving first-observed history for retained ads', () => {
    const merged = mergePaidAdHistory('company-alpha', [paidAd('ad-retained'), paidAd('ad-new')], [stored('ad-retained', '2025-01-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z'), stored('ad-obsolete', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')]);

    expect(merged.map((ad) => [ad.calculated.paidAdId, ad.observed.firstObservedAt, ad.observed.lastObservedAt])).toEqual([
      ['ad-retained', '2025-01-01T00:00:00.000Z', '2026-03-03T00:00:00.000Z'],
      ['ad-new', '2026-03-03T00:00:00.000Z', '2026-03-03T00:00:00.000Z'],
    ]);
    expect(mergePaidAdHistory('company-alpha', [], [stored('ad-obsolete', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')])).toEqual([]);
  });

  it('uses chronological min/max bounds for older retries and ignores invalid stored bounds', () => {
    const [older] = mergePaidAdHistory('company-alpha', [paidAd('ad-1', '2024-01-01T00:00:00.000Z')], [stored('ad-1', '2025-01-01T00:00:00.000Z', '2026-03-03T00:00:00.000Z')]);
    expect(older.observed).toMatchObject({firstObservedAt: '2024-01-01T00:00:00.000Z', lastObservedAt: '2026-03-03T00:00:00.000Z'});
    const [repaired] = mergePaidAdHistory('company-alpha', [paidAd('ad-1')], [stored('ad-1', 'not-a-timestamp', '2026-99-99')]);
    expect(repaired.observed).toMatchObject({firstObservedAt: '2026-03-03T00:00:00.000Z', lastObservedAt: '2026-03-03T00:00:00.000Z'});
  });

  it('fails closed for mismatched or duplicate incoming identities and invalid incoming timestamps', () => {
    expect(() => mergePaidAdHistory('company-alpha', [paidAd('ad-1', undefined, 'company-beta')], [])).toThrow('paid_ad_company_mismatch');
    expect(() => mergePaidAdHistory('company-alpha', [paidAd('ad-1'), paidAd('ad-1')], [])).toThrow('duplicate_incoming_paid_ad_identity');
    expect(() => mergePaidAdHistory('company-alpha', [paidAd('ad-1', 'invalid-observed-at')], [])).toThrow('paid ad observedAt must be a valid ISO timestamp');
  });
});

describe('CompetitorStore.writeCompanyEvidence', () => {
  it('issues exactly one company PATCH with metrics, merged paid-ad history and the fingerprint of the resulting row', async () => {
    const state: FakeState = {companies: [companyRecord([stored('ad-retained', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'), stored('ad-obsolete', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')])], operations: [], patches: []};
    const seen: string[][] = [];
    const result = await productionRepository(state).writeCompanyEvidence(companyWrite([paidAd('ad-retained'), paidAd('ad-new')]), (row) => { seen.push(row.paidAds.map((ad) => ad.calculated.paidAdId)); return fingerprint(); });

    expect(result).toMatchObject({succeeded: 1, failed: 0});
    expect(state.operations).toEqual(['update:Companies']);
    expect(seen).toEqual([['ad-new', 'ad-retained']]);
    expect(state.patches[0]).toMatchObject({'Observed • Organic Traffic': 300, 'Workflow • Evidence Fingerprint': fingerprint()});
    const row = parseCompanyRecord(state.companies[0]);
    expect(row.paidAds.map((ad) => [ad.calculated.paidAdId, ad.observed.firstObservedAt])).toEqual([['ad-new', '2026-03-03T00:00:00.000Z'], ['ad-retained', '2025-01-01T00:00:00.000Z']]);
  });

  it('keeps the stored snapshot when the paid module is omitted', async () => {
    const state: FakeState = {companies: [companyRecord([stored('ad-kept', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')])], operations: [], patches: []};
    const write = companyWrite([]); delete write.paidAds;
    await productionRepository(state).writeCompanyEvidence(write, fingerprint);

    expect(state.patches[0]).not.toHaveProperty(COMPANY_ROW_FIELDS.paidAds);
    expect(parseCompanyRecord(state.companies[0]).paidAds.map((ad) => ad.calculated.paidAdId)).toEqual(['ad-kept']);
  });

  it('fails closed before any write for missing or ambiguous companies and invalid incoming ads', async () => {
    const cases: Array<{name: string; companies: AirtableRecord[]; ads: CuratedPaidAd[]; error: string}> = [
      {name: 'missing company', companies: [], ads: [], error: 'company_missing'},
      {name: 'ambiguous company', companies: [companyRecord([]), {...companyRecord([]), id: 'rec-two'}], ads: [], error: 'duplicate_company_records'},
      {name: 'duplicate incoming identity', companies: [companyRecord([])], ads: [paidAd('ad-one'), paidAd('ad-one')], error: 'Airtable request failed'},
    ];
    for (const testCase of cases) {
      const state: FakeState = {companies: testCase.companies, operations: [], patches: []};
      const result = await productionRepository(state).writeCompanyEvidence(companyWrite(testCase.ads), fingerprint);
      expect(result, testCase.name).toMatchObject({succeeded: 0, failed: 1, results: [{identity: 'company-alpha', error: testCase.error}]});
      expect(state.operations, testCase.name).toEqual([]);
    }
  });

  it('leaves the stored row unchanged when the single write fails', async () => {
    const before = companyRecord([stored('ad-old', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')]);
    const state: FakeState = {companies: [structuredClone(before)], operations: [], patches: [], failWrites: true};

    await expect(productionRepository(state).writeCompanyEvidence(companyWrite([paidAd('ad-new')]), fingerprint)).resolves.toMatchObject({succeeded: 0, failed: 1});
    expect(state.companies[0]).toEqual(before);
  });

  it('matches the production merge contract in the sanitized fixture repository', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    await repository.writeCompanyEvidence(companyWrite([paidAd('ad-retained', '2025-01-01T00:00:00.000Z'), paidAd('ad-obsolete')]), fingerprint);
    await expect(repository.writeCompanyEvidence(companyWrite([paidAd('ad-retained')]), fingerprint)).resolves.toMatchObject({succeeded: 1, failed: 0});

    const [alpha] = (await repository.getDashboardSnapshot()).companies;
    expect(alpha.paidAds.map((ad) => [ad.calculated.paidAdId, ad.observed.firstObservedAt, ad.observed.lastObservedAt])).toEqual([['ad-retained', '2025-01-01T00:00:00.000Z', '2026-03-03T00:00:00.000Z']]);
    expect(alpha.fields['Workflow • Evidence Fingerprint']).toBe(fingerprint());

    await repository.writeCompanyEvidence(companyWrite([]), fingerprint);
    expect((await repository.getDashboardSnapshot()).companies[0].paidAds).toEqual([]);
    await expect(repository.writeCompanyEvidence({...companyWrite([]), companyId: 'company-missing'}, fingerprint)).resolves.toMatchObject({failed: 1, results: [{error: 'company_missing'}]});
  });
});
