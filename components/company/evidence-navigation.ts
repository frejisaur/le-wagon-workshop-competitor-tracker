import type {CompanyTab} from './CompanyWorkspace';

export const MAX_EVIDENCE_REFS = 100;
export const MAX_EVIDENCE_TRACE_QUERY_BYTES = 1_800;
const MAX_CLAIM_ID_LENGTH = 200;
const MAX_EVIDENCE_REF_LENGTH = 500;

export type EvidenceNavigation = {tab: 'evidence'; claimId?: string; evidenceRefs: string[]};

function safe(value: string, maximum: number): boolean {
  return value.length > 0 && value.length <= maximum && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function orderedMembers(values: readonly string[], members?: ReadonlySet<string>): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!safe(value, MAX_EVIDENCE_REF_LENGTH) || (members && !members.has(value)) || result.includes(value)) continue;
    result.push(value);
    if (result.length === MAX_EVIDENCE_REFS) break;
  }
  return result;
}

function decodeRef(value: string): string | undefined {
  try { const decoded = decodeURIComponent(value); return safe(decoded, MAX_EVIDENCE_REF_LENGTH) ? decoded : undefined; } catch { return undefined; }
}

function byteLength(value: string): number { return new TextEncoder().encode(value).byteLength; }

/** Parses only the trace allow-list. Each reference is individually encoded, so commas round-trip. */
export function parseEvidenceNavigation(search: string, claimIds?: ReadonlySet<string>, evidenceRefs?: ReadonlySet<string>): EvidenceNavigation | null {
  const input = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(input);
  if (params.get('tab') !== 'evidence') return null;
  const rawClaim = params.get('claim') ?? undefined;
  const claimId = rawClaim && safe(rawClaim, MAX_CLAIM_ID_LENGTH) && (!claimIds || claimIds.has(rawClaim)) ? rawClaim : undefined;
  if (byteLength(input) > MAX_EVIDENCE_TRACE_QUERY_BYTES) return {tab: 'evidence', ...(claimId ? {claimId} : {}), evidenceRefs: []};
  const refs = orderedMembers((params.get('evidence') ?? '').split(',').flatMap((value) => { const decoded = decodeRef(value); return decoded ? [decoded] : []; }), evidenceRefs);
  return {tab: 'evidence', ...(claimId ? {claimId} : {}), evidenceRefs: refs};
}

/** Canonical query order is tab, claim, evidence and is capped for shareable URLs. */
export function serializeEvidenceNavigation(navigation: EvidenceNavigation, claimIds?: ReadonlySet<string>, evidenceRefs?: ReadonlySet<string>): string {
  const claimId = navigation.claimId && safe(navigation.claimId, MAX_CLAIM_ID_LENGTH) && (!claimIds || claimIds.has(navigation.claimId)) ? navigation.claimId : undefined;
  const refs = orderedMembers(navigation.evidenceRefs, evidenceRefs);
  const params = new URLSearchParams(); params.set('tab', 'evidence'); if (claimId) params.set('claim', claimId);
  if (refs.length) params.set('evidence', refs.map(encodeURIComponent).join(','));
  const serialized = params.toString();
  if (byteLength(serialized) <= MAX_EVIDENCE_TRACE_QUERY_BYTES) return serialized;
  const fallback = new URLSearchParams(); fallback.set('tab', 'evidence'); if (claimId) fallback.set('claim', claimId);
  return fallback.toString();
}

export function canonicalWorkspaceSearch(tab: CompanyTab, paidAvailable: boolean, navigation: EvidenceNavigation | null, claimIds: ReadonlySet<string>, evidenceRefs: ReadonlySet<string>): string {
  if (tab === 'evidence') return serializeEvidenceNavigation(navigation ?? {tab: 'evidence', evidenceRefs: []}, claimIds, evidenceRefs);
  return tab !== 'overview' && (tab !== 'paid' || paidAvailable) ? `tab=${tab}` : '';
}
