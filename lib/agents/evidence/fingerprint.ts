import {createHash} from 'node:crypto';
import type {EvidenceValue} from '@/lib/agents/types';

const EXCLUDED_KEYS = new Set([
  'runId', 'generatedAt', 'generatedProse', 'publication', 'published', 'review',
  'dueReasons', 'evidenceFingerprint', 'observedThemes', 'inferredClaims',
  'recommendations', 'paidMessageSummary', 'aiSearchSummary', 'untrustedReviewerNotes',
]);

function canonicalize(value: unknown): EvidenceValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : undefined;
  if (Array.isArray(value)) return value.map(canonicalize).filter((item): item is EvidenceValue => item !== undefined);
  if (!value || typeof value !== 'object') return undefined;

  const canonical: {[key: string]: EvidenceValue} = {};
  for (const key of Object.keys(value).sort()) {
    if (EXCLUDED_KEYS.has(key)) continue;
    const normalized = canonicalize((value as Record<string, unknown>)[key]);
    if (normalized !== undefined) canonical[key] = normalized;
  }
  return canonical;
}

/** Canonical stable-key SHA-256 for the exact curated evidence package. */
export function fingerprintEvidence(evidence: unknown): string {
  // Prepared packages explicitly isolate citations under `evidence`. Fingerprinting
  // that exact payload keeps publication/review prose out while retaining nested
  // observed fields such as quality-issue summaries as real evidence.
  const packageEvidence = evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    && Array.isArray((evidence as Record<string, unknown>).evidence)
    ? {
      companyId: (evidence as Record<string, unknown>).companyId,
      canonicalDomain: (evidence as Record<string, unknown>).canonicalDomain,
      evidence: (evidence as Record<string, unknown>).evidence,
    }
    : evidence;
  const canonical = canonicalize(packageEvidence);
  if (canonical === undefined) throw new TypeError('evidence must be JSON-serializable');
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
