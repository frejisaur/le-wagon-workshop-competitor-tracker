import {createHash} from 'node:crypto';
import {prepareInsights, type PrepareInsightsOptions} from '@/lib/agents/manifests/prepare';
import {validateInsightCandidate} from '@/lib/agents/candidates/validate';
import {InsightCandidateSchema, type CandidateReviewReason, type Confidence, type InsightCandidate} from '@/lib/schemas/insight-candidate';
import type {AirtableRecord, CompetitorStore, InsightWireInput, ReviewWireInput} from '@/lib/airtable/types';
import type {PreparedCompany} from '@/lib/agents/types';

export type SubmissionStatus = 'published' | 'queued' | 'stale' | 'rejected';
export type SubmissionResult = {status: SubmissionStatus; companyId: string; runId: string; reasons: string[]; idempotent: boolean; overallConfidence?: Confidence};
export type SubmitInsightOptions = {repository: CompetitorStore; now?: Date; prepare?: (options: PrepareInsightsOptions) => Promise<{companies: PreparedCompany[]}>};

const submissionLocks = new Map<string, Promise<void>>();
const replayedResults = new WeakMap<CompetitorStore, Map<string, SubmissionResult>>();

function field(record: AirtableRecord, name: string): string | undefined {
  const value = record.fields[name];
  return typeof value === 'string' && value ? value : undefined;
}

function parsedIdentity(input: unknown): {companyId: string; runId: string} {
  const object = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const provenance = object.provenance && typeof object.provenance === 'object' ? object.provenance as Record<string, unknown> : {};
  return {companyId: typeof object.companyId === 'string' ? object.companyId : 'unknown', runId: typeof provenance.runId === 'string' ? provenance.runId : 'unknown'};
}

function result(status: SubmissionStatus, candidate: Pick<InsightCandidate, 'companyId' | 'provenance'> | {companyId: string; runId: string}, reasons: string[] = [], extras: Pick<SubmissionResult, 'idempotent' | 'overallConfidence'> = {idempotent: false}): SubmissionResult {
  return {status, companyId: candidate.companyId, runId: 'provenance' in candidate ? candidate.provenance.runId : candidate.runId, reasons: [...reasons].sort(), ...extras};
}

function matchingRecord(records: AirtableRecord[], companyId: string, fingerprint: string, skillVersion: string, workflowVersion: string): AirtableRecord | undefined {
  return records.find((record) => field(record, 'Identity • Company ID') === companyId && field(record, 'Workflow • Evidence Fingerprint') === fingerprint && field(record, 'Workflow • Skill Version') === skillVersion && field(record, 'Workflow • Version') === workflowVersion);
}

function stableInsightId(companyId: string, fingerprint: string, skillVersion: string, workflowVersion: string): string {
  return `insight_${createHash('sha256').update(`${companyId}\u0000${fingerprint}\u0000${skillVersion}\u0000${workflowVersion}`).digest('hex').slice(0, 32)}`;
}

function reviewWire(candidate: InsightCandidate, overallConfidence: Confidence, reviewReasons: CandidateReviewReason[], status: ReviewWireInput['status'], existing?: AirtableRecord): ReviewWireInput {
  return {companyId: candidate.companyId, observedThemes: candidate.observedThemes, inferredClaims: candidate.inferredClaims, recommendations: candidate.recommendations, overallConfidence, reviewReasons, evidenceFingerprint: candidate.evidenceFingerprint,
    agentHarness: candidate.provenance.agentHarness, model: candidate.provenance.model, skillVersion: candidate.provenance.skillVersion, workflowVersion: candidate.provenance.workflowVersion, runId: candidate.provenance.runId, generatedAt: candidate.provenance.generatedAt, status,
    reviewerNotes: existing ? field(existing, 'Review • Notes') : undefined, reviewerIdentity: existing ? field(existing, 'Review • Identity') : undefined, reviewedAt: existing ? field(existing, 'Review • At') : undefined};
}

function insightWire(candidate: InsightCandidate, overallConfidence: Confidence): InsightWireInput {
  return {insightId: stableInsightId(candidate.companyId, candidate.evidenceFingerprint, candidate.provenance.skillVersion, candidate.provenance.workflowVersion), companyId: candidate.companyId, observedThemes: candidate.observedThemes, inferredClaims: candidate.inferredClaims, recommendations: candidate.recommendations, overallConfidence,
    agentHarness: candidate.provenance.agentHarness, model: candidate.provenance.model, skillVersion: candidate.provenance.skillVersion, evidenceFingerprint: candidate.evidenceFingerprint, workflowVersion: candidate.provenance.workflowVersion, runId: candidate.provenance.runId, generatedAt: candidate.provenance.generatedAt};
}

async function serial<T>(companyId: string, task: () => Promise<T>): Promise<T> {
  const previous = submissionLocks.get(companyId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const chained = previous.then(() => current);
  submissionLocks.set(companyId, chained);
  await previous;
  try { return await task(); } finally { release(); if (submissionLocks.get(companyId) === chained) submissionLocks.delete(companyId); }
}

/** Submits untrusted agent output after fresh preparation; no candidate controls storage identity or state. */
export async function submitInsightCandidate(input: unknown, options: SubmitInsightOptions): Promise<SubmissionResult> {
  const identity = parsedIdentity(input);
  const parsed = InsightCandidateSchema.safeParse(input);
  if (!parsed.success) return result('rejected', identity, ['malformed_candidate']);
  const candidate = parsed.data;
  return serial(candidate.companyId, async () => {
    try {
      const manifest = await (options.prepare ?? prepareInsights)({repository: options.repository, companyId: candidate.companyId, due: false, now: options.now});
      const prepared = manifest.companies.find((company) => company.companyId === candidate.companyId);
      if (!prepared) return result('rejected', candidate, ['ambiguous_company_identity']);
      const validation = validateInsightCandidate(candidate, prepared);
      if (!validation.ok) return result('rejected', candidate, validation.reviewReasons);
      const snapshot = await options.repository.getDashboardSnapshot();
      const companyReviews = snapshot.reviews.filter((record) => field(record, 'Identity • Company ID') === candidate.companyId);
      if (companyReviews.length > 1) return result('rejected', candidate, ['duplicate_review_records'], {idempotent: false, overallConfidence: validation.overallConfidence});
      const existingReview = companyReviews[0];
      // Freshness is intentionally evaluated before replay detection.
      if (validation.stale) {
        const write = await options.repository.upsertReview(reviewWire(candidate, validation.overallConfidence, validation.reviewReasons, 'stale', existingReview));
        return result(write.failed ? 'rejected' : 'stale', candidate, write.failed ? ['submission_failed'] : validation.reviewReasons, {idempotent: false, overallConfidence: validation.overallConfidence});
      }
      const key = `${candidate.companyId}\u0000${prepared.evidenceFingerprint}\u0000${candidate.provenance.skillVersion}\u0000${candidate.provenance.workflowVersion}`;
      const memory = replayedResults.get(options.repository);
      const cached = memory?.get(key);
      if (cached && !validation.reviewReasons.includes('reviewer_requested_regeneration')) return {...cached, idempotent: true, runId: candidate.provenance.runId};
      const published = matchingRecord(snapshot.publishedInsights, candidate.companyId, prepared.evidenceFingerprint, candidate.provenance.skillVersion, candidate.provenance.workflowVersion);
      if (published) return result('published', candidate, validation.reviewReasons, {idempotent: true, overallConfidence: validation.overallConfidence});
      const sameReview = matchingRecord(companyReviews, candidate.companyId, prepared.evidenceFingerprint, candidate.provenance.skillVersion, candidate.provenance.workflowVersion);
      const regeneration = validation.reviewReasons.includes('reviewer_requested_regeneration');
      if (sameReview && !regeneration) return result('queued', candidate, validation.reviewReasons, {idempotent: true, overallConfidence: validation.overallConfidence});
      const autoPublish = validation.overallConfidence === 'high' && validation.reviewReasons.length === 0;
      const write = autoPublish ? await options.repository.upsertPublishedInsight(insightWire(candidate, validation.overallConfidence)) : await options.repository.upsertReview(reviewWire(candidate, validation.overallConfidence, validation.reviewReasons, 'needs_review', existingReview));
      const submitted = result(write.failed ? 'rejected' : autoPublish ? 'published' : 'queued', candidate, write.failed ? ['submission_failed'] : validation.reviewReasons, {idempotent: false, overallConfidence: validation.overallConfidence});
      if (!write.failed) {
        const results = replayedResults.get(options.repository) ?? new Map<string, SubmissionResult>();
        results.set(key, submitted);
        replayedResults.set(options.repository, results);
      }
      return submitted;
    } catch { return result('rejected', candidate, ['submission_failed']); }
  });
}

export const lifecycleWire = {insightWire, reviewWire};
