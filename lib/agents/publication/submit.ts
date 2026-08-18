import {createHash} from 'node:crypto';
import {prepareInsights, type PrepareInsightsOptions} from '@/lib/agents/manifests/prepare';
import {validateInsightCandidate} from '@/lib/agents/candidates/validate';
import type {CandidateReviewReason, Confidence} from '@/lib/schemas/insight-candidate';
import type {AirtableRecord, CompetitorStore, InsightWireInput, ReviewWireInput} from '@/lib/airtable/types';
import type {PreparedCompany} from '@/lib/agents/types';

export type SubmissionOutcome = 'published' | 'queued' | 'stale' | 'rejected' | 'failed';
export type SubmissionResult = {outcome: SubmissionOutcome; idempotent: boolean; overallConfidence?: Confidence; reviewReasons: CandidateReviewReason[]};
export type SubmitInsightOptions = {
  repository: CompetitorStore;
  now?: Date;
  prepare?: (options: PrepareInsightsOptions) => Promise<{companies: PreparedCompany[]}>;
};

function field(record: AirtableRecord, name: string): string | undefined {
  const value = record.fields[name];
  return typeof value === 'string' && value ? value : undefined;
}

function matchingRecord(records: AirtableRecord[], companyId: string, fingerprint: string, skillVersion: string, workflowVersion: string): AirtableRecord | undefined {
  return records.find((record) => field(record, 'Identity • Company ID') === companyId
    && field(record, 'Workflow • Evidence Fingerprint') === fingerprint
    && field(record, 'Workflow • Skill Version') === skillVersion
    && field(record, 'Workflow • Version') === workflowVersion);
}

function stableInsightId(companyId: string, fingerprint: string, skillVersion: string, workflowVersion: string): string {
  return `insight_${createHash('sha256').update(`${companyId}\u0000${fingerprint}\u0000${skillVersion}\u0000${workflowVersion}`).digest('hex').slice(0, 32)}`;
}

function reviewWire(candidate: import('@/lib/schemas/insight-candidate').InsightCandidate, overallConfidence: Confidence, reviewReasons: CandidateReviewReason[], status: ReviewWireInput['status']): ReviewWireInput {
  return {
    companyId: candidate.companyId, observedThemes: candidate.observedThemes, inferredClaims: candidate.inferredClaims, recommendations: candidate.recommendations,
    summary: candidate.summary, paidMessageSummary: candidate.paidMessageSummary, aiSearchSummary: candidate.aiSearchSummary,
    overallConfidence, reviewReasons, evidenceFingerprint: candidate.evidenceFingerprint,
    agentHarness: candidate.provenance.agentHarness, model: candidate.provenance.model, skillVersion: candidate.provenance.skillVersion,
    workflowVersion: candidate.provenance.workflowVersion, runId: candidate.provenance.runId, generatedAt: candidate.provenance.generatedAt, status,
  };
}

function insightWire(candidate: import('@/lib/schemas/insight-candidate').InsightCandidate, overallConfidence: Confidence): InsightWireInput {
  return {
    insightId: stableInsightId(candidate.companyId, candidate.evidenceFingerprint, candidate.provenance.skillVersion, candidate.provenance.workflowVersion),
    companyId: candidate.companyId, observedThemes: candidate.observedThemes, inferredClaims: candidate.inferredClaims, recommendations: candidate.recommendations,
    paidMessageSummary: candidate.paidMessageSummary, aiSearchSummary: candidate.aiSearchSummary, overallConfidence,
    agentHarness: candidate.provenance.agentHarness, model: candidate.provenance.model, skillVersion: candidate.provenance.skillVersion,
    evidenceFingerprint: candidate.evidenceFingerprint, workflowVersion: candidate.provenance.workflowVersion, runId: candidate.provenance.runId, generatedAt: candidate.provenance.generatedAt,
  };
}

/**
 * Submits one untrusted agent candidate through fresh prepared evidence. The
 * candidate never selects a storage identity or publication state.
 */
export async function submitInsightCandidate(input: unknown, options: SubmitInsightOptions): Promise<SubmissionResult> {
  const parsed = (await import('@/lib/schemas/insight-candidate')).InsightCandidateSchema.safeParse(input);
  if (!parsed.success) return {outcome: 'rejected', idempotent: false, reviewReasons: []};
  const candidate = parsed.data;
  try {
    const prepare = options.prepare ?? prepareInsights;
    const manifest = await prepare({repository: options.repository, companyId: candidate.companyId, due: false, now: options.now});
    const prepared = manifest.companies.find((company) => company.companyId === candidate.companyId);
    if (!prepared) return {outcome: 'rejected', idempotent: false, reviewReasons: ['ambiguous_identity']};
    const validation = validateInsightCandidate(candidate, prepared);
    if (!validation.ok) return {outcome: 'rejected', idempotent: false, reviewReasons: validation.reviewReasons};

    const snapshot = await options.repository.getDashboardSnapshot();
    const {skillVersion, workflowVersion} = candidate.provenance;
    const published = matchingRecord(snapshot.publishedInsights, candidate.companyId, candidate.evidenceFingerprint, skillVersion, workflowVersion);
    if (published) return {outcome: 'published', idempotent: true, overallConfidence: validation.overallConfidence, reviewReasons: validation.reviewReasons};
    const review = matchingRecord(snapshot.reviews, candidate.companyId, candidate.evidenceFingerprint, skillVersion, workflowVersion);
    if (review) {
      const status = field(review, 'Review • Status');
      if (status === 'stale') return {outcome: 'stale', idempotent: true, overallConfidence: validation.overallConfidence, reviewReasons: validation.reviewReasons};
      if (status === 'needs_review' || status === 'approved' || status === 'rejected') return {outcome: 'queued', idempotent: true, overallConfidence: validation.overallConfidence, reviewReasons: validation.reviewReasons};
    }

    if (validation.stale) {
      const write = await options.repository.upsertReview(reviewWire(candidate, validation.overallConfidence, validation.reviewReasons, 'stale'));
      return {outcome: write.failed ? 'failed' : 'stale', idempotent: false, overallConfidence: validation.overallConfidence, reviewReasons: validation.reviewReasons};
    }
    const autoPublish = validation.overallConfidence === 'high' && validation.reviewReasons.length === 0;
    if (autoPublish) {
      const write = await options.repository.upsertPublishedInsight(insightWire(candidate, validation.overallConfidence));
      return {outcome: write.failed ? 'failed' : 'published', idempotent: false, overallConfidence: validation.overallConfidence, reviewReasons: validation.reviewReasons};
    }
    const write = await options.repository.upsertReview(reviewWire(candidate, validation.overallConfidence, validation.reviewReasons, 'needs_review'));
    return {outcome: write.failed ? 'failed' : 'queued', idempotent: false, overallConfidence: validation.overallConfidence, reviewReasons: validation.reviewReasons};
  } catch {
    return {outcome: 'failed', idempotent: false, reviewReasons: []};
  }
}

export const lifecycleWire = {insightWire, reviewWire};
