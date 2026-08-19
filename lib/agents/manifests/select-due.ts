import type {DueReason, SelectDueInput} from '@/lib/agents/types';

const ACTIVE_REVIEW_STATUSES = new Set(['needs_review', 'approved']);

function isPastOrCurrent(isoTimestamp: string | undefined, now: Date): boolean {
  if (!isoTimestamp) return false;
  const timestamp = Date.parse(isoTimestamp);
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

/** Selects only regeneration reasons from the fixed public DueReason vocabulary. */
export function selectDue(input: SelectDueInput): DueReason[] {
  const reviewRequested = input.review?.reviewReasons.includes('reviewer_requested_regeneration') ?? false;
  const activeCurrentReview = Boolean(
    input.review
    && ACTIVE_REVIEW_STATUSES.has(input.review.status ?? '')
    && input.review.evidenceFingerprint === input.evidenceFingerprint
    && input.review.skillVersion === input.skillVersion,
  );
  if (activeCurrentReview && !reviewRequested) return [];

  const reasons: DueReason[] = [];
  if (!input.published) reasons.push('never_generated');
  else {
    if (input.published.evidenceFingerprint !== input.evidenceFingerprint) reasons.push('fingerprint_changed');
    if (input.published.skillVersion !== input.skillVersion) reasons.push('skill_version_changed');
  }
  if (isPastOrCurrent(input.nextInsightDueAt, input.now ?? new Date())) reasons.push('refresh_due');
  if (reviewRequested) reasons.push('reviewer_requested_regeneration');
  return reasons;
}
