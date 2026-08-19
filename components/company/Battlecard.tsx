import type {CompanyResponse} from '@/lib/domain/dashboard';
import styles from './company.module.scss';

type PublishedInsight = NonNullable<CompanyResponse['publishedInsight']>;

export function Battlecard({state, insight, review, onTrace}: {state: CompanyResponse['publishedInsightState']; insight?: PublishedInsight; review?: CompanyResponse['reviewCandidate']; onTrace: (claimId: string, refs: string[]) => void}) {
  if (state === 'stale') return <section className={styles.battlecard} aria-labelledby="battlecard-heading"><h2 id="battlecard-heading">Battlecard</h2><p className={styles.insightStale} role="status">Insight stale</p><p>The published interpretation no longer matches the current evidence and is withheld.</p></section>;
  if (!insight) return <section className={styles.battlecard} aria-labelledby="battlecard-heading"><h2 id="battlecard-heading">Battlecard</h2><p>No published insight is available for this company.</p></section>;
  const observed = insight.claims.filter((claim) => claim.classification === 'observed');
  const inferred = insight.claims.filter((claim) => claim.classification === 'inferred');
  const lead = insight.claims[0];
  const claims = (title: string, items: PublishedInsight['claims']) => items.length ? <section className={styles.battlecardClaims} aria-labelledby={`${title}-heading`}><h3 id={`${title}-heading`}>{title}</h3>{items.map((claim) => <article key={claim.claimId} id={`claim-${claim.claimId}`} data-testid={`claim-${claim.claimId}`} className={styles.battlecardClaim} tabIndex={-1}><p>{claim.conclusion}</p><p className={styles.claimMeta}><span>{claim.classification === 'observed' ? 'Observed' : 'Agent interpretation'}</span><span>Confidence: {claim.confidence}</span></p><p className={styles.claimReason}>{claim.confidenceReason}</p><a href={`?tab=evidence&claim=${encodeURIComponent(claim.claimId)}&evidence=${encodeURIComponent(claim.evidenceRefs.join(','))}`} onClick={(event) => { event.preventDefault(); onTrace(claim.claimId, claim.evidenceRefs); }}>{claim.evidenceRefs.length} linked observation{claim.evidenceRefs.length === 1 ? '' : 's'}</a></article>)}</section> : null;
  return <section className={styles.battlecard} aria-labelledby="battlecard-heading">
    <h2 id="battlecard-heading">Battlecard</h2>
    <section className={styles.battlecardLead} aria-label="Published conclusion"><p className={styles.eyebrow}>Published agent interpretation</p><h3>{lead?.conclusion}</h3><p>Confidence: {insight.overallConfidence ?? lead?.confidence ?? 'Not available'}</p></section>
    {review ? <section className={styles.insightReview} role="status" aria-label="Insight review required"><strong>Insight review required</strong>{review.reasons.length ? <p>{review.reasons.join(', ')}</p> : null}</section> : null}
    {claims('Observed claims', observed)}
    {claims('Inferred recommendations', inferred)}
    <footer className={styles.battlecardMetadata}><p>Evidence fingerprint: {insight.workflow.evidenceFingerprint}</p><p>Generated: {insight.generatedAt ?? 'Not available'}</p><p>Run {insight.workflow.runId} · {insight.workflow.harness} · {insight.workflow.model} · skill {insight.workflow.skillVersion} · workflow {insight.workflow.workflowVersion}</p></footer>
  </section>;
}
