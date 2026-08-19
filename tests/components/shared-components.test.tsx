import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import type {DashboardValue, Freshness as FreshnessValue} from '@/lib/domain/dashboard';
import {AppShell} from '@/components/shared/AppShell';
import {Freshness} from '@/components/shared/Freshness';
import {KpiLedger} from '@/components/shared/KpiLedger';
import {ScreenState} from '@/components/shared/ScreenState';
import {WorkflowStatus} from '@/components/shared/WorkflowStatus';

const observed = (value: DashboardValue['value']): DashboardValue => ({classification: 'observed', value, source: 'semrush'});
const calculated = (value: DashboardValue['value']): DashboardValue => ({classification: 'calculated', value, calculatedAt: '2026-08-18T12:00:00.000Z'});
const inferred = (value: DashboardValue['value']): DashboardValue => ({classification: 'inferred', value});

afterEach(cleanup);

describe('shared dashboard components', () => {
  it('renders one five-value ledger with classification, movement text, and explicit unknowns', () => {
    render(<KpiLedger metrics={[
      {label: 'Companies', value: calculated(52)},
      {label: 'Organic traffic', value: observed(1200), movement: {value: calculated(0.12), format: 'percent', trend: 'beneficial'}},
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

  it('owns one main landmark and moves focus there through the skip link', async () => {
    const user = userEvent.setup();
    render(<AppShell status="partial"><h1>Landscape</h1></AppShell>);
    const main = screen.getByRole('main');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('navigation', {name: /primary/i})).toHaveLength(1);
    const skipLink = screen.getByRole('link', {name: /skip to content/i});
    expect(skipLink).toHaveAttribute('href', '#main-content');
    await user.tab();
    expect(skipLink).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(main).toHaveFocus();
    expect(screen.getByText('Some companies failed')).toBeInTheDocument();
  });

  it('keeps movement provenance distinct and styles from caller-provided semantic trend', () => {
    render(<KpiLedger metrics={[
      {label: 'Conversion risk', value: observed(8), movement: {value: calculated(0.12), format: 'percent', trend: 'adverse'}},
      {label: 'Unknown movement', value: observed(3), movement: {value: calculated(null), trend: 'neutral'}},
    ]} />);
    const adverse = screen.getByText('Increased 12%');
    expect(adverse).toHaveAttribute('data-trend', 'adverse');
    expect(within(adverse.parentElement!).getByText(/calculated movement/i)).toBeInTheDocument();
    expect(screen.getByText('Movement not available')).toHaveAttribute('data-trend', 'neutral');
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

  it('retains content during loading/running and never promises a failed snapshot that is absent', () => {
    const {rerender} = render(<ScreenState status="loading" hasRetainedData><p>Retained landscape</p></ScreenState>);
    expect(screen.getByText('Refresh running')).toBeInTheDocument();
    expect(screen.getByText('Retained landscape')).toBeInTheDocument();
    rerender(<ScreenState status="running" hasRetainedData announce><p>Retained landscape</p></ScreenState>);
    expect(screen.getByText('Refresh running')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getAllByText('Refresh running')).toHaveLength(1);
    rerender(<ScreenState status="failed" />);
    expect(screen.getByText(/refresh failed. retry the refresh/i)).toBeInTheDocument();
    expect(screen.queryByText(/last successful data remains available/i)).not.toBeInTheDocument();
  });

  it('renders a five-cell ledger-shaped loading skeleton plus empty and unknown recovery states', () => {
    const {rerender} = render(<ScreenState status="loading" />);
    expect(screen.getByTestId('screen-skeleton')).toHaveAttribute('data-geometry', 'dashboard');
    expect(screen.getByTestId('screen-skeleton')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByTestId('kpi-skeleton-cell')).toHaveLength(5);
    rerender(<ScreenState status="empty" />);
    expect(screen.getByRole('heading', {name: /no companies have been imported/i})).toBeInTheDocument();
    rerender(<ScreenState status="unknown" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not determine the dashboard state/i);
  });

  it('opens freshness disclosure with click/keyboard and closes it with Escape', async () => {
    const user = userEvent.setup();
    const freshness: FreshnessValue = {lastSuccessfulRunAt: '2026-08-18T12:34:00.000Z', cachedAt: '2026-08-18T12:35:00.000Z', isStale: false};
    render(<Freshness freshness={freshness} />);
    const control = screen.getByRole('button', {name: 'Data current'});
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('tooltip', {hidden: true})).toHaveAttribute('hidden');
    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(control).toHaveAccessibleDescription('Last successful refresh: 2026-08-18 12:34 UTC');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Last successful refresh: 2026-08-18 12:34 UTC');
    await user.keyboard('{Escape}');
    expect(control).toHaveAttribute('aria-expanded', 'false');
    await user.click(control);
    expect(control).toHaveAttribute('aria-expanded', 'true');
  });

  it('defines the approved semantic tokens and reduced-motion behavior', () => {
    const tokens = readFileSync('styles/tokens.css', 'utf8');
    const styles = readFileSync('styles/globals.scss', 'utf8');
    expect(tokens).toContain('--color-canvas: #f3f6f7');
    expect(tokens).toContain('--color-accent: #245eb5');
    expect(tokens).toContain('--font-interface: var(--font-ibm-plex-sans)');
    expect(tokens).toContain('--space-7: 48px');
    expect(tokens).toContain('--radius-panel: 6px');
    expect(tokens).toContain('--layer-modal: 80');
    expect(tokens).toContain('--breakpoint-desktop-min: 1280px');
    expect(tokens).toContain('--motion-evidence: 160ms');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain("@use '@carbon/styles/scss/reset'");
    expect(styles).toContain("@use '@carbon/styles/scss/theme'");
    expect(styles).not.toMatch(/(?:linear|radial)-gradient|box-shadow/);
  });

  it('allows literal lengths only in the documented breakpoint media queries', () => {
    const styles = readFileSync('styles/globals.scss', 'utf8');
    const authoredRules = styles.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/@media \((?:min|max)-width: (?:767|768|1280|1440)px\)/g, '@media (approved-breakpoint)');
    expect(authoredRules).not.toMatch(/(?<![\w-])(?:[1-9]\d*(?:\.\d+)?)(?:px|rem|ms)\b|#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
    expect(styles).toContain('CSS custom properties cannot be evaluated in media-query conditions');
    expect(styles).toContain('.screen-skeleton__ledger .kpi-ledger');
  });
});
