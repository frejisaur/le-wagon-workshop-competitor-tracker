import {createHash} from 'node:crypto';
import type {EvidenceValue} from '@/lib/agents/types';

function canonicalize(value: unknown): EvidenceValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('evidence must be JSON-serializable');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('evidence must be JSON-serializable');

  const canonical: {[key: string]: EvidenceValue} = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = canonicalize((value as Record<string, unknown>)[key]);
    canonical[key] = normalized;
  }
  return canonical;
}

/** Canonical stable-key SHA-256 for the exact curated evidence package. */
export function fingerprintEvidence(evidence: unknown): string {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new TypeError('evidence must be a prepared package');
  const pkg = evidence as Record<string, unknown>;
  if (typeof pkg.companyId !== 'string' || !Array.isArray(pkg.evidence)) throw new TypeError('evidence must be a prepared package');
  // Only this top-level projection omits operational/publication metadata. Every
  // nested evidence key is canonicalized losslessly and therefore affects the hash.
  const canonical = canonicalize({companyId: pkg.companyId, canonicalDomain: typeof pkg.canonicalDomain === 'string' ? pkg.canonicalDomain : null, evidence: pkg.evidence});
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
