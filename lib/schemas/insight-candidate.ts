import {z} from 'zod';

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
function exactText(maximum: number) {
  return z.string().min(1).max(maximum).refine((value) => value === value.trim(), 'text must be nonempty and already trimmed');
}
export const CandidateReviewReasonSchema = z.enum([
  'prompt_injection_content', 'unresolved_evidence_reference', 'conflicting_sources', 'suspicious_provider_data',
  'ambiguous_company_identity', 'insufficient_evidence', 'reviewer_requested_regeneration',
]);

export const CandidateClaimSchema = z.object({
  claimId: exactText(200),
  conclusion: exactText(2_000),
  classification: z.enum(['observed', 'inferred']),
  confidence: ConfidenceSchema,
  confidenceReason: exactText(1_000),
  evidenceRefs: z.array(exactText(500)).min(1).max(100).refine((refs) => new Set(refs).size === refs.length, 'evidence refs must be unique'),
}).strict();

const CandidateProvenanceSchema = z.object({
  runId: exactText(200),
  agentHarness: exactText(200),
  model: exactText(200),
  skillVersion: exactText(100),
  workflowVersion: exactText(100),
  generatedAt: z.string().datetime({offset: true}),
}).strict();

function collection(classification: 'observed' | 'inferred') {
  return z.array(CandidateClaimSchema).max(100).refine((claims) => claims.every((claim) => claim.classification === classification), `${classification} claim collection contains another classification`);
}

/** Agent output boundary: no raw provider object, record ID, status, or aggregate confidence may cross it. */
export const InsightCandidateSchema = z.object({
  companyId: exactText(200),
  canonicalDomain: exactText(255),
  evidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: CandidateProvenanceSchema,
  observedThemes: collection('observed'),
  inferredClaims: collection('inferred'),
  recommendations: collection('inferred'),
  reviewReasons: z.array(CandidateReviewReasonSchema).max(7).refine((reasons) => new Set(reasons).size === reasons.length, 'review reasons must be unique'),
}).strict().superRefine((candidate, context) => {
  const claims = [...candidate.observedThemes, ...candidate.inferredClaims, ...candidate.recommendations];
  if (claims.length === 0) context.addIssue({code: 'custom', path: ['observedThemes'], message: 'candidate requires at least one material claim'});
  if (new Set(claims.map((claim) => claim.claimId)).size !== claims.length) context.addIssue({code: 'custom', path: ['observedThemes'], message: 'claim IDs must be unique'});
});

export type InsightCandidate = z.infer<typeof InsightCandidateSchema>;
export type CandidateClaim = z.infer<typeof CandidateClaimSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type CandidateReviewReason = z.infer<typeof CandidateReviewReasonSchema>;
