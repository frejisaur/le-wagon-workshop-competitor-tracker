import type {CompanyTab} from './CompanyWorkspace';

export const MAX_EVIDENCE_REFS = 100;
const MAX_IDENTIFIER_LENGTH = 256;

export type EvidenceNavigation = {
  tab: 'evidence';
  claimId?: string;
  evidenceRefs: string[];
};

function isSafeIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

function orderedMembers(values: readonly string[], members?: ReadonlySet<string>): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!isSafeIdentifier(value) || (members && !members.has(value)) || result.includes(value)) continue;
    result.push(value);
    if (result.length === MAX_EVIDENCE_REFS) break;
  }
  return result;
}

/** Parses only the trace allow-list. Foreign keys and foreign evidence never reach UI state. */
export function parseEvidenceNavigation(search: string, claimIds?: ReadonlySet<string>, evidenceRefs?: ReadonlySet<string>): EvidenceNavigation | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('tab') !== 'evidence') return null;
  const rawClaim = params.get('claim') ?? undefined;
  const claimId = rawClaim && isSafeIdentifier(rawClaim) && (!claimIds || claimIds.has(rawClaim)) ? rawClaim : undefined;
  const refs = orderedMembers((params.get('evidence') ?? '').split(',').filter(Boolean), evidenceRefs);
  return {tab: 'evidence', ...(claimId ? {claimId} : {}), evidenceRefs: refs};
}

/** Canonical query order is tab, claim, evidence; it deliberately has no extensibility keys. */
export function serializeEvidenceNavigation(navigation: EvidenceNavigation, claimIds?: ReadonlySet<string>, evidenceRefs?: ReadonlySet<string>): string {
  const params = new URLSearchParams();
  params.set('tab', 'evidence');
  if (navigation.claimId && isSafeIdentifier(navigation.claimId) && (!claimIds || claimIds.has(navigation.claimId))) params.set('claim', navigation.claimId);
  const refs = orderedMembers(navigation.evidenceRefs, evidenceRefs);
  if (refs.length) params.set('evidence', refs.join(','));
  return params.toString();
}

export function canonicalWorkspaceSearch(tab: CompanyTab, paidAvailable: boolean, navigation: EvidenceNavigation | null, claimIds: ReadonlySet<string>, evidenceRefs: ReadonlySet<string>): string {
  if (tab === 'evidence') return serializeEvidenceNavigation(navigation ?? {tab: 'evidence', evidenceRefs: []}, claimIds, evidenceRefs);
  return tab !== 'overview' && (tab !== 'paid' || paidAvailable) ? `tab=${tab}` : '';
}
