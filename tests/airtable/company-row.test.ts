import {describe, expect, it} from 'vitest';
import {COMPANY_ROW_FIELDS, MAX_AIRTABLE_JSON_BYTES, parseCompanyRecord, toBattlecardFields, toCompanyFields, toReviewFields, type PublishedBattlecard, type ReviewCandidate} from '@/lib/airtable/company-row';
import type {CompanyWrite} from '@/lib/airtable/types';
import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';
import type {CandidateClaim} from '@/lib/schemas/insight-candidate';

const at = '2026-03-03T00:00:00.000Z';

const company: CompanyWrite = {
  companyId: 'company-alpha',
  identity: {canonicalDomain: 'alpha.example', apolloAccountId: 'acct-alpha', apolloRecordId: 'rec-alpha'},
  observed: {
    classification: 'observed', source: 'semrush', observedAt: at, database: 'us', rawRef: 'apify://dataset/sanitized-alpha',
    domain: 'alpha.example', authorityScore: 20, backlinks: 100, referringDomains: 10, followBacklinks: 60, noFollowBacklinks: 40,
    organicTraffic: 200, totalTraffic: 240, organicKeywords: 12, organicTrafficCostUsd: 10, paidTraffic: 0, paidKeywords: 0, paidTrafficCostUsd: 0,
    aiVisibility: 1, aiVisibilityBenchmark: 2, aiMentions: 3, aiCitedPages: 4, topCountry: 'us', topCountryTraffic: 100,
    mozDomainAuthorityRaw: '1.6k', mozSpamScoreRaw: '3%', organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiByLlm: [], aiTopCitedSources: [{domain: 'source.example', mentions: 7}], rawSerpCodes: [999], mozTopPagesObserved: [{url: 'alpha.example', pageAuthority: 2}],
  },
  calculated: {
    classification: 'calculated', inputs: ['example'], calculatedAt: at,
    organicTraffic30DayMovement: 0.1, organicTraffic12MonthMovement: 0.2, nonBrandShare: 0.3, aiBenchmarkGap: -1, trackedSetTrafficShare: 0.4,
    organicCompetitors: [], paidCompetitors: [], aiCountries: [], aiCountriesObservedCount: 0, mozDomainAuthority: {raw: '1.6k', normalized: 1600}, mozSpamScore: {raw: '3%', normalized: 0.03}, mozTopPages: [], mozTopPagesObservedCount: 1, topKeywordSampleCount: 1, compactOrganicTrend: [], landingPagePortfolio: [], paidActivityPresent: false,
  },
  qualityIssues: Array.from({length: 30}, (_, index) => ({code: 'invalid_trend_date' as const, message: 'not persisted', sourcePath: `organic[${index}]`, summary: `bad\nsummary ${index}`})),
};

function keyword(index: number, traffic: number | null = index): CuratedKeyword {
  return {
    observed: {classification: 'observed', source: 'semrush', observedAt: at, database: 'us', keyword: `topic ${index}`, landingUrl: `https://alpha.example/${index}`, position: 1, previousPosition: null, positionDifference: null, volume: 10, cpcUsd: null, keywordDifficulty: null, competition: null, traffic, trafficSharePct: null, trafficCostUsd: null, intents: ['informational'], rawSerpCodes: [], results: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: at, companyId: 'company-alpha', keywordId: `company-alpha\u0000topic ${index}\u0000https://alpha.example/${index}`, normalizedLandingUrl: `https://alpha.example/${index}`},
  };
}

function paidAd(id: string, observedAt = at, description = 'Sanitized description'): CuratedPaidAd {
  return {
    observed: {classification: 'observed', source: 'semrush', observedAt, database: 'us', keyword: id, title: 'Sanitized title', description, visibleUrl: 'alpha.example', landingUrl: `https://alpha.example/${id}`, position: 1, previousPosition: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: observedAt, companyId: 'company-alpha', paidAdId: id, normalizedLandingUrl: `https://alpha.example/${id}`},
  };
}

const observedClaim: CandidateClaim = {claimId: 'claim-observed', conclusion: 'Observed traffic rose.', classification: 'observed', confidence: 'high', confidenceReason: 'Direct metric.', evidenceRefs: ['company:company-alpha:metric:organic_traffic']};
const inferredClaim: CandidateClaim = {claimId: 'claim-inferred', conclusion: 'Prioritize a response.', classification: 'inferred', confidence: 'medium', confidenceReason: 'Cross-signal inference.', evidenceRefs: ['company:company-alpha:metric:organic_traffic', 'keyword:k1']};
const provenance = {evidenceFingerprint: 'a'.repeat(64), agentHarness: 'test', model: 'test-model', skillVersion: '1.0.0', workflowVersion: '1.0.0', runId: 'run', generatedAt: '2026-08-18T12:00:00.000Z'};
const battlecard: PublishedBattlecard = {insightId: 'insight-1', observedThemes: [observedClaim], inferredClaims: [inferredClaim], recommendations: [], overallConfidence: 'medium', ...provenance};
const candidate: ReviewCandidate = {observedThemes: [observedClaim], inferredClaims: [], recommendations: [], overallConfidence: 'high', reviewReasons: ['suspicious_provider_data', 'conflicting_sources'], ...provenance};

function row(fields: Record<string, unknown>) {
  return parseCompanyRecord({id: 'rec-alpha', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example', ...fields} as never});
}

describe('Companies row codec', () => {
  it('maps observed and calculated company fields to visibly separate namespaces without raw records', () => {
    const fields = toCompanyFields(company);

    expect(fields).toMatchObject({
      'Identity • Company ID': 'company-alpha',
      'Observed • Organic Traffic': 200,
      'Calculated • Non-brand Share': 0.3,
      'Observed • Moz Domain Authority Raw': '1.6k',
      'Calculated • Moz Domain Authority': 1600,
      'Observed • AI Top Cited Sources Observed Count': 1,
    });
    expect(JSON.parse(fields['Observed • AI Top Cited Sources JSON'] as string)).toEqual([{domain: 'source.example', mentions: 7}]);
    expect(JSON.parse(fields['Quality • Issues JSON'] as string)).toHaveLength(25);
    expect(JSON.stringify(fields)).not.toContain('not persisted');
    expect(fields).not.toHaveProperty(COMPANY_ROW_FIELDS.keywords);
    expect(fields).not.toHaveProperty(COMPANY_ROW_FIELDS.paidAds);
  });

  it('uses field-specific cardinality and byte bounds without truncating JSON text', () => {
    const oversized = structuredClone(company);
    oversized.observed.organicCompetitors = Array.from({length: 11}, (_, index) => ({domain: `competitor-${index}.example`, commonKeywords: null, competitionLevel: null, organicKeywords: null, organicTraffic: null, organicTrafficCostUsd: null, paidKeywords: null, paidTraffic: null, paidTrafficCostUsd: null, serpFeatureKeywords: null, serpFeatureTraffic: null, totalTraffic: null, totalTrafficCostUsd: null}));
    oversized.observed.aiByLlm = Array.from({length: 5}, (_, index) => ({llm: `model-${index}`, llmCode: `m-${index}`, mentions: 1, selfMentions: 0, citedPages: 1}));
    oversized.observed.rawSerpCodes = Array.from({length: 100}, () => 'x'.repeat(2_000));
    oversized.calculated.compactOrganicTrend = Array.from({length: 30}, (_, index) => ({date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`, organicTraffic: index, organicKeywords: index, organicTrafficCostUsd: index, brandedTraffic: index, nonBrandTraffic: index, paidTraffic: index, paidKeywords: index, paidTrafficCostUsd: index, serpFeatureTraffic: index}));
    const fields = toCompanyFields(oversized);

    expect(JSON.parse(fields['Observed • Organic Competitors JSON'] as string)).toHaveLength(10);
    expect(fields['Observed • Organic Competitors Observed Count']).toBe(11);
    expect(JSON.parse(fields['Observed • AI by LLM JSON'] as string)).toHaveLength(4);
    expect(JSON.parse(fields['Calculated • Compact Organic Trend JSON'] as string)).toHaveLength(24);
    const serpJsonBytes = new TextEncoder().encode(fields['Observed • SERP Codes JSON'] as string).byteLength;
    expect(serpJsonBytes).toBeGreaterThan(0);
    expect(serpJsonBytes).toBeLessThanOrEqual(MAX_AIRTABLE_JSON_BYTES);
  });

  it('round-trips keywords, paid ads, the battlecard and the review candidate as typed domain objects', () => {
    const fields = {
      ...toCompanyFields({...company, keywords: [keyword(1), keyword(2)], paidAds: [paidAd('ad-1')]}),
      ...toBattlecardFields(battlecard),
      ...toReviewFields({status: 'needs_review', candidate, reviewerNotes: 'Check the source.', reviewerIdentity: 'reviewer@example.test', reviewedAt: at}),
    };
    const parsed = parseCompanyRecord({id: 'rec-alpha', fields});

    expect(parsed.recordId).toBe('rec-alpha');
    expect(parsed.storageIssues).toEqual([]);
    expect(parsed.keywords).toEqual([keyword(2), keyword(1)]);
    expect(parsed.keywordsObservedAt).toBe(at);
    expect(parsed.paidAds).toEqual([{observed: {...paidAd('ad-1').observed, firstObservedAt: at, lastObservedAt: at}, calculated: paidAd('ad-1').calculated}]);
    expect(parsed.battlecard).toEqual(battlecard);
    expect(parsed.review).toEqual({status: 'needs_review', candidate: {...candidate, reviewReasons: ['conflicting_sources', 'suspicious_provider_data']}, reviewerNotes: 'Check the source.', reviewerIdentity: 'reviewer@example.test', reviewedAt: at});
    expect(parsed.fields).toMatchObject({'Observed • Organic Traffic': 200});
    for (const owned of Object.values(COMPANY_ROW_FIELDS)) expect(parsed.fields).not.toHaveProperty(owned);
    expect(JSON.parse(fields[COMPANY_ROW_FIELDS.keywords] as string)[0]).not.toHaveProperty('Observed • Keyword');
  });

  it('keeps the highest-traffic keywords and paid ads within caps and records truncation with retained and original counts', () => {
    const keywords = Array.from({length: 75}, (_, index) => keyword(index));
    const ads = Array.from({length: 45}, (_, index) => paidAd(`ad-${String(index).padStart(2, '0')}`));
    const fields = toCompanyFields({...company, qualityIssues: [], keywords, paidAds: ads});
    const parsed = parseCompanyRecord({id: 'rec-alpha', fields});

    expect(parsed.keywords).toHaveLength(60);
    expect(parsed.keywords[0].observed.traffic).toBe(74);
    expect(parsed.keywords.at(-1)!.observed.traffic).toBe(15);
    expect(parsed.paidAds).toHaveLength(40);
    expect(new TextEncoder().encode(fields[COMPANY_ROW_FIELDS.keywords] as string).byteLength).toBeLessThanOrEqual(MAX_AIRTABLE_JSON_BYTES);
    expect(JSON.parse(fields['Quality • Issues JSON'] as string)).toEqual([
      {code: 'stored_snapshot_truncated', sourcePath: 'storage.keywords', summary: 'retained 60 of 75'},
      {code: 'stored_snapshot_truncated', sourcePath: 'storage.paid_ads', summary: 'retained 40 of 45'},
    ]);
  });

  it('drops whole tail items to stay under the field byte budget', () => {
    const ads = Array.from({length: 30}, (_, index) => paidAd(`ad-${index}`, at, 'd'.repeat(4_000)));
    const fields = toCompanyFields({...company, qualityIssues: [], paidAds: ads});
    const stored = fields[COMPANY_ROW_FIELDS.paidAds] as string;

    expect(new TextEncoder().encode(stored).byteLength).toBeLessThanOrEqual(MAX_AIRTABLE_JSON_BYTES);
    expect(JSON.parse(stored).length).toBeLessThan(30);
    expect(JSON.parse(fields['Quality • Issues JSON'] as string)[0]).toMatchObject({code: 'stored_snapshot_truncated', sourcePath: 'storage.paid_ads'});
  });

  it('turns malformed JSON into a data-quality issue and renders that section as missing', () => {
    const parsed = row({
      [COMPANY_ROW_FIELDS.keywords]: '[{"observed":', [COMPANY_ROW_FIELDS.paidAds]: JSON.stringify([{observed: {}, calculated: {}}]),
      [COMPANY_ROW_FIELDS.battlecard]: JSON.stringify({observedThemes: [{...observedClaim, classification: 'inferred'}], inferredClaims: [], recommendations: []}),
      [COMPANY_ROW_FIELDS.reviewCandidate]: 42, [COMPANY_ROW_FIELDS.reviewStatus]: 'needs_review',
      'Observed • Organic Traffic': 200,
    });

    expect(parsed.keywords).toEqual([]);
    expect(parsed.paidAds).toEqual([]);
    expect(parsed.battlecard).toBeUndefined();
    expect(parsed.review).toEqual({status: 'needs_review'});
    expect(parsed.fields['Observed • Organic Traffic']).toBe(200);
    expect(parsed.storageIssues.map((issue) => [issue.code, issue.sourcePath])).toEqual([
      ['unreadable_stored_json', 'storage.keywords'], ['unreadable_stored_json', 'storage.paid_ads'], ['unreadable_stored_json', 'storage.battlecard'], ['unreadable_stored_json', 'storage.review'],
    ]);
  });

  it('treats a battlecard whose provenance fields are missing as unreadable rather than current', () => {
    const fields = toBattlecardFields(battlecard);
    delete fields[COMPANY_ROW_FIELDS.battlecardFingerprint];
    const parsed = row(fields);

    expect(parsed.battlecard).toBeUndefined();
    expect(parsed.storageIssues).toMatchObject([{code: 'unreadable_stored_json', sourcePath: 'storage.battlecard'}]);
  });

  it('keeps missing sections missing without inventing issues or empty records', () => {
    const parsed = row({});

    expect(parsed).toEqual({recordId: 'rec-alpha', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example'}, keywords: [], paidAds: [], storageIssues: []});
    expect(parsed).not.toHaveProperty('battlecard');
    expect(parsed).not.toHaveProperty('review');
    expect(parsed).not.toHaveProperty('keywordsObservedAt');
  });

  it('rejects an invalid human-edited review status without dropping the stored candidate', () => {
    const parsed = row({...toReviewFields({status: 'needs_review', candidate}), [COMPANY_ROW_FIELDS.reviewStatus]: 'ship it'});

    expect(parsed.review?.status).toBeUndefined();
    expect(parsed.review?.candidate?.runId).toBe('run');
    expect(parsed.storageIssues).toMatchObject([{code: 'unreadable_stored_json', sourcePath: 'storage.review'}]);
  });

  it('rejects battlecards that cannot be stored whole without exposing their content', () => {
    const tooManyRefs = {...observedClaim, evidenceRefs: Array.from({length: 101}, (_, index) => `ref-${index}`)};
    expect(() => toBattlecardFields({...battlecard, observedThemes: [tooManyRefs]})).toThrow('claim evidence refs exceed Airtable cap');
    expect(() => toBattlecardFields({...battlecard, observedThemes: [{...observedClaim, evidenceRefs: []}]})).toThrow('claim requires at least one evidence ref');
    expect(() => toBattlecardFields({...battlecard, observedThemes: Array.from({length: 101}, (_, index) => ({...observedClaim, claimId: `claim-${index}`}))})).toThrow('claim collection exceeds Airtable cap');
    expect(() => toBattlecardFields({...battlecard, observedThemes: [inferredClaim]})).toThrow('observed claim collection contains another classification');

    const privateRef = `private-evidence-ref-${'x'.repeat(MAX_AIRTABLE_JSON_BYTES)}`;
    for (const map of [() => toBattlecardFields({...battlecard, observedThemes: [{...observedClaim, evidenceRefs: [privateRef]}]}), () => toReviewFields({status: 'needs_review', candidate: {...candidate, observedThemes: [{...observedClaim, evidenceRefs: [privateRef]}]}})]) {
      let thrown: unknown;
      try { map(); } catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(TypeError);
      expect(String(thrown)).toContain('cannot retain evidence within Airtable JSON byte budget');
      expect(String(thrown)).not.toContain('private-evidence-ref');
    }
  });

  it('persists accepted claim conclusion and confidence-reason text exactly', () => {
    const exact = {...observedClaim, conclusion: 'Measured  traffic.', confidenceReason: 'Direct  current source.'};
    const parsed = row(toBattlecardFields({...battlecard, observedThemes: [exact]}));
    expect(parsed.battlecard?.observedThemes[0]).toEqual(exact);
  });

  it('rejects keywords or paid ads that belong to another company', () => {
    const foreignKeyword = keyword(1); foreignKeyword.calculated.companyId = 'company-beta';
    const foreignAd = paidAd('ad-1'); foreignAd.calculated.companyId = 'company-beta';
    expect(() => toCompanyFields({...company, keywords: [foreignKeyword]})).toThrow('keyword_company_mismatch');
    expect(() => toCompanyFields({...company, paidAds: [foreignAd]})).toThrow('paid_ad_company_mismatch');
    expect(() => toCompanyFields({...company, paidAds: [paidAd('ad-1'), paidAd('ad-1')]})).toThrow('duplicate_incoming_paid_ad_identity');
  });
});
