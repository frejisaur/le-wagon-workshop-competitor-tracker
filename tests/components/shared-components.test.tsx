import {readFileSync} from 'node:fs';
import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {DashboardValue, Freshness as FreshnessValue} from '@/lib/domain/dashboard';
import {AppShell} from '@/components/shared/AppShell';
import {Freshness} from '@/components/shared/Freshness';
import {KpiLedger} from '@/components/shared/KpiLedger';
import {ScreenState} from '@/components/shared/ScreenState';
import {WorkflowStatus} from '@/components/shared/WorkflowStatus';

const observed = (value: DashboardValue['value']): DashboardValue => ({classification: 'observed', value, source: 'semrush'});
const calculated = (value: DashboardValue['value']): DashboardValue => ({classification: 'calculated', value, calculatedAt: '2026-08-18T12:00:00.000Z'});
const inferred = (value: DashboardValue['value']): DashboardValue => ({classification: 'inferred', value});

describe('shared dashboard components', () => {
  it('renders one five-value ledger with classification, movement text, and explicit unknowns', () => {
    render(<KpiLedger metrics={[
      {label: 'Companies', value: calculated(52)},
      {label: 'Organic traffic', value: observed(1200), movement: {value: calculated(0.12), format: 'percent'}},
      {label: 'Keywords', value: observed(null)},
      {label: 'Growing', value: calculated(8)},
      {label: 'Recommendation', value: inferred('Investigate')},
    ]} />);

    expect(screen.getByRole('list', {name: /key metrics/i})).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getAllByText(/calculated/i)).not.toHaveLength(0);
    expect(screen.getByText('Increased 12%')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('provides skip navigation and textual workflow status', () => {
    render(<AppShell status="partial"><main id="main-content"><h1>Landscape</h1></main></AppShell>);
    expect(screen.getByRole('link', {name: /skip to content/i})).toHaveAttribute('href', '#main-content');
    expect(screen.getByText('Some companies failed')).toBeInTheDocument();
    expect(screen.getByRole('navigation', {name: /primary/i})).toBeInTheDocument();
  });

  it.each([
    ['succeeded', 'Data current'],
    ['running', 'Refresh running'],
    ['partial', 'Some companies failed'],
    ['failed', 'Refresh failed'],
    ['stale', 'Insight stale'],
  ] as const)('uses status text for %s rather than color alone', (status, label) => {
    const {container} = render(<WorkflowStatus status={status} />);
    expect(within(container).getByText(label)).toHaveAttribute('data-status', status);
  });

  it('keeps retained data visible for stale, partial, and failed states while announcing recovery', () => {
    for (const status of ['stale', 'partial', 'failed'] as const) {
      const {unmount} = render(<ScreenState status={status} hasRetainedData recoveryMessage="Last successful data remains available."><p>Retained landscape</p></ScreenState>);
      expect(screen.getByText('Retained landscape')).toBeInTheDocument();
      expect(screen.getByText('Last successful data remains available.')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders geometry-matched loading, empty, and unknown recovery states', () => {
    const {rerender} = render(<ScreenState status="loading" />);
    expect(screen.getByTestId('screen-skeleton')).toHaveAttribute('data-geometry', 'dashboard');
    expect(screen.getByTestId('screen-skeleton')).toHaveAttribute('aria-busy', 'true');
    rerender(<ScreenState status="empty" />);
    expect(screen.getByRole('heading', {name: /no companies have been imported/i})).toBeInTheDocument();
    rerender(<ScreenState status="unknown" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not determine the dashboard state/i);
  });

  it('exposes exact freshness information through a keyboard-accessible tooltip', () => {
    const freshness: FreshnessValue = {lastSuccessfulRunAt: '2026-08-18T12:34:00.000Z', cachedAt: '2026-08-18T12:35:00.000Z', isStale: false};
    render(<Freshness freshness={freshness} />);
    const control = screen.getByRole('button', {name: /data current/i});
    expect(control).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Last successful refresh: 2026-08-18 12:34 UTC');
  });

  it('defines the approved semantic tokens and reduced-motion behavior', () => {
    const tokens = readFileSync('styles/tokens.css', 'utf8');
    const styles = readFileSync('styles/globals.scss', 'utf8');
    expect(tokens).toContain('--color-canvas: #f3f6f7');
    expect(tokens).toContain('--color-accent: #245eb5');
    expect(tokens).toContain('--font-interface: "IBM Plex Sans"');
    expect(tokens).toContain('--space-7: 48px');
    expect(tokens).toContain('--radius-panel: 6px');
    expect(tokens).toContain('--layer-modal: 80');
    expect(tokens).toContain('--breakpoint-desktop-min: 1280px');
    expect(tokens).toContain('--motion-evidence: 160ms');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).not.toMatch(/(?:linear|radial)-gradient|box-shadow/);
  });
});
