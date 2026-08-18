import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {AirtableClient} from '@/lib/airtable/client';
import {AirtableCompetitorRepository, escapeFormulaLiteral} from '@/lib/airtable/repository';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {CompanyWrite} from '@/lib/airtable/types';
import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';

const endpoint = 'https://airtable.test';
const requestBodies: Array<{records: unknown[]}> = [];
let rateLimitedRequestCount = 0;
let failCompanyWrites = false;
let deletedKeywordIds: string[] = [];
let companyUpdateCount = 0;
let keywordPostCount = 0;
let failSecondKeywordBatch = false;
const keywordBodies: Array<{records: Array<{fields: Record<string, unknown>}>}> = [];
let companyLookupCount = 0;
let paidAdWriteCount = 0;
let paidAdIdentityLookupCount = 0;
const existingPaidAdIds = new Set<string>();
const paidAdPatchBodies: Array<{records: Array<{fields: Record<string, unknown>}>}> = [];
const paidAdPostBodies: Array<{records: Array<{fields: Record<string, unknown>}>}> = [];
const server = setupServer(
  http.get(`${endpoint}/v0/base/Companies`, ({request}) => {
    const formula = new URL(request.url).searchParams.get('filterByFormula') ?? '';
    if (formula.includes("'acct-1'")) return HttpResponse.json({records: [{id: 'rec-company-existing', fields: {'Identity • Company ID': 'company-existing', 'Observed • Apollo Account ID': 'acct-1', 'Identity • Canonical Domain': 'existing.example'}}]});
    if (formula.includes("'company-alpha'")) {
      companyLookupCount += 1;
      return HttpResponse.json({records: [{id: 'rec-company-alpha', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example'}}]});
    }
    if (formula.includes("'company-beta'")) return HttpResponse.json({records: [{id: 'rec-company-beta', fields: {'Identity • Company ID': 'company-beta', 'Identity • Canonical Domain': 'beta.example'}}]});
    return HttpResponse.json({records: []});
  }),
  http.post(`${endpoint}/v0/base/Companies`, async ({request}) => {
    const body = await request.json() as {records: unknown[]};
    if (failCompanyWrites) return HttpResponse.json({error: {type: 'UNPROCESSABLE_ENTITY'}}, {status: 422});
    if (rateLimitedRequestCount++ === 0) return HttpResponse.json({error: {type: 'TOO_MANY_REQUESTS'}}, {status: 429, headers: {'Retry-After': '0'}});
    requestBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-${index}`, fields: {}}))});
  }),
  http.patch(`${endpoint}/v0/base/Companies`, async ({request}) => {
    companyUpdateCount += 1;
    const body = await request.json() as {records: unknown[]};
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-update-${index}`, fields: {}}))});
  }),
  http.get(`${endpoint}/v0/base/Keywords`, () => HttpResponse.json({records: [{id: 'rec-old-keyword', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Keyword ID': 'company-alpha\u0000old\u0000https://alpha.example/old'}}]})),
  http.post(`${endpoint}/v0/base/Keywords`, async ({request}) => {
    const body = await request.json() as {records: Array<{fields: Record<string, unknown>}>};
    keywordPostCount += 1;
    if (failSecondKeywordBatch && keywordPostCount === 2) return HttpResponse.json({error: {type: 'UNPROCESSABLE_ENTITY'}}, {status: 422});
    keywordBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-keyword-${index}`, fields: {}}))});
  }),
  http.delete(`${endpoint}/v0/base/Keywords`, ({request}) => {
    deletedKeywordIds = new URL(request.url).searchParams.getAll('records[]');
    return HttpResponse.json({records: deletedKeywordIds.map((id) => ({id, fields: {}}))});
  }),
  http.get(`${endpoint}/v0/base/Paid%20Ads`, ({request}) => {
    paidAdIdentityLookupCount += 1;
    const formula = new URL(request.url).searchParams.get('filterByFormula') ?? '';
    if (formula.includes("'ad-fail'")) return HttpResponse.json({error: {type: 'SERVER_ERROR'}}, {status: 500});
    if (formula.includes("'ad-invalid-stored'")) return HttpResponse.json({records: [{id: 'rec-ad-invalid-stored', fields: {'Identity • Paid Ad ID': 'ad-invalid-stored', 'Observed • First Observed At': 'not-a-timestamp', 'Observed • Last Observed At': '2026-99-99'}}]});
    if (formula.includes("'ad-existing'")) return HttpResponse.json({records: [{id: 'rec-ad-existing', fields: {'Identity • Paid Ad ID': 'ad-existing', 'Observed • First Observed At': '2025-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'}}]});
    const existingId = [...existingPaidAdIds].find((id) => formula.includes(`'${id}'`));
    if (existingId) return HttpResponse.json({records: [{id: `rec-${existingId}`, fields: {'Identity • Paid Ad ID': existingId}}]});
    return HttpResponse.json({records: []});
  }),
  http.post(`${endpoint}/v0/base/Paid%20Ads`, async ({request}) => {
    paidAdWriteCount += 1;
    const body = await request.json() as {records: Array<{fields: Record<string, unknown>}>};
    paidAdPostBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-ad-${index}`, fields: {}}))});
  }),
  http.patch(`${endpoint}/v0/base/Paid%20Ads`, async ({request}) => {
    paidAdWriteCount += 1;
    const body = await request.json() as {records: Array<{fields: Record<string, unknown>}>};
    paidAdPatchBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-ad-${index}`, fields: {}}))});
  }),
);

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => { server.resetHandlers(); requestBodies.length = 0; rateLimitedRequestCount = 0; failCompanyWrites = false; deletedKeywordIds = []; companyUpdateCount = 0; keywordPostCount = 0; failSecondKeywordBatch = false; keywordBodies.length = 0; companyLookupCount = 0; paidAdWriteCount = 0; paidAdIdentityLookupCount = 0; existingPaidAdIds.clear(); paidAdPatchBodies.length = 0; paidAdPostBodies.length = 0; });
afterAll(() => server.close());

function makeCompanies(count: number): CompanyWrite[] {
  return Array.from({length: count}, (_, index) => ({
    companyId: `company-${index}`, identity: {canonicalDomain: `company-${index}.example`, apolloAccountId: `batch-acct-${index}`, apolloRecordId: `rec-${index}`}, qualityIssues: [],
    observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', domain: `company-${index}.example`, authorityScore: null, backlinks: null, referringDomains: null, followBacklinks: null, noFollowBacklinks: null, organicTraffic: null, totalTraffic: null, organicKeywords: null, organicTrafficCostUsd: null, paidTraffic: null, paidKeywords: null, paidTrafficCostUsd: null, aiVisibility: null, aiVisibilityBenchmark: null, aiMentions: null, aiCitedPages: null, topCountry: null, topCountryTraffic: null, mozDomainAuthorityRaw: null, mozSpamScoreRaw: null, organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiByLlm: [], rawSerpCodes: [], mozTopPagesObserved: []},
    calculated: {classification: 'calculated', inputs: [], calculatedAt: '2026-03-03T00:00:00.000Z', organicTraffic30DayMovement: null, organicTraffic12MonthMovement: null, nonBrandShare: null, aiBenchmarkGap: null, trackedSetTrafficShare: null, organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiCountriesObservedCount: 0, mozDomainAuthority: {raw: null, normalized: null}, mozSpamScore: {raw: null, normalized: null}, mozTopPages: [], mozTopPagesObservedCount: 0, topKeywordSampleCount: 0, compactOrganicTrend: [], landingPagePortfolio: [], paidActivityPresent: null},
  }));
}

function makeKeyword(): CuratedKeyword {
  return {
    observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', keyword: 'new', landingUrl: 'https://alpha.example/new', position: 1, previousPosition: null, positionDifference: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null, intents: [], rawSerpCodes: [], results: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: '2026-03-03T00:00:00.000Z', companyId: 'company-alpha', keywordId: 'company-alpha\u0000new\u0000https://alpha.example/new', normalizedLandingUrl: 'https://alpha.example/new'},
  };
}

function makeKeywords(count: number): CuratedKeyword[] {
  return Array.from({length: count}, (_, index) => {
    const keyword = makeKeyword();
    keyword.observed.keyword = `new-${index}`;
    keyword.observed.landingUrl = `https://alpha.example/new-${index}`;
    keyword.calculated.keywordId = `company-alpha\u0000new-${index}\u0000https://alpha.example/new-${index}`;
    keyword.calculated.normalizedLandingUrl = `https://alpha.example/new-${index}`;
    return keyword;
  });
}

function makePaidAds(count: number, companyId = 'company-alpha', observedAt = '2026-03-03T00:00:00.000Z'): CuratedPaidAd[] {
  return Array.from({length: count}, (_, index) => ({
    observed: {classification: 'observed', source: 'semrush', observedAt, database: 'us', keyword: `paid-${index}`, title: 'title', description: 'description', visibleUrl: 'alpha.example', landingUrl: `https://alpha.example/ad-${index}`, position: 1, previousPosition: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: observedAt, companyId, paidAdId: `ad-${index}`, normalizedLandingUrl: `https://alpha.example/ad-${index}`},
  }));
}

describe('AirtableCompetitorRepository', () => {
  it('caps Retry-After waits, rejects invalid attempt counts, and rejects repeated page offsets', async () => {
    expect(() => new AirtableClient({baseId: 'base', apiToken: 'token', maxAttempts: 0})).toThrow('maxAttempts');
    const waits: number[] = [];
    let attempts = 0;
    const rateLimited = new AirtableClient({baseId: 'base', apiToken: 'token', maxAttempts: 2, jitter: () => 0, sleep: async (milliseconds) => { waits.push(milliseconds); }, fetch: async () => {
      attempts += 1;
      return attempts === 1 ? new Response('{}', {status: 429, headers: {'Retry-After': '86400'}}) : new Response(JSON.stringify({records: []}));
    }});
    await expect(rateLimited.list('Companies')).resolves.toEqual([]);
    expect(waits).toEqual([30_000]);

    let pageCalls = 0;
    const repeatedOffset = new AirtableClient({baseId: 'base', apiToken: 'token', fetch: async () => {
      pageCalls += 1;
      if (pageCalls > 3) throw new Error('stop test');
      return new Response(JSON.stringify({records: [], offset: 'same-offset'}));
    }});
    await expect(repeatedOffset.list('Companies')).rejects.toThrow('repeated offset');
  });

  it('batches Airtable writes in groups of ten and retries a 429', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, maxAttempts: 2, jitter: () => 0}));
    const result = await repository.upsertCompanies(makeCompanies(11));

    expect(requestBodies.map((body) => body.records.length)).toEqual([10, 1]);
    expect(result).toMatchObject({succeeded: 11, failed: 0});
    expect(rateLimitedRequestCount).toBe(3);
  });

  it('reuses an existing company by Apollo Account ID before canonical domain', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    await expect(repository.resolveCompanyIdentity({apolloAccountId: 'acct-1', canonicalDomain: 'new.example'}))
      .resolves.toEqual({companyId: 'company-existing', source: 'apollo_account_id'});
  });

  it('rejects an immutable company ID conflict in production without updating the existing row', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const incoming = makeCompanies(1)[0];
    incoming.companyId = 'company-new';
    incoming.identity.apolloAccountId = 'acct-1';

    await expect(repository.upsertCompanies([incoming])).resolves.toMatchObject({succeeded: 0, failed: 1, results: [{identity: 'company-new', error: 'identity_conflict'}]});
    expect(companyUpdateCount).toBe(0);
    expect(requestBodies).toEqual([]);
  });

  it('rejects the same immutable identity conflict in the fixture and retains its original company row', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    const incoming = makeCompanies(1)[0];
    incoming.companyId = 'company-new';
    incoming.identity.apolloAccountId = 'acct-1';

    await expect(repository.upsertCompanies([incoming])).resolves.toMatchObject({succeeded: 0, failed: 1, results: [{identity: 'company-new', error: 'identity_conflict'}]});
    const snapshot = await repository.getDashboardSnapshot();
    expect(snapshot.companies.filter((record) => record.fields['Identity • Company ID'] === 'company-existing')).toHaveLength(1);
    expect(snapshot.companies).toHaveLength(2);
  });

  it('returns per-record failures without losing successfully written record results', async () => {
    failCompanyWrites = true;
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'secret-token', endpoint, maxAttempts: 1}));
    const result = await repository.upsertCompanies(makeCompanies(1));

    expect(result).toMatchObject({succeeded: 0, failed: 1});
    expect(result.results[0].error).not.toContain('secret-token');
  });

  it('writes a complete replacement keyword set before deleting obsolete identities', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const result = await repository.replaceKeywords('company-alpha', [makeKeyword()]);

    expect(result).toMatchObject({succeeded: 1, failed: 0});
    expect(deletedKeywordIds).toEqual(['rec-old-keyword']);
    expect(keywordBodies[0].records[0].fields['Identity • Company Link']).toEqual(['rec-company-alpha']);
  });

  it('retains obsolete keyword records when a later new-write batch fails', async () => {
    failSecondKeywordBatch = true;
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0, maxAttempts: 1}));
    const result = await repository.replaceKeywords('company-alpha', makeKeywords(11));

    expect(result).toMatchObject({succeeded: 10, failed: 1});
    expect(deletedKeywordIds).toEqual([]);
  });

  it('resolves one Company row and updates sixteen existing same-company paid ads in two batches', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const ads = makePaidAds(16);
    ads.forEach((ad) => existingPaidAdIds.add(ad.calculated.paidAdId));
    const result = await repository.upsertPaidAds(ads);

    expect(result).toMatchObject({succeeded: 16, failed: 0});
    expect(companyLookupCount).toBe(1);
    expect(paidAdIdentityLookupCount).toBe(16);
    expect(paidAdPostBodies).toEqual([]);
    expect(paidAdPatchBodies.map((body) => body.records.length)).toEqual([10, 6]);
  });

  it('keeps a failed paid-ad group out of writes while another company group succeeds', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const failedGroup = makePaidAds(2);
    failedGroup[1].calculated.paidAdId = 'ad-fail';
    const successfulGroup = makePaidAds(1, 'company-beta');
    successfulGroup[0].calculated.paidAdId = 'ad-beta';

    const result = await repository.upsertPaidAds([...failedGroup, ...successfulGroup]);
    expect(result).toMatchObject({succeeded: 1, failed: 2});
    expect(paidAdPostBodies.flatMap((body) => body.records).map((record) => record.fields['Identity • Paid Ad ID'])).toEqual(['ad-beta']);
  });

  it('stages fixture paid-ad writes per company and continues after a group mapping failure', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    const beta = makeCompanies(1)[0];
    beta.companyId = 'company-beta';
    beta.identity = {canonicalDomain: 'beta.example', apolloAccountId: 'acct-beta', apolloRecordId: 'rec-beta'};
    await repository.upsertCompanies([beta]);
    const failedGroup = makePaidAds(2);
    failedGroup[1].observed.observedAt = 'invalid-observed-at';
    const healthyGroup = makePaidAds(1, 'company-beta');
    healthyGroup[0].calculated.paidAdId = 'ad-beta';

    const result = await repository.upsertPaidAds([...failedGroup, ...healthyGroup]);

    expect(result).toMatchObject({succeeded: 1, failed: 2});
    expect((await repository.getDashboardSnapshot()).paidAds.map((record) => record.fields['Identity • Paid Ad ID'])).toEqual(['ad-beta']);
  });

  it('fails a missing paid-ad company group without issuing paid-ad writes', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const result = await repository.upsertPaidAds(makePaidAds(2, 'company-missing'));

    expect(result).toMatchObject({succeeded: 0, failed: 2});
    expect(paidAdWriteCount).toBe(0);
  });

  it('preserves a paid ad first-observed timestamp while updating its last-observed timestamp', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const ad = makePaidAds(1, 'company-alpha', '2026-03-03T00:00:00.000Z')[0];
    ad.calculated.paidAdId = 'ad-existing';

    await expect(repository.upsertPaidAds([ad])).resolves.toMatchObject({succeeded: 1, failed: 0});
    expect(paidAdPatchBodies[0].records[0].fields).toMatchObject({'Observed • First Observed At': '2025-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});
  });

  it('preserves paid first-observed time in the fixture repository too', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    const first = makePaidAds(1, 'company-alpha', '2025-01-01T00:00:00.000Z')[0];
    const later = makePaidAds(1, 'company-alpha', '2026-03-03T00:00:00.000Z')[0];
    await repository.upsertPaidAds([first]);
    await repository.upsertPaidAds([later]);

    const snapshot = await repository.getDashboardSnapshot();
    expect(snapshot.paidAds[0].fields).toMatchObject({'Observed • First Observed At': '2025-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});
  });

  it('uses chronological min/max paid timestamps for older retries in production and fixture', async () => {
    const production = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const incoming = makePaidAds(1, 'company-alpha', '2024-01-01T00:00:00.000Z')[0];
    incoming.calculated.paidAdId = 'ad-existing';
    await production.upsertPaidAds([incoming]);
    expect(paidAdPatchBodies[0].records[0].fields).toMatchObject({'Observed • First Observed At': '2024-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});

    const fixture = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    const newer = makePaidAds(1, 'company-alpha', '2026-03-03T00:00:00.000Z')[0];
    const older = makePaidAds(1, 'company-alpha', '2024-01-01T00:00:00.000Z')[0];
    await fixture.upsertPaidAds([newer]);
    await fixture.upsertPaidAds([older]);
    await fixture.upsertPaidAds([older]);
    expect((await fixture.getDashboardSnapshot()).paidAds[0].fields).toMatchObject({'Observed • First Observed At': '2024-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});
  });

  it('ignores invalid stored paid-ad bounds and sets both bounds from a valid incoming timestamp', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const incoming = makePaidAds(1, 'company-alpha', '2026-03-03T00:00:00.000Z')[0];
    incoming.calculated.paidAdId = 'ad-invalid-stored';

    await expect(repository.upsertPaidAds([incoming])).resolves.toMatchObject({succeeded: 1, failed: 0});
    expect(paidAdPatchBodies[0].records[0].fields).toMatchObject({'Observed • First Observed At': '2026-03-03T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});
  });

  it('escapes formula literals without interpolating newlines, quotes, or backslashes', () => {
    expect(escapeFormulaLiteral("a'\\b\nnext")).toBe("a\\'\\\\b\\nnext");
  });
});
