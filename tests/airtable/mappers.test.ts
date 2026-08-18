import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {toAirtableCompanyFields, toAirtableInsightFields, toAirtableKeywordFields, toAirtablePaidAdFields, toAirtableReviewFields} from '@/lib/airtable/mappers';
import type {ClaimWire, CompanyWrite, InsightWireInput, ReviewWireInput} from '@/lib/airtable/types';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {CuratedPaidAd} from '@/lib/domain/metrics';

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
    }, 'rec-company-alpha');

    expect(fields).toMatchObject({'Identity • Keyword ID': 'company-alpha\u0000alpha topic\u0000https://alpha.example/page', 'Identity • Company Link': ['rec-company-alpha'], 'Observed • Keyword': 'alpha topic', 'Calculated • Normalized Landing URL': 'https://alpha.example/page'});
  });

  it('uses field-specific cardinality and byte bounds without truncating JSON text', () => {
    const oversized = structuredClone(company);
    oversized.observed.organicCompetitors = Array.from({length: 11}, (_, index) => ({domain: `competitor-${index}.example`, commonKeywords: null, competitionLevel: null, organicKeywords: null, organicTraffic: null, organicTrafficCostUsd: null, paidKeywords: null, paidTraffic: null, paidTrafficCostUsd: null, serpFeatureKeywords: null, serpFeatureTraffic: null, totalTraffic: null, totalTrafficCostUsd: null}));
    oversized.observed.aiByLlm = Array.from({length: 5}, (_, index) => ({llm: `model-${index}`, llmCode: `m-${index}`, mentions: 1, selfMentions: 0, citedPages: 1}));
    oversized.observed.rawSerpCodes = Array.from({length: 100}, () => 'x'.repeat(2_000));
    oversized.calculated.compactOrganicTrend = Array.from({length: 30}, (_, index) => ({date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`, organicTraffic: index}));
    const fields = toAirtableCompanyFields(oversized);

    expect(JSON.parse(fields['Observed • Organic Competitors JSON'] as string)).toHaveLength(10);
    expect(fields['Observed • Organic Competitors Observed Count']).toBe(11);
    expect(JSON.parse(fields['Observed • AI by LLM JSON'] as string)).toHaveLength(4);
    expect(JSON.parse(fields['Calculated • Compact Organic Trend JSON'] as string)).toHaveLength(24);
    const serpJsonBytes = new TextEncoder().encode(fields['Observed • SERP Codes JSON'] as string).byteLength;
    expect(serpJsonBytes).toBeGreaterThan(0);
    expect(serpJsonBytes).toBeLessThanOrEqual(90_000);
  });

  it('maps native company links and classifies observed and inferred claims separately', () => {
    const observedClaim: ClaimWire = {claimId: 'claim-observed', conclusion: 'Observed traffic rose', classification: 'observed', confidence: 'high', confidenceReason: 'direct metric', evidenceRefs: ['evidence-1']};
    const inferredClaim: ClaimWire = {claimId: 'claim-inferred', conclusion: 'Prioritize response', classification: 'inferred', confidence: 'medium', confidenceReason: 'cross-signal inference', evidenceRefs: ['evidence-1', 'evidence-2']};
    const insight: InsightWireInput = {insightId: 'insight-1', companyId: 'company-alpha', observedThemes: [observedClaim], inferredClaims: [inferredClaim], recommendations: [inferredClaim], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};
    const review: ReviewWireInput = {companyId: 'company-alpha', observedThemes: [observedClaim], inferredClaims: [inferredClaim], recommendations: [inferredClaim], reviewReasons: ['needs human review'], evidenceFingerprint: 'fingerprint', agentHarness: 'test', model: 'test', skillVersion: '1', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z', status: 'needs_review'};
    const paidAd = {observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', keyword: 'alpha', title: 'title', description: 'description', visibleUrl: 'alpha.example', landingUrl: 'https://alpha.example/ad', position: 1, previousPosition: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null}, calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: '2026-03-03T00:00:00.000Z', companyId: 'company-alpha', paidAdId: 'ad-1', normalizedLandingUrl: 'https://alpha.example/ad'}} satisfies CuratedPaidAd;

    expect(toAirtablePaidAdFields(paidAd, 'rec-company-alpha')).toMatchObject({'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha'], 'Observed • First Observed At': '2026-03-03T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});
    const insightFields = toAirtableInsightFields(insight, 'rec-company-alpha');
    const reviewFields = toAirtableReviewFields(review, 'rec-company-alpha');
    expect(insightFields).toMatchObject({'Identity • Company Link': ['rec-company-alpha'], 'Observed • Themes Claim Count': 1, 'Inferred • Claims Claim Count': 1});
    expect(JSON.parse(insightFields['Observed • Themes JSON'] as string)[0]).toMatchObject(observedClaim);
    expect(reviewFields).toMatchObject({'Identity • Company Link': ['rec-company-alpha'], 'Observed • Themes Claim Count': 1, 'Inferred • Claims Claim Count': 1});
    expect(JSON.parse(reviewFields['Inferred • Claims JSON'] as string)[0]).toMatchObject(inferredClaim);
  });

  it('rejects oversized evidence-ref collections rather than silently removing references', () => {
    const oversizedClaim: ClaimWire = {
      claimId: 'claim-large', conclusion: 'Still retained', classification: 'observed', confidence: 'high', confidenceReason: 'direct evidence',
      evidenceRefs: Array.from({length: 101}, () => 'evidence-'.concat('x'.repeat(2_000))),
    };
    const insight: InsightWireInput = {insightId: 'insight-large', companyId: 'company-alpha', observedThemes: [oversizedClaim], inferredClaims: [], recommendations: [], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};
    expect(() => toAirtableInsightFields(insight, 'rec-company-alpha')).toThrow('claim evidence refs exceed Airtable cap');
  });

  it('rejects an Insight or Review when a claim cannot retain one complete evidence ref without exposing it', () => {
    const oversizedEvidenceRef = `private-evidence-ref-${'x'.repeat(90_000)}`;
    const claim: ClaimWire = {claimId: 'claim-oversized-ref', conclusion: 'Observed', classification: 'observed', confidence: 'high', confidenceReason: 'Direct', evidenceRefs: [oversizedEvidenceRef]};
    const insight: InsightWireInput = {insightId: 'insight-oversized-ref', companyId: 'company-alpha', observedThemes: [claim], inferredClaims: [], recommendations: [], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};
    const review: ReviewWireInput = {companyId: 'company-alpha', observedThemes: [claim], inferredClaims: [], recommendations: [], reviewReasons: [], evidenceFingerprint: 'fingerprint', agentHarness: 'test', model: 'test', skillVersion: '1', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z', status: 'needs_review'};

    for (const map of [() => toAirtableInsightFields(insight, 'rec-company-alpha'), () => toAirtableReviewFields(review, 'rec-company-alpha')]) {
      let thrown: unknown;
      try {
        map();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(TypeError);
      expect(String(thrown)).toContain('claim cannot retain evidence within Airtable JSON byte budget');
      expect(String(thrown)).not.toContain('private-evidence-ref');
    }
  });

  it('rejects a claim with no evidence refs instead of persisting evidenceRefs as empty', () => {
    const claim: ClaimWire = {claimId: 'claim-no-evidence', conclusion: 'Observed', classification: 'observed', confidence: 'high', confidenceReason: 'Direct', evidenceRefs: []};
    const insight: InsightWireInput = {insightId: 'insight-no-evidence', companyId: 'company-alpha', observedThemes: [claim], inferredClaims: [], recommendations: [], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};

    expect(() => toAirtableInsightFields(insight, 'rec-company-alpha')).toThrow('claim requires at least one evidence ref');
  });

  it('rejects outer claim cardinality over the persisted cap', () => {
    const claims = Array.from({length: 101}, (_, index): ClaimWire => ({claimId: `claim-${index}`, conclusion: 'observed', classification: 'observed', confidence: 'high', confidenceReason: 'direct', evidenceRefs: [`evidence-${index}`]}));
    const insight: InsightWireInput = {insightId: 'insight-many', companyId: 'company-alpha', observedThemes: claims, inferredClaims: [], recommendations: [], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};
    expect(() => toAirtableInsightFields(insight, 'rec-company-alpha')).toThrow('claim collection exceeds Airtable cap');
  });

  it('rejects oversized serialized claims without truncating claim text', () => {
    const first: ClaimWire = {claimId: 'claim-multibyte', conclusion: 'é'.repeat(44_000), classification: 'observed', confidence: 'high', confidenceReason: 'direct', evidenceRefs: ['evidence-first']};
    const second: ClaimWire = {claimId: 'tail-claim', conclusion: 'é'.repeat(2_000), classification: 'observed', confidence: 'high', confidenceReason: 'direct', evidenceRefs: ['evidence-second']};
    const insight: InsightWireInput = {insightId: 'insight-boundary', companyId: 'company-alpha', observedThemes: [first, second], inferredClaims: [], recommendations: [], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};
    expect(() => toAirtableInsightFields(insight, 'rec-company-alpha')).toThrow('claim cannot retain evidence within Airtable JSON byte budget');
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
