import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, within, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {CompanyWorkspace, parseCompanyTab, serializeCompanyTab} from '@/components/company/CompanyWorkspace';
import {companyDestination} from '@/components/company/CompanySwitcher';
import type {CompanyResponse} from '@/lib/domain/dashboard';

afterEach(cleanup);

const freshness = {lastSuccessfulRunAt: '2026-08-18T12:00:00.000Z', cachedAt: '2026-08-18T12:01:00.000Z', isStale: false};
const observed = (value: number | null) => ({classification: 'observed' as const, value, source: 'semrush', database: 'ca', observedAt: '2026-08-18T12:00:00.000Z'});
const calculated = (value: number | null) => ({classification: 'calculated' as const, value, source: 'semrush', database: 'ca', calculatedAt: '2026-08-18T12:00:00.000Z'});

const company: CompanyResponse = {
  companyId: 'alpha', identity: {domain: 'alpha.example', displayName: 'Alpha', country: 'Canada', segment: 'Enterprise'}, status: 'succeeded', freshness, enrichedAt: '2026-08-18T12:00:00.000Z',
  kpis: {authorityScore: observed(42), organicTraffic: observed(12_000), organicTraffic30DayMovement: calculated(0.15), organicKeywords: observed(900), aiBenchmarkGap: calculated(-2), referringDomains: observed(450)},
  trend: [
    {date: '2024-08-01', organicTraffic: calculated(9_000)},
    {date: '2024-09-01', organicTraffic: calculated(null)},
    {date: '2026-08-01', organicTraffic: calculated(12_000)},
  ],
  demand: {nonBrandShare: calculated(0.7)},
  keywords: [{keywordId: 'keyword-alpha', classification: 'observed', keyword: 'competitor research', landingUrl: 'https://alpha.example/research', position: 1, volume: 800, cpcUsd: 4.5, difficulty: 40, traffic: 100, intents: ['informational']}],
  landingPages: [{normalizedLandingUrl: 'https://alpha.example/research', keywordCount: 1, estimatedTraffic: 100, keywords: ['competitor research']}],
  competitors: [{domain: 'alpha.example', organicTraffic: 40_000, organicKeywords: 4_000, commonKeywords: 300}, {domain: 'rival.example', organicTraffic: 8_000, organicKeywords: null, commonKeywords: 24}],
  countries: [{country: 'ca', mentions: 5, visibility: 16}, {country: 'us', mentions: 0, visibility: 0}],
  ai: {visibility: observed(29), benchmark: observed(31), mentions: observed(583), citedPages: observed(208), byLlm: [{llm: 'ChatGPT', mentions: 182, selfMentions: 1, citedPages: 82}], topCitedSources: [{domain: 'source.example', mentions: 17}]},
  authority: {backlinks: observed(1_200), referringDomains: observed(450), followBacklinks: observed(900), noFollowBacklinks: observed(300)},
  publishedInsightState: 'absent', evidence: [],
};

describe('company research workspace', () => {
  it('preserves the active workspace when switching companies', () => {
    expect(companyDestination('bravo/id', 'ai')).toBe('/companies/bravo%2Fid?tab=ai');
    expect(companyDestination('bravo/id', 'overview')).toBe('/companies/bravo%2Fid');
  });

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

  it('prioritizes a granular AI summary and formats visibility as points', () => {
    render(<CompanyWorkspace company={company} initialTab="overview" />);
    const aiHeading = screen.getByRole('heading', {name: 'AI presence'});
    const historyHeading = screen.getByRole('heading', {name: /historical organic reach/i});
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);

    expect(aiHeading.compareDocumentPosition(historyHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabs.slice(0, 3)).toEqual(['Overview', 'AI presence', 'Search']);
    expect(screen.getByText('−2 pts')).toBeInTheDocument();
    expect(screen.getByText('583')).toBeInTheDocument();
    expect(screen.getByText('208')).toBeInTheDocument();
  });

  it('shows complete observed AI evidence with human geography and compact provenance', () => {
    render(<CompanyWorkspace company={company} initialTab="ai" />);

    expect(screen.getByText('29 pts')).toBeInTheDocument();
    expect(screen.getByText('31 pts')).toBeInTheDocument();
    expect(screen.getByText('Canada')).toBeInTheDocument();
    expect(screen.getByText('16 pts')).toBeInTheDocument();
    expect(screen.getByText('source.example')).toBeInTheDocument();
    expect(screen.getByText('View provenance')).toBeInTheDocument();
    expect(screen.queryByText(/cited-source domains are not available/i)).not.toBeInTheDocument();
  });

  it('uses a searchable company combobox and exposes local enrichment status', () => {
    const comparisons = [{...company, companyId: 'bravo', identity: {...company.identity, displayName: 'Bravo', domain: 'bravo.example'}}];
    render(<CompanyWorkspace company={company} initialTab="ai" comparison={comparisons} />);

    expect(screen.getByRole('combobox', {name: /change company/i})).toBeInTheDocument();
    expect(screen.queryByRole('navigation', {name: /other companies/i})).not.toBeInTheDocument();
    expect(screen.getByText('Enriched 2026-08-18 12:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('Status: Data current')).toBeInTheDocument();
  });

  it('keeps workspace tabs readable as a horizontal rail on narrow screens', () => {
    const styles = readFileSync('components/company/company-enhancements.module.scss', 'utf8');
    expect(styles).toMatch(/\.tabs\s+\[role='tablist'\][\s\S]*overflow-x:\s*auto/);
    expect(styles).toMatch(/\.tabs\s+\[role='tab'\][\s\S]*flex:\s*0 0 auto/);
    expect(styles).toMatch(/\.tabs\s+\[role='tab'\][\s\S]*white-space:\s*nowrap/);
    expect(styles).toMatch(/\.tabs\s+\[role='tab'\][\s\S]*padding-inline:\s*var\(--space-4\)/);
  });

  it('defensively excludes an already-parseable self competitor URL with default port and path', () => {
    render(<CompanyWorkspace company={{...company, competitors: [{domain: 'https://www.alpha.example:443/path', organicTraffic: 99, organicKeywords: 999, commonKeywords: 1}, {domain: 'rival.example', organicTraffic: 8_000, organicKeywords: 20, commonKeywords: 24}]}} initialTab="overview" />);
    const table = screen.getByRole('table', {name: /organic competitors/i});
    expect(within(table).queryByText('https://www.alpha.example:443/path')).not.toBeInTheDocument();
    expect(within(table).getByText('rival.example')).toBeInTheDocument();
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
    expect(screen.getByRole('tab', {name: 'Search'})).toHaveFocus();
  });

  it('caps explicit comparison input deterministically and renders responsive chart/table hooks', () => {
    const comparison = [company, {...company, companyId: 'bravo', identity: {...company.identity, domain: 'bravo.example'}}, {...company, companyId: 'charlie', identity: {...company.identity, domain: 'charlie.example'}}, {...company, companyId: 'delta', identity: {...company.identity, domain: 'delta.example'}}, {...company, companyId: 'echo', identity: {...company.identity, domain: 'echo.example'}}];
    const {container} = render(<CompanyWorkspace company={company} initialTab="overview" comparison={comparison} />);
    expect(screen.getByLabelText(/add comparison/i)).toBeInTheDocument();
    expect(screen.getByTestId('historical-chart')).toHaveAttribute('data-comparison-count', '0');
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

  it('labels and displays paid competitor traffic and keywords without organic competitor fields', () => {
    render(<CompanyWorkspace company={{...company, paid: {traffic: observed(10), keywords: observed(2), ads: []}, paidCompetitors: {classification: 'observed', source: 'semrush', database: 'ca', observedAt: '2026-08-18T12:00:00.000Z', rows: [{domain: 'paid-rival.example', paidTraffic: 71, paidKeywords: 17, commonKeywords: 1}]}}} initialTab="paid" />);
    const table = screen.getByRole('table', {name: /paid competitors/i});
    expect(within(table).getByRole('columnheader', {name: /paid traffic/i})).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', {name: /paid keywords/i})).toBeInTheDocument();
    expect(within(table).getByText('71')).toBeInTheDocument();
    expect(within(table).getByText('17')).toBeInTheDocument();
  });

  it('sizes the demand band from the validated 70/30 composition instead of equal segments', () => {
    render(<CompanyWorkspace company={company} initialTab="overview" />);
    expect(screen.getByText(/Calculated from the latest branded and non-brand organic traffic trend evidence/i)).toBeInTheDocument();
    expect(screen.getByText('Non-brand 70%')).toHaveStyle({flexGrow: '0.7'});
    expect(screen.getByText('Branded 30%')).toHaveStyle({flexGrow: '0.30000000000000004'});
  });

  it('keeps foreign query keys out of the canonical workspace URL', async () => {
    render(<CompanyWorkspace company={company} initialSearch="?tab=ai&claim=claim-1&foreign=value" />);
    await waitFor(() => expect(window.location.search).toBe('?tab=ai'));
    window.history.pushState(null, '', '?tab=bad&foreign=value');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('lets researchers choose at most two additional curated comparisons and shows their dated values', async () => {
    const user = userEvent.setup();
    const comparisons = [
      {...company, companyId: 'bravo', identity: {...company.identity, displayName: 'Bravo', domain: 'bravo.example'}, trend: [{date: '2024-08-01', organicTraffic: calculated(8_000)}]},
      {...company, companyId: 'charlie', identity: {...company.identity, displayName: 'Charlie', domain: 'charlie.example'}, trend: [{date: '2024-08-01', organicTraffic: calculated(null)}]},
      {...company, companyId: 'delta', identity: {...company.identity, displayName: 'Delta', domain: 'delta.example'}, trend: [{date: '2024-08-01', organicTraffic: calculated(4_000)}]},
    ];
    render(<CompanyWorkspace company={company} initialTab="overview" comparison={comparisons} />);
    const picker = screen.getByLabelText(/add comparison/i);
    await user.selectOptions(picker, 'bravo');
    await user.selectOptions(picker, 'charlie');
    expect(screen.getByRole('table', {name: /organic traffic historical data/i})).toHaveTextContent('Bravo');
    expect(screen.getByRole('table', {name: /organic traffic historical data/i})).toHaveTextContent('8,000');
    expect(screen.getByRole('table', {name: /organic traffic historical data/i})).toHaveTextContent('Charlie');
    expect(screen.getAllByTestId('historical-comparison-series')).toHaveLength(2);
    expect(screen.getByText('Comparison limit reached: select at most two additional companies.')).toBeInTheDocument();
    expect(picker).toBeDisabled();
  });

  it('renders observed keyword CPC, difficulty, and intents without replacing missing values with zero', () => {
    render(<CompanyWorkspace company={company} initialTab="search" />);
    const table = screen.getByRole('table', {name: /observed keyword sample/i});
    expect(within(table).getByRole('columnheader', {name: /cpc usd/i})).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', {name: /difficulty/i})).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', {name: /intents/i})).toBeInTheDocument();
    expect(within(table).getByText('4.5')).toBeInTheDocument();
    expect(within(table).getByText('informational')).toBeInTheDocument();
  });

  it('fails soft when paid input is malformed and excludes URL access to the paid tab', () => {
    const malformed = {...company, paid: {traffic: observed(4), keywords: observed(1), ads: null} as never};
    render(<CompanyWorkspace company={malformed} initialSearch="?tab=paid" />);
    expect(screen.queryByRole('tab', {name: /paid activity/i})).not.toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /alpha/i})).toBeInTheDocument();
  });
});
