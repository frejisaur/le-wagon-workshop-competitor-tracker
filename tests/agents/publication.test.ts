import {describe, expect, it, vi} from 'vitest';
import {publishApprovedInsights} from '@/lib/agents/publication/publish-approved';
import {COMPANY_ROW_FIELDS, toBattlecardFields, toReviewFields} from '@/lib/airtable/company-row';
import {parseDashboardSnapshot} from '@/lib/airtable/snapshot';
import type {AirtableFields, CompetitorStore, DashboardSnapshot} from '@/lib/airtable/types';

const CURRENT = 'b'.repeat(64);
const OLD = 'c'.repeat(64);

function claim() {
  return {claimId: 'observed-traffic', conclusion: 'Organic traffic is 200.', classification: 'observed', confidence: 'high', confidenceReason: 'Fresh measured provider metric.', evidenceRefs: ['company:company-alpha:metric:organic_traffic']};
}

const provenance = {skillVersion: '1.0.0', workflowVersion: '1.0.0', runId: 'run-1', generatedAt: '2026-08-18T12:00:00.000Z', agentHarness: 'codex', model: 'test-model'};

function snapshot(fingerprint = CURRENT, extra: AirtableFields = {}): DashboardSnapshot {
  return parseDashboardSnapshot({system: [], companies: [{id: 'rec-company', fields: {
    'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example', 'Observed • Source': 'semrush', 'Observed • Organic Traffic': 200,
    ...toReviewFields({status: 'approved', reviewerNotes: 'Reviewed by hand.', candidate: {observedThemes: [claim() as never], inferredClaims: [], recommendations: [], reviewReasons: [], evidenceFingerprint: fingerprint, ...provenance}}),
    ...extra,
  }}]});
}

function storeFor(state: DashboardSnapshot) {
  return {getDashboardSnapshot: vi.fn(async () => structuredClone(state)), upsertReview: vi.fn(async () => ({succeeded: 1, failed: 0, results: [{identity: 'company-alpha'}]})), upsertPublishedInsight: vi.fn(async () => ({succeeded: 1, failed: 0, results: [{identity: 'company-alpha'}]}))} as unknown as CompetitorStore;
}

describe('publishApprovedInsights', () => {
  it('reprepares and promotes a current approved fully evidenced candidate exactly once', async () => {
    const store = storeFor(snapshot());
    const result = await publishApprovedInsights({repository: store, prepare: async () => ({companies: [{companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidenceFingerprint: CURRENT, dueReasons: [], evidence: [{ref: 'company:company-alpha:metric:organic_traffic', classification: 'observed', source: 'semrush', value: 200}]}]} as never)});
    expect(result).toEqual({published: 1, stale: 0, failed: 0, skipped: 0});
    expect(store.upsertPublishedInsight).toHaveBeenCalledTimes(1);
    expect(store.upsertReview).toHaveBeenCalledWith(expect.objectContaining({status: 'published'}));
  });

  it('marks an approved candidate stale and preserves the previous published insight when current preparation drifted', async () => {
    const state = snapshot(OLD, toBattlecardFields({insightId: 'insight-last-published', observedThemes: [claim() as never], inferredClaims: [], recommendations: [], overallConfidence: 'high', evidenceFingerprint: OLD, ...provenance}));
    const store = storeFor(state);
    const result = await publishApprovedInsights({repository: store, prepare: async () => ({companies: [{companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidenceFingerprint: CURRENT, dueReasons: [], evidence: [{ref: 'company:company-alpha:metric:organic_traffic', classification: 'observed', source: 'semrush', value: 200}]}]} as never)});
    expect(result).toEqual({published: 0, stale: 1, failed: 0, skipped: 0});
    expect(store.upsertPublishedInsight).not.toHaveBeenCalled();
    expect(store.upsertReview).toHaveBeenCalledWith(expect.objectContaining({status: 'stale', reviewerNotes: 'Reviewed by hand.'}));
  });

  it('fails closed on an unknown stored review reason', async () => {
    const stored = JSON.parse(toReviewFields({status: 'approved', candidate: {observedThemes: [claim() as never], inferredClaims: [], recommendations: [], reviewReasons: [], evidenceFingerprint: CURRENT, ...provenance}})[COMPANY_ROW_FIELDS.reviewCandidate] as string);
    const state = snapshot(CURRENT, {[COMPANY_ROW_FIELDS.reviewCandidate]: JSON.stringify({...stored, reviewReasons: ['unknown_reason']})});
    const store = storeFor(state);
    const result = await publishApprovedInsights({repository: store, prepare: async () => ({companies: [{companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidenceFingerprint: CURRENT, dueReasons: [], evidence: [{ref: 'company:company-alpha:metric:organic_traffic', classification: 'observed', source: 'semrush', value: 200}]}]} as never)});
    expect(result).toEqual({published: 0, stale: 0, failed: 1, skipped: 0});
    expect(store.upsertPublishedInsight).not.toHaveBeenCalled();
  });
});
