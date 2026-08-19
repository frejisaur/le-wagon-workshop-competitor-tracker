import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import type {LandscapeResponse} from '@/lib/domain/dashboard';
import {LandscapeScreen} from '@/components/landscape/LandscapeScreen';
import {parseLandscapeState, serializeLandscapeState} from '@/components/landscape/filter-state';

afterEach(cleanup);

const freshness = {lastSuccessfulRunAt: '2026-08-18T12:00:00.000Z', cachedAt: '2026-08-18T12:01:00.000Z', isStale: false};
const observed = (value: number | null) => ({classification: 'observed' as const, value, source: 'semrush'});
const calculated = (value: number | boolean | null) => ({classification: 'calculated' as const, value});

const fixture: LandscapeResponse = {
  status: 'succeeded', freshness,
  kpis: {
    companiesTracked: calculated(3), combinedOrganicTraffic: {...calculated(null), coverage: {available: 2, total: 3}}, organicKeywordFootprint: {...calculated(null), coverage: {available: 2, total: 3}}, growingCompanies: {...calculated(null), coverage: {available: 2, total: 3}}, paidActiveCompanies: {...calculated(null), coverage: {available: 2, total: 3}},
  },
  companies: [
    {companyId: 'alpha', domain: 'alpha.example', displayName: 'Alpha', country: 'Canada', segment: 'Enterprise', authorityScore: observed(42), organicTraffic: observed(12_000), organicTraffic30DayMovement: calculated(0.15), nonBrandShare: calculated(0.7), organicKeywords: observed(900), paidActivity: calculated(true), aiBenchmarkGap: calculated(0.2), referringDomains: observed(450), freshness},
    {companyId: 'bravo', domain: 'bravo.example', displayName: 'Bravo', country: 'United States', segment: 'Mid-market', authorityScore: observed(65), organicTraffic: observed(8_000), organicTraffic30DayMovement: calculated(-0.03), nonBrandShare: calculated(0.3), organicKeywords: observed(500), paidActivity: calculated(false), aiBenchmarkGap: calculated(-0.1), referringDomains: observed(750), freshness},
    {companyId: 'charlie', domain: 'charlie.example', displayName: 'Charlie', authorityScore: observed(null), organicTraffic: observed(null), organicTraffic30DayMovement: calculated(null), nonBrandShare: calculated(null), organicKeywords: observed(null), paidActivity: calculated(null), aiBenchmarkGap: calculated(null), referringDomains: observed(null), freshness},
  ],
  marketMap: [
    {companyId: 'alpha', authorityScore: 42, organicTraffic: 12_000, trafficShare: 0.6, aiBenchmarkGap: 0.2},
    {companyId: 'bravo', authorityScore: 65, organicTraffic: 8_000, trafficShare: 0.4, aiBenchmarkGap: -0.1},
    {companyId: 'charlie', authorityScore: null, organicTraffic: null, trafficShare: null, aiBenchmarkGap: null},
  ],
  signals: [
    {companyId: 'alpha', kind: 'growth', value: 0.15, period: '30 days'}, {companyId: 'alpha', kind: 'paid_activity', value: 1, period: 'current'}, {companyId: 'alpha', kind: 'ai_outperformance', value: 0.2, period: 'current'}, {companyId: 'alpha', kind: 'non_brand_demand', value: 0.7, period: 'current'}, {companyId: 'bravo', kind: 'growth', value: 0.02, period: '30 days'},
  ],
  filters: {countries: ['Canada'], segments: ['Enterprise'], paidActivityAvailable: true, aiPerformanceAvailable: true},
};

describe('competitive landscape', () => {
  it('strictly bounds and canonically serializes the supported URL state', () => {
    const parsed = parseLandscapeState('?paid=bogus&ai=outperforming&trafficMin=-4&trafficMax=bad&authorityMin=80&authorityMax=10&sort=traffic-desc&selectedCompany=alpha&unknown=value', {companyIds: new Set(['alpha'])});
    expect(parsed).toMatchObject({ai: 'outperforming', sort: 'traffic-desc', selectedCompany: 'alpha'});
    expect(parsed.paid).toBeUndefined();
    expect(parsed.trafficMin).toBeUndefined();
    expect(parsed.authorityMin).toBeUndefined();
    expect(serializeLandscapeState(parsed)).toBe('ai=outperforming&sort=traffic-desc&selectedCompany=alpha');
  });

  it('applies paid filtering coherently without resetting the chosen sort', async () => {
    const user = userEvent.setup();
    render(<LandscapeScreen initialData={fixture} initialSearch="?sort=traffic-desc" />);
    await user.selectOptions(screen.getByLabelText('Paid activity'), 'active');
    expect(screen.getByTestId('market-map')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('landscape-kpis')).toHaveTextContent('1');
    expect(within(screen.getByRole('table', {name: /company leaderboard/i})).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('columnheader', {name: /estimated organic traffic/i})).toHaveAttribute('aria-sort', 'descending');
    expect(window.location.search).toContain('sort=traffic-desc');
  });

  it('links map selection, table selection, focus, and keyboard traversal in leaderboard order', async () => {
    const user = userEvent.setup();
    render(<LandscapeScreen initialData={fixture} />);
    const alphaPoint = screen.getByRole('button', {name: /alpha.*authority 42.*traffic 12,000/i});
    await user.click(alphaPoint);
    const alphaRow = screen.getByRole('row', {name: /alpha.*alpha\.example/i});
    expect(alphaRow).toHaveAttribute('aria-selected', 'true');
    expect(alphaRow).toHaveFocus();
    alphaPoint.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', {name: /bravo.*authority 65.*traffic 8,000/i})).toHaveFocus();
  });

  it('renders a labeled logarithmic market map with one structured equivalent table and excludes unavailable log points', () => {
    render(<LandscapeScreen initialData={fixture} />);
    expect(screen.getByTestId('market-map')).toHaveTextContent(/organic traffic \(logarithmic scale\)/i);
    expect(screen.getByRole('table', {name: /market map accessible data/i})).toBeInTheDocument();
    expect(within(screen.getByRole('table', {name: /market map accessible data/i})).queryByText(/charlie/i)).not.toBeInTheDocument();
    expect(screen.getByText(/unavailable values.*excluded/i)).toBeInTheDocument();
  });

  it('shows missing values, range validation, constraint-specific empty state, and clear only for active filters', async () => {
    const user = userEvent.setup();
    render(<LandscapeScreen initialData={fixture} />);
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', {name: /clear filters/i})).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Traffic minimum'));
    await user.type(screen.getByLabelText('Traffic minimum'), '999999');
    await user.click(screen.getByRole('button', {name: /apply numeric filters/i}));
    expect(screen.getByRole('heading', {name: /no companies match/i})).toBeInTheDocument();
    expect(screen.getByText(/traffic at least 999,999/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /clear filters/i})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: /clear filters/i}));
    expect(screen.queryByRole('heading', {name: /no companies match/i})).not.toBeInTheDocument();
  });

  it('uses responsive class hooks for one semantic table source and does not expose raw reference payloads', () => {
    const {container} = render(<LandscapeScreen initialData={fixture} />);
    expect(container.querySelector('.company-leaderboard')).toHaveClass('company-leaderboard');
    expect(container.querySelector('.company-leaderboard__mobile-disclosure')).toBeInTheDocument();
    expect(readFileSync('styles/globals.scss', 'utf8')).toContain('.company-leaderboard__mobile-disclosure');
    expect(container.innerHTML).not.toMatch(/rec[A-Za-z0-9]|airtable|apiToken/i);
  });

  it('maps loading, empty, partial, stale, and failed response states through the shared screen state', () => {
    const {rerender} = render(<LandscapeScreen initialData={{...fixture, status: 'loading'}} />);
    expect(screen.getByTestId('screen-skeleton')).toBeInTheDocument();
    rerender(<LandscapeScreen initialData={{...fixture, status: 'empty', companies: []}} />);
    expect(screen.getByRole('heading', {name: /no companies have been imported/i})).toBeInTheDocument();
    rerender(<LandscapeScreen initialData={{...fixture, status: 'partial', recoveryMessage: 'Some companies failed. Available company data remains visible.'}} />);
    expect(screen.getByText(/some companies failed/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /company leaderboard/i})).toBeInTheDocument();
    rerender(<LandscapeScreen initialData={{...fixture, status: 'stale', recoveryMessage: 'Data is stale but remains available.'}} />);
    expect(screen.getByText(/data is stale/i)).toBeInTheDocument();
    rerender(<LandscapeScreen initialData={{...fixture, status: 'failed', companies: []}} />);
    expect(screen.getByText(/refresh failed. retry/i)).toBeInTheDocument();
  });
});
