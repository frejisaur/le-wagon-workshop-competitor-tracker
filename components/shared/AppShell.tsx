import type {ReactNode} from 'react';
import type {DashboardStatus, Freshness as FreshnessValue} from '@/lib/domain/dashboard';
import {Freshness} from './Freshness';
import {SkipLink} from './SkipLink';
import {WorkflowStatus} from './WorkflowStatus';

export function AppShell({children, status = 'succeeded', freshness, breadcrumb = 'Competitive landscape'}: {children: ReactNode; status?: DashboardStatus; freshness?: FreshnessValue; breadcrumb?: string}) {
  return <div className="app-shell">
    <SkipLink />
    <header className="app-shell__header">
      <a className="app-shell__mark" href="/">Competitor intelligence</a>
      <span className="app-shell__breadcrumb">{breadcrumb}</span>
      <div className="app-shell__status">{freshness ? <Freshness freshness={freshness} /> : <WorkflowStatus status={status} />}</div>
    </header>
    <div className="app-shell__body">
      <aside className="app-shell__sidebar"><nav aria-label="Primary"><ul className="app-shell__nav-list"><li><a className="app-shell__nav-link" href="/" aria-current="page">All companies</a></li></ul></nav></aside>
      <div className="app-shell__content"><main id="main-content" tabIndex={-1}>{children}</main></div>
    </div>
  </div>;
}
