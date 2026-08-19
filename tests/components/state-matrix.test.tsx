import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CompanyWorkspace} from '@/components/company/CompanyWorkspace';
import {companyDestination} from '@/components/company/CompanySwitcher';
import {LandscapeScreen} from '@/components/landscape/LandscapeScreen';
import {ScreenState} from '@/components/shared/ScreenState';
import {companyStates} from '@/tests/fixtures/api/company-states';
import {dashboardStates} from '@/tests/fixtures/api/dashboard-states';

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

describe('dashboard state matrix', () => {
  it('uses a geometry-matched skeleton only when no cache is retained', () => {
    const {rerender} = render(<LandscapeScreen initialData={dashboardStates.loading} />);
    expect(screen.getByTestId('screen-skeleton')).toHaveAttribute('data-geometry', 'dashboard');
    expect(screen.queryByRole('heading', {name: /company leaderboard/i})).not.toBeInTheDocument();
    rerender(<LandscapeScreen initialData={dashboardStates.refreshing} />);
    expect(screen.queryByTestId('screen-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /company leaderboard/i})).toBeInTheDocument();
  });

  it.each([
    ['refreshing', /refresh running/i], ['stale', /data is stale but remains available/i], ['partial', /some companies failed/i], ['failedWithData', /refresh failed.*last successful data/i],
  ] as const)('keeps the retained landscape visible for %s', (state, message) => {
    render(<LandscapeScreen initialData={dashboardStates[state]} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /company leaderboard/i})).toBeInTheDocument();
  });

  it('announces completed outcomes and filter counts politely without announcing in-progress refreshes', () => {
    const {rerender} = render(<LandscapeScreen initialData={dashboardStates.refreshing} />);
    expect(screen.getByText(/refresh running/i)).not.toHaveAttribute('aria-live');
    expect(screen.getByText(/3 companies across/i)).toHaveAttribute('aria-live', 'polite');
    rerender(<LandscapeScreen initialData={dashboardStates.partial} />);
    expect(screen.getByText(/some companies failed/i)).toHaveAttribute('aria-live', 'polite');
  });

  it('renders empty and named no-result recovery states and returns focus after clearing constraints', async () => {
    const user = userEvent.setup();
    const empty = render(<LandscapeScreen initialData={dashboardStates.empty} />);
    expect(screen.getByRole('heading', {name: /no companies have been imported/i})).toBeInTheDocument();
    empty.unmount();
    render(<LandscapeScreen initialData={dashboardStates.noResults} initialSearch="?trafficMin=999999" />);
    expect(screen.getByText(/traffic at least 999,999/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: /clear filters/i}));
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveFocus());
    expect(screen.getByRole('heading', {name: /company leaderboard/i})).toBeInTheDocument();
  });

  it('offers a focused retry action for failed refresh recovery', async () => {
    const retry = vi.fn(); const user = userEvent.setup();
    render(<ScreenState status="failed" hasRetainedData onRetry={retry}><p>Retained landscape</p></ScreenState>);
    const control = screen.getByRole('button', {name: 'Retry refresh'});
    control.focus();
    await user.keyboard('{Enter}');
    expect(retry).toHaveBeenCalledOnce();
    expect(control).toHaveFocus();
  });

  it('covers no-paid, review, published-plus-review, and fingerprint-mismatch company states', () => {
    const noPaid = render(<CompanyWorkspace company={companyStates.noPaid} initialTab="overview" />);
    expect(screen.queryByRole('tab', {name: /paid activity/i})).not.toBeInTheDocument();
    expect(screen.getByText(/no meaningful paid-search activity/i)).toBeInTheDocument();
    noPaid.unmount();
    const review = render(<CompanyWorkspace company={companyStates.reviewRequired} initialTab="battlecard" />);
    expect(screen.getByText('Insight review required')).toBeInTheDocument();
    review.unmount();
    const published = render(<CompanyWorkspace company={companyStates.publishedPlusReview} initialTab="battlecard" />);
    expect(screen.getByText('Search demand supports a focused competitive response.')).toBeInTheDocument();
    expect(screen.getByText('Insight review required')).toBeInTheDocument();
    published.unmount();
    render(<CompanyWorkspace company={companyStates.fingerprintMismatch} initialTab="battlecard" />);
    expect(screen.getByText('Insight stale')).toBeInTheDocument();
    expect(screen.queryByText('Search demand supports a focused competitive response.')).not.toBeInTheDocument();
  });

  it('provides same-origin company navigation that preserves the active workspace tab', () => {
    render(<CompanyWorkspace company={companyStates.current} comparison={[companyStates.noPaid, companyStates.fingerprintMismatch]} initialTab="authority" />);
    expect(screen.getByRole('combobox', {name: /change company/i})).toBeInTheDocument();
    expect(companyDestination('bravo', 'authority')).toBe('/companies/bravo?tab=authority');
    expect(companyDestination('charlie', 'authority')).toBe('/companies/charlie?tab=authority');
  });
});
