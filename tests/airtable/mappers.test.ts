import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {toAirtableInsightFields, toAirtableKeywordFields, toAirtablePaidAdFields, toAirtableReviewFields, toAirtableSystemFields} from '@/lib/airtable/mappers';
import type {ClaimWire, InsightWireInput, ReviewWireInput, SystemWireInput} from '@/lib/airtable/types';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {CuratedPaidAd} from '@/lib/domain/metrics';

describe('Airtable mappers', () => {
  it('preserves deterministic keyword identity apart from observed keyword data', () => {
    const fields = toAirtableKeywordFields({
      observed: {classification: 'observed', source: 'semrush', observedAt: '2026-03-03T00:00:00.000Z', database: 'us', keyword: 'alpha topic', landingUrl: 'https://alpha.example/page', position: 1, previousPosition: 2, positionDifference: 1, volume: 10, cpcUsd: 2, keywordDifficulty: 3, competition: 0.2, traffic: 4, trafficSharePct: 5, trafficCostUsd: 6, intents: ['informational'], rawSerpCodes: [999], results: 7},
      calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: '2026-03-03T00:00:00.000Z', companyId: 'company-alpha', keywordId: 'company-alpha\u0000alpha topic\u0000https://alpha.example/page', normalizedLandingUrl: 'https://alpha.example/page'},
    }, 'rec-company-alpha');

    expect(fields).toMatchObject({'Identity • Keyword ID': 'company-alpha\u0000alpha topic\u0000https://alpha.example/page', 'Identity • Company Link': ['rec-company-alpha'], 'Observed • Keyword': 'alpha topic', 'Calculated • Normalized Landing URL': 'https://alpha.example/page'});
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

  it('omits an unknown last-successful timestamp from production System fields and preserves it in fixture PATCH parity', async () => {
    const failed: SystemWireInput = {systemId: 'system', status: 'failed', processedCompanies: 0, succeededCompanies: 0, failedCompanies: 0};
    const fields = toAirtableSystemFields(failed);
    const repository = FixtureCompetitorRepository.fromSnapshot(resolve(process.cwd(), 'tests/fixtures/airtable/refresh-system-snapshot.json'));
    const sentinel = '2026-08-01T00:00:00.000Z';
    await repository.updateSystem({...failed, status: 'succeeded', lastSuccessfulRunAt: sentinel});
    await repository.updateSystem(failed);

    expect(fields).not.toHaveProperty('Workflow • Last Successful Run At');
    expect((await repository.getDashboardSnapshot()).system[0].fields['Workflow • Last Successful Run At']).toBe(sentinel);
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

  it('persists accepted claim conclusion and confidence-reason bytes exactly', () => {
    const claim: ClaimWire = {claimId: 'claim-exact', conclusion: 'Measured  traffic.', classification: 'observed', confidence: 'high', confidenceReason: 'Direct  current source.', evidenceRefs: ['evidence-exact']};
    const insight: InsightWireInput = {insightId: 'insight-exact', companyId: 'company-alpha', observedThemes: [claim], inferredClaims: [], recommendations: [], agentHarness: 'test', model: 'test', skillVersion: '1', evidenceFingerprint: 'fingerprint', workflowVersion: '1', runId: 'run', generatedAt: '2026-03-03T00:00:00.000Z'};
    const stored = JSON.parse(toAirtableInsightFields(insight, 'rec-company-alpha')['Observed • Themes JSON'] as string)[0];
    expect(stored).toMatchObject({conclusion: 'Measured  traffic.', confidenceReason: 'Direct  current source.', evidenceRefs: ['evidence-exact']});
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
