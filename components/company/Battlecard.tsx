import type {CompanyResponse} from '@/lib/domain/dashboard';
import type {CandidateReviewReason} from '@/lib/schemas/insight-candidate';
import {serializeEvidenceNavigation} from './evidence-navigation';
import styles from './company.module.scss';

type PublishedInsight = NonNullable<CompanyResponse['publishedInsight']>;
type Claim = PublishedInsight['claims'][number];

const reviewCopy: Record<CandidateReviewReason, string> = {
  insufficient_evidence: 'More supporting evidence is required.',
  conflicting_sources: 'Supporting sources conflict and require review.',
  ambiguous_company_identity: 'Company identity requires review.',
  suspicious_provider_data: 'Provider data requires review.',
  unresolved_evidence_reference: 'Evidence references require review.',
  prompt_injection_content: 'Untrusted content requires review.',
  reviewer_requested_regeneration: 'A refreshed interpretation was requested.',
};

function ClaimCard({claim, lead = false, onTrace}: {claim: Claim; lead?: boolean; onTrace: (claimId: string, refs: string[]) => void}) {
  const href = `?${serializeEvidenceNavigation({tab: 'evidence', claimId: claim.claimId, evidenceRefs: claim.evidenceRefs})}`;
  return <article key={claim.claimId} id={`claim-${claim.claimId}`} data-testid={`claim-${claim.claimId}`} className={lead ? styles.battlecardLead : styles.battlecardClaim} tabIndex={-1} aria-label={lead ? 'Published conclusion' : undefined}>
    {lead ? <p className={styles.eyebrow}>{claim.classification === 'inferred' ? 'Agent interpretation' : 'Observed finding'}</p> : null}
    {lead ? <h3>{claim.conclusion}</h3> : <p>{claim.conclusion}</p>}
    <p className={styles.claimMeta}><span>{claim.classification === 'observed' ? 'Observed' : 'Agent interpretation'}</span><span>Claim confidence: {claim.confidence}</span></p>
    <p className={styles.claimReason}>{claim.confidenceReason}</p>
    <a href={href} onClick={(event) => { event.preventDefault(); onTrace(claim.claimId, claim.evidenceRefs); }}>{claim.evidenceRefs.length} linked observation{claim.evidenceRefs.length === 1 ? '' : 's'}</a>
  </article>;
}

export function Battlecard({state, insight, review, onTrace}: {state: CompanyResponse['publishedInsightState']; insight?: PublishedInsight; review?: CompanyResponse['reviewCandidate']; onTrace: (claimId: string, refs: string[]) => void}) {
  if (state === 'stale') return <section className={styles.battlecard} aria-labelledby="battlecard-heading"><h2 id="battlecard-heading">Battlecard</h2><p className={styles.insightStale} role="status">Insight stale</p><p>The published interpretation no longer matches the current evidence and is withheld.</p></section>;
  if (!insight) return <section className={styles.battlecard} aria-labelledby="battlecard-heading"><h2 id="battlecard-heading">Battlecard</h2><p>No published insight is available for this company.</p></section>;
  const observed = insight.claims.filter((claim) => claim.classification === 'observed');
  const inferred = insight.claims.filter((claim) => claim.classification === 'inferred');
  const lead = inferred[0] ?? observed[0];
  const remaining = (claims: Claim[]) => claims.filter((claim) => claim.claimId !== lead?.claimId);
  const claims = (title: string, items: Claim[]) => items.length ? <section className={styles.battlecardClaims} aria-labelledby={`${title}-heading`}><h3 id={`${title}-heading`}>{title}</h3>{items.map((claim) => <ClaimCard key={claim.claimId} claim={claim} onTrace={onTrace} />)}</section> : null;
  return <section className={styles.battlecard} aria-labelledby="battlecard-heading">
    <h2 id="battlecard-heading">Battlecard</h2>
    {lead ? <ClaimCard claim={lead} lead onTrace={onTrace} /> : null}
    <p className={styles.overallConfidence}>Overall insight confidence: {insight.overallConfidence ?? 'Not available'}</p>
    {review ? <section className={styles.insightReview} role="status" aria-label="Insight review required"><strong>Insight review required</strong><p>{review.reasons.length ? review.reasons.map((reason) => reviewCopy[reason]).join(' ') : 'A newer candidate requires review.'}</p></section> : null}
    {claims('Observed claims', remaining(observed))}
    {claims('Inferred recommendations', remaining(inferred))}
    <footer className={styles.battlecardMetadata}><p>Evidence fingerprint: {insight.workflow.evidenceFingerprint}</p><p>Generated: {insight.generatedAt ?? 'Not available'}</p><p>Run {insight.workflow.runId} · {insight.workflow.harness} · {insight.workflow.model} · skill {insight.workflow.skillVersion} · workflow {insight.workflow.workflowVersion}</p></footer>
  </section>;
}
