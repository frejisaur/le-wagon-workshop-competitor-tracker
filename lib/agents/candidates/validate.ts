import {InsightCandidateSchema, type CandidateReviewReason, type Confidence, type InsightCandidate} from '@/lib/schemas/insight-candidate';
import type {PreparedCompany} from '@/lib/agents/types';
import {MAX_AIRTABLE_JSON_BYTES} from '@/lib/airtable/mappers';

export type CandidateValidation =
  | {ok: false; error: 'malformed_candidate' | 'unresolved_evidence_reference'; reviewReasons: string[]}
  | {ok: true; candidate: InsightCandidate; overallConfidence: Confidence; reviewReasons: CandidateReviewReason[]; stale: boolean};

const INJECTION_PATTERN = /\b(?:ignore|disregard|forget)\b[^\n]{0,80}\b(?:instruction|instructions|previous)\b|\bsystem\s+prompt\b/i;
const CONFIDENCE_RANK: Record<Confidence, number> = {high: 2, medium: 1, low: 0};

function candidateText(candidate: InsightCandidate): string[] {
  return [...candidate.observedThemes, ...candidate.inferredClaims, ...candidate.recommendations].flatMap((claim) => [claim.conclusion, claim.confidenceReason]);
}

function containsInjection(value: unknown, budget = {nodes: 0, characters: 0}): boolean {
  if (budget.nodes++ > 10_000) return true;
  if (typeof value === 'string') {
    budget.characters += value.length;
    return budget.characters > 1_000_000 || INJECTION_PATTERN.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsInjection(item, budget));
  if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => containsInjection(key, budget) || containsInjection(item, budget));
  return false;
}

function fitsAirtableClaimFields(candidate: InsightCandidate): boolean {
  return [candidate.observedThemes, candidate.inferredClaims, candidate.recommendations]
    .every((claims) => new TextEncoder().encode(JSON.stringify(claims)).byteLength <= MAX_AIRTABLE_JSON_BYTES);
}

/** Validates agent inference against exactly one freshly prepared curated package. */
export function validateInsightCandidate(input: unknown, prepared: PreparedCompany): CandidateValidation {
  const parsed = InsightCandidateSchema.safeParse(input);
  if (!parsed.success) return {ok: false, error: 'malformed_candidate', reviewReasons: []};
  const candidate = parsed.data;
  if (!fitsAirtableClaimFields(candidate)) return {ok: false, error: 'malformed_candidate', reviewReasons: ['malformed_candidate']};
  const claims = [...candidate.observedThemes, ...candidate.inferredClaims, ...candidate.recommendations];
  const refs = new Set(prepared.evidence.map((evidence) => evidence.ref));
  if (claims.some((claim) => claim.evidenceRefs.some((ref) => !refs.has(ref)))) return {ok: false, error: 'unresolved_evidence_reference', reviewReasons: ['unresolved_evidence_reference']};

  const reasons = new Set<CandidateReviewReason>(candidate.reviewReasons);
  if (!prepared.canonicalDomain || candidate.companyId !== prepared.companyId || candidate.canonicalDomain !== prepared.canonicalDomain) reasons.add('ambiguous_company_identity');
  if (prepared.evidence.some((evidence) => evidence.ref.startsWith('quality:'))) reasons.add('suspicious_provider_data');
  if (prepared.review?.reviewReasons.includes('reviewer_requested_regeneration')) reasons.add('reviewer_requested_regeneration');
  const scanBudget = {nodes: 0, characters: 0};
  if (candidateText(candidate).some((value) => INJECTION_PATTERN.test(value)) || prepared.evidence.some((evidence) => containsInjection(evidence.value, scanBudget)) || containsInjection(prepared.review?.untrustedReviewerNotes, scanBudget)) reasons.add('prompt_injection_content');
  if (claims.some((claim) => claim.classification === 'inferred' && claim.confidence === 'high' && claim.evidenceRefs.length < 2)) reasons.add('insufficient_evidence');

  const overallConfidence = claims.map((claim) => claim.confidence).reduce((lowest, confidence) => CONFIDENCE_RANK[confidence] < CONFIDENCE_RANK[lowest] ? confidence : lowest, 'high' as Confidence);
  return {ok: true, candidate, overallConfidence, reviewReasons: [...reasons].sort() as CandidateReviewReason[], stale: candidate.evidenceFingerprint !== prepared.evidenceFingerprint};
}
