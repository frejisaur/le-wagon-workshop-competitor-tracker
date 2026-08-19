import {describe, expect, it, vi} from 'vitest';
import {publishApprovedInsights} from '@/lib/agents/publication/publish-approved';
import type {CompetitorStore, DashboardSnapshot} from '@/lib/airtable/types';

const CURRENT = 'b'.repeat(64);
const OLD = 'c'.repeat(64);

function claim() {
  return {claimId: 'observed-traffic', conclusion: 'Organic traffic is 200.', classification: 'observed', confidence: 'high', confidenceReason: 'Fresh measured provider metric.', evidenceRefs: ['company:company-alpha:metric:organic_traffic']};
}

function snapshot(fingerprint = CURRENT): DashboardSnapshot {
  return {companies: [{id: 'rec-company', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example', 'Observed • Source': 'semrush', 'Observed • Organic Traffic': 200}}], keywords: [], paidAds: [], publishedInsights: [], system: [], reviews: [{id: 'rec-review', fields: {
    'Identity • Company ID': 'company-alpha', 'Review • Status': 'approved',
    'Observed • Themes JSON': JSON.stringify([claim()]), 'Inferred • Claims JSON': '[]', 'Inferred • Recommendations JSON': '[]',
    'Inferred • Summary': 'Direct organic demand signal is present.', 'Inferred • Review Reasons JSON': '[]',
    'Workflow • Evidence Fingerprint': fingerprint, 'Workflow • Skill Version': '1.0.0', 'Workflow • Version': '1.0.0', 'Workflow • Run ID': 'run-1', 'Workflow • Generated At': '2026-08-18T12:00:00.000Z', 'Workflow • Agent Harness': 'codex', 'Workflow • Model': 'test-model',
  }}]};
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
    const state = snapshot(OLD);
    state.publishedInsights = [{id: 'rec-last-published', fields: {'Identity • Company ID': 'company-alpha', 'Workflow • Evidence Fingerprint': OLD}}];
    const store = storeFor(state);
    const result = await publishApprovedInsights({repository: store, prepare: async () => ({companies: [{companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidenceFingerprint: CURRENT, dueReasons: [], evidence: [{ref: 'company:company-alpha:metric:organic_traffic', classification: 'observed', source: 'semrush', value: 200}]}]} as never)});
    expect(result).toEqual({published: 0, stale: 1, failed: 0, skipped: 0});
    expect(store.upsertPublishedInsight).not.toHaveBeenCalled();
    expect(store.upsertReview).toHaveBeenCalledWith(expect.objectContaining({status: 'stale'}));
  });

  it('fails closed on an unknown stored review reason', async () => {
    const state = snapshot();
    state.reviews[0].fields['Inferred • Review Reasons JSON'] = '["unknown_reason"]';
    const store = storeFor(state);
    const result = await publishApprovedInsights({repository: store, prepare: async () => ({companies: [{companyId: 'company-alpha', canonicalDomain: 'alpha.example', evidenceFingerprint: CURRENT, dueReasons: [], evidence: [{ref: 'company:company-alpha:metric:organic_traffic', classification: 'observed', source: 'semrush', value: 200}]}]} as never)});
    expect(result).toEqual({published: 0, stale: 0, failed: 1, skipped: 0});
    expect(store.upsertPublishedInsight).not.toHaveBeenCalled();
  });
});
