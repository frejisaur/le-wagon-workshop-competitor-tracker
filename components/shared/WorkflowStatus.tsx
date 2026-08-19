import type {DashboardStatus} from '@/lib/domain/dashboard';

const statusLabels: Record<DashboardStatus, string> = {
  loading: 'Loading data',
  empty: 'No companies imported',
  running: 'Refresh running',
  succeeded: 'Data current',
  partial: 'Some companies failed',
  failed: 'Refresh failed',
  stale: 'Insight stale',
};

export function workflowStatusLabel(status: DashboardStatus): string {
  return statusLabels[status];
}

export function WorkflowStatus({status, announce = false}: {status: DashboardStatus; announce?: boolean}) {
  const liveProps = announce ? {'aria-live': 'polite' as const, 'aria-atomic': true} : {};
  return <span className="workflow-status" data-status={status} {...liveProps}>{workflowStatusLabel(status)}</span>;
}
