import {useEffect, useMemo} from 'react';
import type {CompanyResponse} from '@/lib/domain/dashboard';
import {EvidenceRow} from './EvidenceRow';
import styles from './company.module.scss';

export function EvidenceWorkspace({evidence, workflow, highlightedRefs, claimId, traceInitiated, hasTraceOrigin, onReturn, onHighlightFocusMoved}: {evidence: CompanyResponse['evidence']; workflow?: NonNullable<CompanyResponse['publishedInsight']>['workflow']; highlightedRefs: string[]; claimId?: string; traceInitiated: boolean; hasTraceOrigin: boolean; onReturn: () => void; onHighlightFocusMoved: () => void}) {
  const highlightSet = useMemo(() => new Set(highlightedRefs), [highlightedRefs]);
  useEffect(() => {
    if (!traceInitiated || highlightedRefs.length === 0) return;
    document.getElementById(`evidence-${encodeURIComponent(highlightedRefs[0]!)}`)?.scrollIntoView({block: 'nearest'});
  }, [highlightedRefs, traceInitiated]);
  const returnLabel = hasTraceOrigin && claimId ? 'Return to claim' : 'Return to battlecard';
  return <section className={styles.evidenceWorkspace} aria-labelledby="evidence-heading" onFocusCapture={(event) => { if (event.target instanceof HTMLButtonElement) onHighlightFocusMoved(); }}><header><h2 id="evidence-heading">Evidence</h2><p>Supporting observed and calculated records for the current published insight.</p>{highlightedRefs.length ? <p>{highlightedRefs.length} selected evidence record{highlightedRefs.length === 1 ? '' : 's'}.</p> : null}<button type="button" className="cds--btn cds--btn--tertiary" onClick={onReturn}>{returnLabel}</button></header><div className={styles.evidenceRows}>{evidence.map((item) => <EvidenceRow key={item.ref} evidence={item} highlighted={highlightSet.has(item.ref)} workflow={workflow} />)}{evidence.length === 0 ? <p>No curated evidence records are available.</p> : null}</div></section>;
}
