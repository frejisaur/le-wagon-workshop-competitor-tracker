import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';
import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {AirtableClient} from '@/lib/airtable/client';
import {AirtableCompetitorRepository, escapeFormulaLiteral} from '@/lib/airtable/repository';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {COMPANY_ROW_FIELDS} from '@/lib/airtable/company-row';
import type {CompanyWrite, InsightWireInput, ReviewWireInput} from '@/lib/airtable/types';
import type {CuratedKeyword} from '@/lib/domain/metrics';

const endpoint = 'https://airtable.test';
const requestBodies: Array<{records: unknown[]}> = [];
let rateLimitedRequestCount = 0;
let failCompanyWrites = false;
let companyUpdateCount = 0;
const companyPatchBodies: Array<{records: Array<{id?: string; fields: Record<string, unknown>}>}> = [];
let companyLookupCount = 0;
const systemPatchBodies: Array<{records: Array<{fields: Record<string, unknown>}>}> = [];
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
    const body = await request.json() as {records: Array<{id?: string; fields: Record<string, unknown>}>};
    companyPatchBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-update-${index}`, fields: {}}))});
  }),
  http.get(`${endpoint}/v0/base/System`, () => HttpResponse.json({records: [{id: 'rec-system', fields: {'Identity • System ID': 'system'}}]})),
  http.patch(`${endpoint}/v0/base/System`, async ({request}) => {
    const body = await request.json() as {records: Array<{fields: Record<string, unknown>}>};
    systemPatchBodies.push(body);
    return HttpResponse.json({records: body.records.map((_, index) => ({id: `rec-system-${index}`, fields: {}}))});
  }),
);

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => { server.resetHandlers(); requestBodies.length = 0; rateLimitedRequestCount = 0; failCompanyWrites = false; companyUpdateCount = 0; companyPatchBodies.length = 0; companyLookupCount = 0; systemPatchBodies.length = 0; });
afterAll(() => server.close());

function makeCompanies(count: number): CompanyWrite[] {
  return Array.from({length: count}, (_, index) => ({
    companyId: `company-${index}`, identity: {canonicalDomain: `company-${index}.example`, apolloAccountId: `batch-acct-${index}`, apolloRecordId: `rec-${index}`}, qualityIssues: [],
    observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', domain: `company-${index}.example`, authorityScore: null, backlinks: null, referringDomains: null, followBacklinks: null, noFollowBacklinks: null, organicTraffic: null, totalTraffic: null, organicKeywords: null, organicTrafficCostUsd: null, paidTraffic: null, paidKeywords: null, paidTrafficCostUsd: null, aiVisibility: null, aiVisibilityBenchmark: null, aiMentions: null, aiCitedPages: null, topCountry: null, topCountryTraffic: null, mozDomainAuthorityRaw: null, mozSpamScoreRaw: null, organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiByLlm: [], aiTopCitedSources: [], rawSerpCodes: [], mozTopPagesObserved: []},
    calculated: {classification: 'calculated', inputs: [], calculatedAt: '2026-03-03T00:00:00.000Z', organicTraffic30DayMovement: null, organicTraffic12MonthMovement: null, nonBrandShare: null, aiBenchmarkGap: null, trackedSetTrafficShare: null, organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiCountriesObservedCount: 0, mozDomainAuthority: {raw: null, normalized: null}, mozSpamScore: {raw: null, normalized: null}, mozTopPages: [], mozTopPagesObservedCount: 0, topKeywordSampleCount: 0, compactOrganicTrend: [], landingPagePortfolio: [], paidActivityPresent: null},
  }));
}

function makeKeyword(): CuratedKeyword {
  return {
    observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', keyword: 'new', landingUrl: 'https://alpha.example/new', position: 1, previousPosition: null, positionDifference: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null, intents: [], rawSerpCodes: [], results: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: '2026-03-03T00:00:00.000Z', companyId: 'company-alpha', keywordId: 'company-alpha\u0000new\u0000https://alpha.example/new', normalizedLandingUrl: 'https://alpha.example/new'},
  };
}

const themes = [{claimId: 'traffic', conclusion: 'Traffic is measured.', classification: 'observed' as const, confidence: 'high' as const, confidenceReason: 'Current metric.', evidenceRefs: ['company:company-alpha:metric:organic_traffic']}];
const provenance = {agentHarness: 'test', model: 'test', skillVersion: '1.0.0', evidenceFingerprint: 'a'.repeat(64), workflowVersion: '1.0.0', runId: 'run', generatedAt: '2026-08-18T12:00:00.000Z'};

function insight(insightId: string): InsightWireInput {
  return {insightId, companyId: 'company-alpha', observedThemes: themes, inferredClaims: [], recommendations: [], overallConfidence: 'high', ...provenance};
}

function review(status: ReviewWireInput['status'], reviewer: Partial<ReviewWireInput> = {}): ReviewWireInput {
  return {companyId: 'company-alpha', status, candidate: {observedThemes: themes, inferredClaims: [], recommendations: [], overallConfidence: 'high', reviewReasons: ['conflicting_sources'], ...provenance}, ...reviewer};
}

describe('AirtableCompetitorRepository', () => {
  it('reads only the two fixed serving tables', async () => {
    const tables: string[] = [];
    const client = {list: async (table: string) => { tables.push(table); return []; }} as unknown as AirtableClient;

    await expect(new AirtableCompetitorRepository(client).getDashboardSnapshot()).resolves.toEqual({companies: [], system: null});
    expect(tables.sort()).toEqual(['Companies', 'System']);
  });

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

  it('sends explicit null fingerprint invalidation and a due-now enrichment timestamp in a company PATCH', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const incoming = makeCompanies(1)[0] as CompanyWrite & {nextAgentEnrichmentDueAt: string};
    incoming.companyId = 'company-alpha';
    incoming.identity.canonicalDomain = 'alpha.example';
    incoming.identity.apolloAccountId = '';
    incoming.evidenceFingerprint = null as never;
    incoming.nextAgentEnrichmentDueAt = '2026-08-18T00:00:00.000Z';

    await expect(repository.upsertCompanies([incoming])).resolves.toMatchObject({succeeded: 1, failed: 0});
    expect(companyPatchBodies[0].records[0].fields).toMatchObject({
      'Workflow • Evidence Fingerprint': null,
      'Workflow • Next Insight Due At': '2026-08-18T00:00:00.000Z',
    });
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

  it('keeps exactly one current battlecard on the company row while preserving the insight ID as provenance', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    await expect(repository.upsertPublishedInsight(insight('insight-first'))).resolves.toMatchObject({succeeded: 1, failed: 0, results: [{recordId: 'rec-alpha'}]});
    await expect(repository.upsertPublishedInsight(insight('insight-replacement'))).resolves.toMatchObject({succeeded: 1, failed: 0, results: [{recordId: 'rec-alpha'}]});
    const snapshot = await repository.getDashboardSnapshot();

    expect(snapshot.companies).toHaveLength(2);
    expect(snapshot.companies[0].battlecard).toMatchObject({insightId: 'insight-replacement', observedThemes: themes});
    expect(snapshot.companies[0].fields['Observed • Organic Traffic']).toBe(200);
    await expect(repository.upsertPublishedInsight({...insight('insight-x'), companyId: 'company-missing'})).resolves.toMatchObject({failed: 1, results: [{error: 'company_missing'}]});
  });

  it('PATCHes battlecard and review fields onto the existing company row in production', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    await expect(repository.upsertPublishedInsight(insight('insight-replacement'))).resolves.toMatchObject({succeeded: 1, failed: 0});
    await expect(repository.upsertReview(review('needs_review'))).resolves.toMatchObject({succeeded: 1, failed: 0});

    expect(requestBodies).toEqual([]);
    expect(companyPatchBodies.map((body) => body.records[0].id)).toEqual(['rec-company-alpha', 'rec-company-alpha']);
    expect(companyPatchBodies[0].records[0].fields).toMatchObject({[COMPANY_ROW_FIELDS.battlecard]: expect.stringContaining('Traffic is measured.'), [COMPANY_ROW_FIELDS.battlecardId]: 'insight-replacement', [COMPANY_ROW_FIELDS.battlecardFingerprint]: 'a'.repeat(64)});
    expect(companyPatchBodies[1].records[0].fields).toMatchObject({[COMPANY_ROW_FIELDS.reviewStatus]: 'needs_review', [COMPANY_ROW_FIELDS.reviewCandidate]: expect.stringContaining('conflicting_sources')});
    // Omitted reviewer fields are left out of the PATCH so human edits in Airtable survive.
    expect(companyPatchBodies[1].records[0].fields).not.toHaveProperty(COMPANY_ROW_FIELDS.reviewNotes);
  });

  it('preserves reviewer edits in the fixture review state unless explicitly replaced', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    await repository.upsertReview(review('approved', {reviewerNotes: 'Looks right.', reviewerIdentity: 'reviewer@example.test', reviewedAt: '2026-08-19T00:00:00.000Z'}));
    await repository.upsertReview(review('published'));

    expect((await repository.getDashboardSnapshot()).companies[0].review).toMatchObject({status: 'published', reviewerNotes: 'Looks right.', reviewerIdentity: 'reviewer@example.test', candidate: {runId: 'run'}});
  });

  it('omits an unknown last-successful timestamp from the production System PATCH', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));

    await expect(repository.updateSystem({systemId: 'system', status: 'failed', processedCompanies: 0, succeededCompanies: 0, failedCompanies: 0})).resolves.toMatchObject({succeeded: 1, failed: 0});

    expect(systemPatchBodies[0].records[0].fields).not.toHaveProperty('Workflow • Last Successful Run At');
  });

  it('returns per-record failures without losing successfully written record results', async () => {
    failCompanyWrites = true;
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'secret-token', endpoint, maxAttempts: 1}));
    const result = await repository.upsertCompanies(makeCompanies(1));

    expect(result).toMatchObject({succeeded: 0, failed: 1});
    expect(result.results[0].error).not.toContain('secret-token');
  });

  it('writes a company with its keyword snapshot as one row write', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const incoming = makeCompanies(1)[0];
    incoming.companyId = 'company-alpha';
    incoming.identity = {canonicalDomain: 'alpha.example', apolloAccountId: '', apolloRecordId: ''};
    incoming.keywords = [makeKeyword()];

    await expect(repository.upsertCompanies([incoming])).resolves.toMatchObject({succeeded: 1, failed: 0});
    expect(companyUpdateCount).toBe(1);
    expect(JSON.parse(companyPatchBodies[0].records[0].fields[COMPANY_ROW_FIELDS.keywords] as string)).toEqual([makeKeyword()]);
    expect(companyPatchBodies[0].records[0].fields[COMPANY_ROW_FIELDS.keywordsAt]).toBe('2026-03-03T00:00:00.000Z');
  });

  it('refreshes one company with a single PATCH and never creates a row', async () => {
    const repository = new AirtableCompetitorRepository(new AirtableClient({baseId: 'base', apiToken: 'token', endpoint, jitter: () => 0}));
    const incoming = makeCompanies(1)[0];
    incoming.companyId = 'company-alpha';
    incoming.keywords = [makeKeyword()];

    await expect(repository.writeCompanyEvidence(incoming, (row) => `fingerprint-of-${row.keywords.length}`)).resolves.toMatchObject({succeeded: 1, failed: 0});
    expect(companyLookupCount).toBe(1);
    expect(companyUpdateCount).toBe(1);
    expect(requestBodies).toEqual([]);
    expect(companyPatchBodies[0].records[0].fields).toMatchObject({'Workflow • Evidence Fingerprint': 'fingerprint-of-1'});

    const missing = {...incoming, companyId: 'company-missing'};
    await expect(repository.writeCompanyEvidence(missing, () => 'unused')).resolves.toMatchObject({succeeded: 0, failed: 1, results: [{identity: 'company-missing', error: 'company_missing'}]});
    expect(companyUpdateCount).toBe(1);
  });

  it('escapes formula literals without interpolating newlines, quotes, or backslashes', () => {
    expect(escapeFormulaLiteral("a'\\b\nnext")).toBe("a\\'\\\\b\\nnext");
  });
});
