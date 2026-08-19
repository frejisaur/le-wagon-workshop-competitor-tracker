import type {ReactNode} from 'react';
import type {DashboardStatus} from '@/lib/domain/dashboard';

export type ScreenStatus = DashboardStatus | 'unknown';

const defaultRecovery: Partial<Record<DashboardStatus, string>> = {
  partial: 'Some companies failed. Available company data remains visible.',
  stale: 'Data is stale but remains available.',
  failed: 'Refresh failed. Last successful data remains available.',
};

function DashboardSkeleton() {
  return <div className="screen-skeleton" data-testid="screen-skeleton" data-geometry="dashboard" aria-busy="true" aria-label="Loading dashboard">
    <div className="screen-skeleton__title" />
    <div className="screen-skeleton__ledger"><div className="kpi-ledger">{Array.from({length: 5}, (_, index) => <div className="kpi-ledger__item screen-skeleton__kpi-cell" data-testid="kpi-skeleton-cell" key={index}><span /><strong /><span /></div>)}</div></div>
    <div className="screen-skeleton__modules"><div className="screen-skeleton__panel" /><div className="screen-skeleton__panel" /></div>
  </div>;
}

export function ScreenState({status, hasRetainedData = false, recoveryMessage, announce = false, children}: {status: ScreenStatus; hasRetainedData?: boolean; recoveryMessage?: string; announce?: boolean; children?: ReactNode}) {
  if (status === 'loading' && !hasRetainedData) return <DashboardSkeleton />;
  if (status === 'empty') return <section className="screen-state__empty" aria-labelledby="empty-dashboard-heading"><h2 id="empty-dashboard-heading">No companies have been imported.</h2><p>Import a competitor roster to begin the landscape.</p></section>;
  if (status === 'unknown') return <section className="screen-state__unknown" role="alert" aria-labelledby="unknown-dashboard-heading"><h2 id="unknown-dashboard-heading">We could not determine the dashboard state.</h2><p>Retry the refresh or check the refresh status.</p></section>;
  const message = (status === 'loading' || status === 'running') && hasRetainedData
    ? 'Refresh running'
    : status === 'failed' && !hasRetainedData
      ? 'Refresh failed. Retry the refresh or check the refresh status.'
      : recoveryMessage ?? defaultRecovery[status];
  const liveProps = announce ? {'aria-live': 'polite' as const, 'aria-atomic': true} : {};
  return <section className="screen-state">
    {message ? <p className="screen-state__notice" data-status={status} {...liveProps}>{message}</p> : null}
    {children}
  </section>;
}
