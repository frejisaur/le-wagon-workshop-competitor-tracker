import {validateInsightCandidate} from '@/lib/agents/candidates/validate';
import {prepareInsights, type PrepareInsightsOptions} from '@/lib/agents/manifests/prepare';
import {lifecycleWire} from './submit';
import {companyIdOf, type CompanyReview, type ReviewCandidate} from '@/lib/airtable/company-row';
import type {CompetitorStore} from '@/lib/airtable/types';
import type {PreparedCompany} from '@/lib/agents/types';

export type PublishApprovedResult = {published: number; stale: number; failed: number; skipped: number};
export type PublishApprovedOptions = {repository: CompetitorStore; now?: Date; prepare?: (options: PrepareInsightsOptions) => Promise<{companies: PreparedCompany[]}>};

/** Rebuilds the agent candidate from the stored, already schema-validated review candidate. */
function storedCandidate(companyId: string, candidate: ReviewCandidate, prepared: PreparedCompany): unknown {
  const {observedThemes, inferredClaims, recommendations, reviewReasons, evidenceFingerprint, agentHarness, model, skillVersion, workflowVersion, runId, generatedAt} = candidate;
  return {companyId, canonicalDomain: prepared.canonicalDomain, evidenceFingerprint, provenance: {agentHarness, model, skillVersion, workflowVersion, runId, generatedAt}, observedThemes, inferredClaims, recommendations, reviewReasons};
}

function reviewerFields(review: CompanyReview) {
  return {reviewerNotes: review.reviewerNotes, reviewerIdentity: review.reviewerIdentity, reviewedAt: review.reviewedAt};
}

/** Reprepares each approved review and promotes it only if the authoritative package is unchanged. */
export async function publishApprovedInsights(options: PublishApprovedOptions): Promise<PublishApprovedResult> {
  const result: PublishApprovedResult = {published: 0, stale: 0, failed: 0, skipped: 0};
  const snapshot = await options.repository.getDashboardSnapshot();
  const prepare = options.prepare ?? prepareInsights;
  for (const row of snapshot.companies.filter((candidate) => candidate.review?.status === 'approved')) {
    const companyId = companyIdOf(row);
    const review = row.review!;
    if (!companyId || !review.candidate) { result.failed += 1; continue; }
    try {
      const manifest = await prepare({repository: options.repository, companyId, due: false, now: options.now});
      const prepared = manifest.companies.find((company) => company.companyId === companyId);
      if (!prepared) { result.failed += 1; continue; }
      const validation = validateInsightCandidate(storedCandidate(companyId, review.candidate, prepared), prepared);
      if (!validation.ok || validation.stale) {
        if (!validation.ok) { result.failed += 1; continue; }
        const stale = {...lifecycleWire.reviewWire(validation.candidate, validation.overallConfidence, validation.reviewReasons, 'stale'), ...reviewerFields(review)};
        if ((await options.repository.upsertReview(stale)).failed) result.failed += 1;
        else result.stale += 1;
        continue;
      }
      const published = await options.repository.upsertPublishedInsight(lifecycleWire.insightWire(validation.candidate, validation.overallConfidence));
      if (published.failed) { result.failed += 1; continue; }
      const marked = await options.repository.upsertReview({...lifecycleWire.reviewWire(validation.candidate, validation.overallConfidence, validation.reviewReasons, 'published'), ...reviewerFields(review)});
      if (marked.failed) result.failed += 1;
      else result.published += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
