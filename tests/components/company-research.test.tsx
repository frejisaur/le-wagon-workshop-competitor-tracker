import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, within, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {CompanyWorkspace, parseCompanyTab, serializeCompanyTab} from '@/components/company/CompanyWorkspace';
import type {CompanyResponse} from '@/lib/domain/dashboard';

afterEach(cleanup);

const freshness = {lastSuccessfulRunAt: '2026-08-18T12:00:00.000Z', cachedAt: '2026-08-18T12:01:00.000Z', isStale: false};
const observed = (value: number | null) => ({classification: 'observed' as const, value, source: 'semrush', database: 'ca', observedAt: '2026-08-18T12:00:00.000Z'});
const calculated = (value: number | null) => ({classification: 'calculated' as const, value, source: 'semrush', database: 'ca', calculatedAt: '2026-08-18T12:00:00.000Z'});

const company: CompanyResponse = {
  companyId: 'alpha', identity: {domain: 'alpha.example', displayName: 'Alpha', country: 'Canada', segment: 'Enterprise'}, status: 'succeeded', freshness,
  kpis: {authorityScore: observed(42), organicTraffic: observed(12_000), organicTraffic30DayMovement: calculated(0.15), organicKeywords: observed(900), aiBenchmarkGap: calculated(0.2), referringDomains: observed(450)},
  trend: [
    {date: '2024-08-01', organicTraffic: calculated(9_000)},
    {date: '2024-09-01', organicTraffic: calculated(null)},
    {date: '2026-08-01', organicTraffic: calculated(12_000)},
  ],
  demand: {nonBrandShare: calculated(0.7)},
  keywords: [{keywordId: 'keyword-alpha', classification: 'observed', keyword: 'competitor research', landingUrl: 'https://alpha.example/research', position: 1, volume: 800, cpcUsd: 4.5, difficulty: 40, traffic: 100, intents: ['informational']}],
  landingPages: [{normalizedLandingUrl: 'https://alpha.example/research', keywordCount: 1, estimatedTraffic: 100, keywords: ['competitor research']}],
  competitors: [{domain: 'alpha.example', organicTraffic: 40_000, organicKeywords: 4_000, commonKeywords: 300}, {domain: 'rival.example', organicTraffic: 8_000, organicKeywords: null, commonKeywords: 24}],
  countries: [{country: 'Canada', mentions: 5, visibility: 0.5}, {country: 'Zero country', mentions: 0, visibility: 0}],
  ai: {visibility: observed(0.3), benchmark: observed(0.1), byLlm: [{llm: 'ChatGPT', mentions: 4, selfMentions: 1, citedPages: 2}]},
  authority: {backlinks: observed(1_200), referringDomains: observed(450), followBacklinks: observed(900), noFollowBacklinks: observed(300)},
  publishedInsightState: 'absent', evidence: [],
};

describe('company research workspace', () => {
  it('strictly bounds and canonically serializes supported workspace tabs', () => {
    expect(parseCompanyTab('?tab=unknown', true)).toBe('overview');
    expect(parseCompanyTab('?tab=paid', false)).toBe('overview');
    expect(parseCompanyTab('?tab=authority', false)).toBe('authority');
    expect(serializeCompanyTab('overview', false)).toBe('');
    expect(serializeCompanyTab('paid', false)).toBe('');
    expect(serializeCompanyTab('ai', false)).toBe('tab=ai');
  });

  it('renders observed samples, a continuous ledger, visual gaps, and omits paid when meaningful activity is absent', () => {
    const {container} = render(<CompanyWorkspace company={company} initialTab="overview" />);
    expect(screen.getAllByText(/observed sample/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('tab', {name: /paid activity/i})).not.toBeInTheDocument();
    expect(screen.getByText('No meaningful paid-search activity was observed in this enrichment.')).toBeInTheDocument();
    expect(screen.getByRole('list', {name: /key metrics/i})).toHaveClass('kpi-ledger');
    expect(screen.getByTestId('historical-chart')).toHaveAttribute('data-gap-count', '1');
    expect(screen.getByRole('table', {name: /organic traffic historical data/i})).toHaveTextContent('Not available');
    expect(within(screen.getByRole('table', {name: /organic competitors/i})).queryByText('alpha.example')).not.toBeInTheDocument();
    expect(screen.queryByText('Zero country')).not.toBeInTheDocument();
    expect(container.querySelector('.company-workspace__tabs')).toBeInTheDocument();
  });

  it('uses exact source and database provenance in the historical metric disclosure', async () => {
    const user = userEvent.setup();
    render(<CompanyWorkspace company={company} initialTab="overview" />);
    const point = screen.getByRole('button', {name: /2024-08-01.*9,000/i});
    await user.click(point);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Date: 2024-08-01');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Source: semrush');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Database: ca');
  });

  it('keeps valid summary data when the authority subsection is malformed', () => {
    const malformed = {...company, authority: {backlinks: {...observed(1200), value: 'bad'} as never, referringDomains: observed(450), followBacklinks: observed(900), noFollowBacklinks: observed(300)}};
    render(<CompanyWorkspace company={malformed} initialTab="authority" />);
    expect(screen.getByRole('heading', {name: /alpha/i})).toBeInTheDocument();
    expect(screen.getByText(/authority detail is unavailable/i)).toBeInTheDocument();
  });

  it('synchronizes tab selection with history and Carbon keyboard tab behavior', async () => {
    const user = userEvent.setup();
    render(<CompanyWorkspace company={company} initialTab="overview" />);
    const search = screen.getByRole('tab', {name: 'Search'});
    await user.click(search);
    expect(window.location.search).toBe('?tab=search');
    expect(search).toHaveAttribute('aria-selected', 'true');
    window.history.pushState(null, '', '?tab=ai');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.getByRole('tab', {name: /ai presence/i})).toHaveAttribute('aria-selected', 'true'));
    screen.getByRole('tab', {name: /ai presence/i}).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', {name: 'Authority'})).toHaveFocus();
  });

  it('caps explicit comparison input deterministically and renders responsive chart/table hooks', () => {
    const comparison = [company, {...company, companyId: 'bravo', identity: {...company.identity, domain: 'bravo.example'}}, {...company, companyId: 'charlie', identity: {...company.identity, domain: 'charlie.example'}}, {...company, companyId: 'delta', identity: {...company.identity, domain: 'delta.example'}}, {...company, companyId: 'echo', identity: {...company.identity, domain: 'echo.example'}}];
    const {container} = render(<CompanyWorkspace company={company} initialTab="overview" comparison={comparison} />);
    expect(screen.getByText(/first 3 comparison companies/i)).toBeInTheDocument();
    expect(screen.getByTestId('historical-chart')).toHaveAttribute('data-comparison-count', '3');
    expect(within(screen.getByRole('list', {name: /comparison companies/i})).getAllByRole('listitem')).toHaveLength(3);
    expect(container.querySelector('.company-workspace__ledger')).toBeInTheDocument();
    expect(container.querySelector('.historical-chart__canvas')).toBeInTheDocument();
    const styles = readFileSync('components/company/company.module.scss', 'utf8');
    expect(styles).toContain('.company-workspace__ledger');
    expect(styles).toContain('@media (max-width: 767px)');
    expect(styles).toContain('min-height: var(--company-chart-min-height)');
  });

  it('renders complete tab modules and preserves retained data across partial, stale, and failure states', async () => {
    const {rerender} = render(<CompanyWorkspace company={{...company, paid: {traffic: observed(10), keywords: observed(2), ads: [{paidAdId: 'ad-1', keyword: 'alpha', title: 'Alpha ad', landingUrl: 'https://alpha.example/ad', position: 1}]}}} initialTab="paid" />);
    expect(screen.getByRole('heading', {name: /paid activity/i})).toBeInTheDocument();
    rerender(<CompanyWorkspace company={{...company, status: 'partial', recoveryMessage: 'Some company fields are unavailable.'}} initialTab="ai" />);
    expect(screen.getByText('Some company fields are unavailable.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', {name: /ai presence/i})).toBeInTheDocument());
    rerender(<CompanyWorkspace company={{...company, status: 'stale', recoveryMessage: 'Data is stale but remains available.'}} initialTab="search" />);
    expect(screen.getByText(/data is stale/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', {name: /core keyword evidence/i})).toBeInTheDocument());
  });
});
