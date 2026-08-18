import {CandidateClaimSchema, CandidateReviewReasonSchema, type CandidateReviewReason} from '@/lib/schemas/insight-candidate';
import {validateInsightCandidate} from '@/lib/agents/candidates/validate';
import {prepareInsights, type PrepareInsightsOptions} from '@/lib/agents/manifests/prepare';
import {lifecycleWire} from './submit';
import type {AirtableRecord, CompetitorStore} from '@/lib/airtable/types';
import type {PreparedCompany} from '@/lib/agents/types';

export type PublishApprovedResult = {published: number; stale: number; failed: number; skipped: number};
export type PublishApprovedOptions = {repository: CompetitorStore; now?: Date; prepare?: (options: PrepareInsightsOptions) => Promise<{companies: PreparedCompany[]}>};

function stringField(record: AirtableRecord, name: string): string | undefined {
  const value = record.fields[name];
  return typeof value === 'string' && value ? value : undefined;
}

function claims(record: AirtableRecord, field: string): unknown[] | null {
  const raw = stringField(record, field);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function reasons(record: AirtableRecord): CandidateReviewReason[] | null {
  const raw = stringField(record, 'Inferred • Review Reasons JSON');
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const validated = CandidateReviewReasonSchema.array().safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function reviewCandidate(record: AirtableRecord, prepared: PreparedCompany): unknown | null {
  const observedThemes = claims(record, 'Observed • Themes JSON');
  const inferredClaims = claims(record, 'Inferred • Claims JSON');
  const recommendations = claims(record, 'Inferred • Recommendations JSON');
  const reviewReasons = reasons(record);
  const companyId = stringField(record, 'Identity • Company ID');
  const evidenceFingerprint = stringField(record, 'Workflow • Evidence Fingerprint');
  const agentHarness = stringField(record, 'Workflow • Agent Harness');
  const model = stringField(record, 'Workflow • Model');
  const skillVersion = stringField(record, 'Workflow • Skill Version');
  const workflowVersion = stringField(record, 'Workflow • Version');
  const runId = stringField(record, 'Workflow • Run ID');
  const generatedAt = stringField(record, 'Workflow • Generated At');
  if (!observedThemes || !inferredClaims || !recommendations || !reviewReasons || !companyId || !evidenceFingerprint || !agentHarness || !model || !skillVersion || !workflowVersion || !runId || !generatedAt) return null;
  // Parse stored claims before reusing them. Stored data is untrusted, including reviewer edits.
  if (![...observedThemes, ...inferredClaims, ...recommendations].every((claim) => CandidateClaimSchema.safeParse(claim).success)) return null;
  return {companyId, canonicalDomain: prepared.canonicalDomain, evidenceFingerprint, provenance: {agentHarness, model, skillVersion, workflowVersion, runId, generatedAt}, observedThemes, inferredClaims, recommendations, reviewReasons};
}

/** Reprepares each approved review and promotes it only if the authoritative package is unchanged. */
export async function publishApprovedInsights(options: PublishApprovedOptions): Promise<PublishApprovedResult> {
  const result: PublishApprovedResult = {published: 0, stale: 0, failed: 0, skipped: 0};
  const snapshot = await options.repository.getDashboardSnapshot();
  const prepare = options.prepare ?? prepareInsights;
  for (const review of snapshot.reviews.filter((record) => stringField(record, 'Review • Status') === 'approved')) {
    const companyId = stringField(review, 'Identity • Company ID');
    if (!companyId) { result.failed += 1; continue; }
    try {
      const manifest = await prepare({repository: options.repository, companyId, due: false, now: options.now});
      const prepared = manifest.companies.find((company) => company.companyId === companyId);
      if (!prepared) { result.failed += 1; continue; }
      const candidate = reviewCandidate(review, prepared);
      if (!candidate) { result.failed += 1; continue; }
      const validation = validateInsightCandidate(candidate, prepared);
      if (!validation.ok || validation.stale) {
        if (!validation.ok) { result.failed += 1; continue; }
        const stale = {...lifecycleWire.reviewWire(validation.candidate, validation.overallConfidence, validation.reviewReasons, 'stale'), reviewerNotes: stringField(review, 'Review • Notes'), reviewerIdentity: stringField(review, 'Review • Identity'), reviewedAt: stringField(review, 'Review • At')};
        if ((await options.repository.upsertReview(stale)).failed) result.failed += 1;
        else result.stale += 1;
        continue;
      }
      const published = await options.repository.upsertPublishedInsight(lifecycleWire.insightWire(validation.candidate, validation.overallConfidence));
      if (published.failed) { result.failed += 1; continue; }
      const marked = await options.repository.upsertReview({...lifecycleWire.reviewWire(validation.candidate, validation.overallConfidence, validation.reviewReasons, 'published'), reviewerNotes: stringField(review, 'Review • Notes'), reviewerIdentity: stringField(review, 'Review • Identity'), reviewedAt: stringField(review, 'Review • At')});
      if (marked.failed) result.failed += 1;
      else result.published += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
