import type {CompanyResponse} from '@/lib/domain/dashboard';
import styles from './company.module.scss';

type Evidence = CompanyResponse['evidence'][number];
type Workflow = NonNullable<CompanyResponse['publishedInsight']>['workflow'];

function safeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return 'Not available'; }
}

export function EvidenceRow({evidence, highlighted, workflow}: {evidence: Evidence; highlighted: boolean; workflow?: Workflow}) {
  const timestamp = evidence.observedAt ?? evidence.calculatedAt;
  return <article id={`evidence-${encodeURIComponent(evidence.ref)}`} className={`${styles.evidenceRow} ${highlighted ? styles.evidenceRowHighlighted : ''}`} data-testid={highlighted ? 'highlighted-evidence' : 'evidence-row'} aria-label={`Evidence ${evidence.ref}`}>
    <header className={styles.evidenceRowHeader}><code>{evidence.ref}</code><span>{evidence.classification}</span></header>
    <dl className={styles.evidenceDetails}>
      <div><dt>Source</dt><dd>{evidence.source}</dd></div>
      {evidence.database ? <div><dt>Database</dt><dd>{evidence.database}</dd></div> : null}
      {timestamp ? <div><dt>Timestamp</dt><dd><time dateTime={timestamp}>{timestamp}</time></dd></div> : null}
      <div><dt>Raw source</dt><dd>Raw source reference unavailable in browser</dd></div>
    </dl>
    <pre className={styles.evidenceValue}>{safeValue(evidence.value)}</pre>
    {workflow ? <dl className={styles.evidenceWorkflow} aria-label="Published insight workflow metadata">
      <div><dt>Fingerprint</dt><dd>{workflow.evidenceFingerprint}</dd></div><div><dt>Run ID</dt><dd>{workflow.runId}</dd></div><div><dt>Harness</dt><dd>{workflow.harness}</dd></div><div><dt>Model</dt><dd>{workflow.model}</dd></div><div><dt>Skill version</dt><dd>{workflow.skillVersion}</dd></div><div><dt>Workflow version</dt><dd>{workflow.workflowVersion}</dd></div>
    </dl> : null}
  </article>;
}
