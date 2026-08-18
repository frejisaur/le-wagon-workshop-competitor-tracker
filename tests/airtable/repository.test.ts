import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {AirtableClient} from '@/lib/airtable/client';
import {AirtableCompetitorRepository, escapeFormulaLiteral} from '@/lib/airtable/repository';
import type {CompanyWrite} from '@/lib/airtable/types';
import type {CuratedKeyword} from '@/lib/domain/metrics';

const endpoint = 'https://airtable.test';
const requestBodies: Array<{records: unknown[]}> = [];
let rateLimitedRequestCount = 0;
let failCompanyWrites = false;
let deletedKeywordIds: string[] = [];
const server = setupServer(
  http.get(`${endpoint}/v0/base/Companies`, ({request}) => {
    const formula = new URL(request.url).searchParams.get('filterByFormula') ?? '';
    if (formula.includes("'acct-1'")) return HttpResponse.json({records: [{id: 'rec-company-existing', fields: {'Identity • Company ID': 'company-existing', 'Observed • Apollo Account ID': 'acct-1', 'Identity • Canonical Domain': 'existing.example'}}]});
    return HttpResponse.json({records: []});
  }),
  http.post(`${endpoint}/v0/base/Companies`, async ({request}) => {
    const body = await request.json() as {records: unknown[]};
    if (failCompanyWrites) return HttpResponse.json({error: {type: 'UNPROCESSABLE_ENTITY'}}, {status: 422});
    if (rateLimitedRequestCount++ === 0) return HttpResponse.json({error: {type: 'TOO_MANY_REQUESTS'}}, {status: 429, headers: {'Retry-After': '0'}});
    requestBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-${index}`, fields: {}}))});
  }),
  http.get(`${endpoint}/v0/base/Keywords`, () => HttpResponse.json({records: [{id: 'rec-old-keyword', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Keyword ID': 'company-alpha\u0000old\u0000https://alpha.example/old'}}]})),
  http.post(`${endpoint}/v0/base/Keywords`, async ({request}) => {
    const body = await request.json() as {records: unknown[]};
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-keyword-${index}`, fields: {}}))});
  }),
  http.delete(`${endpoint}/v0/base/Keywords`, ({request}) => {
    deletedKeywordIds = new URL(request.url).searchParams.getAll('records[]');
    return HttpResponse.json({records: deletedKeywordIds.map((id) => ({id, fields: {}}))});
  }),
);

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => { server.resetHandlers(); requestBodies.length = 0; rateLimitedRequestCount = 0; failCompanyWrites = false; deletedKeywordIds = []; });
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

describe('AirtableCompetitorRepository', () => {
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
  });

  it('escapes formula literals without interpolating newlines, quotes, or backslashes', () => {
    expect(escapeFormulaLiteral("a'\\b\nnext")).toBe("a\\'\\\\b\\nnext");
  });
});
