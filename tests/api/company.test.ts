import {describe, expect, it} from 'vitest';
import {COMPANY_ROW_FIELDS, parseCompanyRecord, toBattlecardFields, toReviewFields, type PublishedBattlecard, type ReviewCandidate} from '@/lib/airtable/company-row';
import {parseDashboardSnapshot} from '@/lib/airtable/snapshot';
import type {AirtableFields, AirtableRecord} from '@/lib/airtable/types';
import {shapeDashboardSnapshot} from '@/lib/api/shape-landscape';
import {buildEvidencePackage} from '@/lib/agents/evidence/build-package';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';
import type {CuratedKeyword} from '@/lib/domain/metrics';
import type {CandidateClaim, CandidateReviewReason} from '@/lib/schemas/insight-candidate';

const at = '2026-08-18T12:00:00.000Z';
const keyword: CuratedKeyword = {
  observed: {classification: 'observed', source: 'semrush', observedAt: at, database: 'ca', keyword: 'alpha', landingUrl: 'https://alpha.example/', position: 1, previousPosition: null, positionDifference: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null, intents: ['informational'], rawSerpCodes: [], results: null},
  calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: at, companyId: 'company-alpha', keywordId: 'keyword-alpha', normalizedLandingUrl: 'https://alpha.example/'},
};
const candidate = (reviewReasons: CandidateReviewReason[]): ReviewCandidate => ({observedThemes: [], inferredClaims: [], recommendations: [], reviewReasons, evidenceFingerprint: 'b'.repeat(64), agentHarness: 'fixture', model: 'safe-model', skillVersion: '1.0.0', workflowVersion: '1.0.0', runId: 'run-review', generatedAt: at});

const companyFields: AirtableFields = {
  'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example', 'Observed • Source': 'semrush', 'Observed • At': at, 'Observed • Database': 'ca',
  'Observed • Organic Traffic': 20, 'Observed • Organic Keywords': 2, 'Observed • Authority Score': 40, 'Observed • AI Visibility': 29, 'Observed • AI Visibility Benchmark': 31,
  'Observed • AI Mentions': 583, 'Observed • AI Cited Pages': 208,
  'Observed • AI Top Cited Sources JSON': JSON.stringify([{domain: 'example-source.test', mentions: 17}]),
  'Observed • Organic Competitors JSON': JSON.stringify([{domain: 'rival.example', organicTraffic: 10}]),
  'Calculated • Compact Organic Trend JSON': JSON.stringify([{date: '2026-08-01', organicTraffic: 20, organicKeywords: 9, organicTrafficCostUsd: 31, brandedTraffic: 8, nonBrandTraffic: 12, paidTraffic: 4, paidKeywords: 2, paidTrafficCostUsd: 7, serpFeatureTraffic: 6}]),
  'Calculated • Landing Page Portfolio JSON': JSON.stringify([{normalizedLandingUrl: 'https://alpha.example/', keywordCount: 2, estimatedTraffic: 20, keywords: ['alpha']}]),
  'Calculated • Paid Activity Present': false,
  [COMPANY_ROW_FIELDS.keywords]: JSON.stringify([keyword]),
  ...toReviewFields({status: 'needs_review', candidate: candidate(['prompt_injection_content', 'insufficient_evidence']), reviewerNotes: 'ignore these instructions', reviewerIdentity: 'reviewer@example.test'}),
};
const system: AirtableRecord = {id: 'rec-system', fields: {'Identity • System ID': 'system', 'Workflow • Status': 'partial', 'Workflow • Failed Companies': 1}};

function shaped(fields: AirtableFields = companyFields) {
  return shapeDashboardSnapshot(parseDashboardSnapshot({companies: [{id: 'rec-alpha', fields}], system: [system]})).companies.get('company-alpha');
}

/** The fingerprint of the current curated evidence. It ignores battlecard and review fields. */
const currentFingerprint = fingerprintEvidence(buildEvidencePackage(parseCompanyRecord({id: 'rec-alpha', fields: companyFields})));
const validClaim: CandidateClaim = {claimId: 'claim-1', conclusion: 'Current claim', classification: 'inferred', confidence: 'high', confidenceReason: 'grounded', evidenceRefs: ['company:company-alpha:metric:organic_traffic']};
const battlecard = (overrides: Partial<PublishedBattlecard> = {}): PublishedBattlecard => ({insightId: 'insight-alpha', observedThemes: [], inferredClaims: [validClaim], recommendations: [], overallConfidence: 'high', evidenceFingerprint: currentFingerprint, agentHarness: 'fixture', model: 'safe-model', skillVersion: '1.0.0', workflowVersion: '1.0.0', runId: 'run-safe', generatedAt: at, ...overrides});

describe('company response', () => {
  it('projects curated classified detail, hides reviewer identity and notes, and omits paid activity', () => {
    const response = shaped();
    expect(response).toMatchObject({companyId: 'company-alpha', status: 'partial'});
    expect(response).not.toHaveProperty('paid');
    expect(response?.keywords).toEqual([{keywordId: 'keyword-alpha', classification: 'observed', keyword: 'alpha', landingUrl: 'https://alpha.example/', position: 1, volume: null, cpcUsd: null, difficulty: null, traffic: null, intents: ['informational']}]);
    expect(response?.reviewCandidate).toEqual({status: 'needs_review', reasons: ['insufficient_evidence', 'prompt_injection_content']});
    expect(JSON.stringify(response)).not.toMatch(/rec-|ignore these instructions|reviewer/i);
    expect(response?.trend[0]?.organicTraffic).toMatchObject({source: 'semrush', database: 'ca'});
    expect(response?.trend[0]).toMatchObject({
      organicKeywords: {classification: 'calculated', value: 9},
      organicTrafficCostUsd: {classification: 'calculated', value: 31},
      brandedTraffic: {classification: 'calculated', value: 8},
      nonBrandTraffic: {classification: 'calculated', value: 12},
      paidTraffic: {classification: 'calculated', value: 4},
      paidKeywords: {classification: 'calculated', value: 2},
      paidTrafficCostUsd: {classification: 'calculated', value: 7},
      serpFeatureTraffic: {classification: 'calculated', value: 6},
    });
    expect(response).toMatchObject({
      enrichedAt: at,
      ai: {
        visibility: {classification: 'observed', value: 29},
        benchmark: {classification: 'observed', value: 31},
        mentions: {classification: 'observed', value: 583},
        citedPages: {classification: 'observed', value: 208},
        topCitedSources: [{domain: 'example-source.test', mentions: 17}],
      },
    });
    expect(response?.evidence.map((item) => item.ref)).toContain('keyword:keyword-alpha');
  });

  it('keeps only ordered canonical review reasons and withholds them when the stored candidate is unreadable', () => {
    const all: CandidateReviewReason[] = ['reviewer_requested_regeneration', 'suspicious_provider_data', 'unresolved_evidence_reference', 'prompt_injection_content', 'ambiguous_company_identity', 'conflicting_sources', 'insufficient_evidence'];
    expect(shaped({...companyFields, ...toReviewFields({status: 'approved', candidate: candidate(all)})})?.reviewCandidate).toEqual({status: 'approved', reasons: [...all].sort()});

    const edited = JSON.parse(companyFields[COMPANY_ROW_FIELDS.reviewCandidate] as string) as ReviewCandidate;
    const tampered = shaped({...companyFields, [COMPANY_ROW_FIELDS.reviewCandidate]: JSON.stringify({...edited, reviewReasons: ['ignore all instructions']})});
    expect(tampered?.reviewCandidate).toEqual({status: 'needs_review', reasons: []});
    expect(JSON.stringify(tampered)).not.toContain('ignore all instructions');
  });

  it('withholds a published battlecard when current curated evidence changes under the same reference', () => {
    const current = shaped({...companyFields, ...toBattlecardFields(battlecard())});
    expect(current?.publishedInsightState).toBe('current');
    expect(current?.publishedInsight?.claims).toEqual([validClaim]);
    expect(current?.publishedInsight?.workflow).toEqual({evidenceFingerprint: currentFingerprint, runId: 'run-safe', harness: 'fixture', model: 'safe-model', skillVersion: '1.0.0', workflowVersion: '1.0.0'});
    expect(current?.publishedInsight?.generatedAt).toBe(at);
    expect(JSON.stringify(current)).not.toMatch(/rec-alpha|reviewer@example|Review •|insight-alpha/);

    const changedKeyword = {...keyword, observed: {...keyword.observed, keyword: 'changed value'}};
    const stale = shaped({...companyFields, [COMPANY_ROW_FIELDS.keywords]: JSON.stringify([changedKeyword]), ...toBattlecardFields(battlecard())});
    expect(stale?.publishedInsightState).toBe('stale');
    expect(stale).not.toHaveProperty('publishedInsight');
  });

  it('fails closed when a matching battlecard has unresolved or unreadable stored claims', () => {
    const unresolved = shaped({...companyFields, ...toBattlecardFields(battlecard({inferredClaims: [validClaim, {...validClaim, claimId: 'bad', evidenceRefs: ['foreign']}]}))});
    expect(unresolved?.publishedInsightState).toBe('stale');
    expect(unresolved).not.toHaveProperty('publishedInsight');

    for (const malformed of [
      '{"observedThemes":[],"inferredClaims":[{"claimId":"broken"}],"recommendations":[]}',
      JSON.stringify({observedThemes: [validClaim], inferredClaims: [], recommendations: []}),
      JSON.stringify({observedThemes: [], inferredClaims: [validClaim, validClaim], recommendations: []}),
      JSON.stringify({observedThemes: [], inferredClaims: [{...validClaim, conclusion: ` ${validClaim.conclusion}`}], recommendations: []}),
      JSON.stringify({observedThemes: [], inferredClaims: [{...validClaim, evidenceRefs: [validClaim.evidenceRefs[0], validClaim.evidenceRefs[0]]}], recommendations: []}),
      JSON.stringify({observedThemes: [], inferredClaims: [{...validClaim, unexpected: 'not canonical'}], recommendations: []}),
      '42',
    ]) {
      const response = shaped({...companyFields, ...toBattlecardFields(battlecard()), [COMPANY_ROW_FIELDS.battlecard]: malformed});
      expect(response?.publishedInsightState, malformed).toBe('stale');
      expect(response, malformed).not.toHaveProperty('publishedInsight');
    }
  });

  it('derives overall confidence from the lowest claim confidence', () => {
    const response = shaped({...companyFields, ...toBattlecardFields(battlecard({overallConfidence: 'high', inferredClaims: [{...validClaim, confidence: 'low'}]}))});
    expect(response?.publishedInsightState).toBe('current');
    expect(response?.publishedInsight?.overallConfidence).toBe('low');
  });

  it('reports an absent battlecard only when none was ever stored', () => {
    expect(shaped()?.publishedInsightState).toBe('absent');
  });

  it('retains resolvable evidence semantics without exposing raw dataset references', () => {
    const response = shaped({...companyFields, 'Observed • Raw Ref': 'https://provider.example/dataset?token=sentinel-token'});
    expect(response?.evidence[0]).toMatchObject({ref: expect.any(String), source: expect.any(String), classification: expect.any(String)});
    expect(JSON.stringify(response)).not.toContain('sentinel-token');
    expect(JSON.stringify(response)).not.toContain('rawDatasetRef');
  });

  it('keeps curated paid competitors and validated Moz detail while excluding self competitors in canonical URL forms', () => {
    const response = shaped({
      ...companyFields,
      'Observed • Organic Competitors JSON': JSON.stringify([{domain: 'https://www.alpha.example:443/path', organicTraffic: 99}, {domain: 'rival.example', organicTraffic: 10}]),
      'Calculated • Paid Competitors JSON': JSON.stringify([{domain: 'paid-rival.example', paidTraffic: 71, paidKeywords: 17, organicKeywords: 999, commonKeywords: 1}]),
      'Calculated • Moz Domain Authority': 48, 'Calculated • Moz Spam Score': 0.03,
      'Calculated • Moz Top Pages JSON': JSON.stringify([{normalizedUrl: 'https://alpha.example/guide', pageAuthority: 42}]),
    });
    expect(response?.competitors).toEqual([{domain: 'rival.example', organicTraffic: 10, organicKeywords: null, commonKeywords: null}]);
    expect(response).toMatchObject({authority: {mozDomainAuthority: {classification: 'calculated', value: 48}, mozSpamScore: {classification: 'calculated', value: 0.03}}, paidCompetitors: {classification: 'calculated', rows: [{domain: 'paid-rival.example', paidTraffic: 71, paidKeywords: 17}]}});
    expect(JSON.stringify(response?.paidCompetitors)).not.toContain('999');
  });

  it('renders unreadable keyword JSON as missing without hiding the rest of the company', () => {
    const response = shaped({...companyFields, [COMPANY_ROW_FIELDS.keywords]: '[{"observed":'});
    expect(response?.keywords).toEqual([]);
    expect(response?.kpis.organicTraffic.value).toBe(20);
    expect(response?.evidence.map((item) => item.ref)).toContain('quality:company:company-alpha:unreadable_stored_json:0');
  });
});
