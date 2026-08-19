import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {CompanyWorkspace} from '@/components/company/CompanyWorkspace';
import {parseEvidenceNavigation, serializeEvidenceNavigation} from '@/components/company/evidence-navigation';
import type {CompanyResponse} from '@/lib/domain/dashboard';

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/companies/alpha'); });

const at = '2026-08-18T12:00:00.000Z';
const observed = (value: number | null) => ({classification: 'observed' as const, value, source: 'semrush', database: 'ca', observedAt: at});
const calculated = (value: number | null) => ({classification: 'calculated' as const, value, source: 'semrush', database: 'ca', calculatedAt: at});
const company: CompanyResponse = {
  companyId: 'alpha', identity: {domain: 'alpha.example', displayName: 'Alpha'}, status: 'succeeded', freshness: {lastSuccessfulRunAt: at, cachedAt: at, isStale: false},
  kpis: {authorityScore: observed(40), organicTraffic: observed(200), organicTraffic30DayMovement: calculated(.1), organicKeywords: observed(20), aiBenchmarkGap: calculated(.1), referringDomains: observed(12)},
  trend: [], demand: {nonBrandShare: calculated(.5)}, keywords: [], landingPages: [], competitors: [], countries: [], ai: {visibility: observed(null), benchmark: observed(null), byLlm: []}, authority: {backlinks: observed(null), referringDomains: observed(null), followBacklinks: observed(null), noFollowBacklinks: observed(null)},
  publishedInsightState: 'current',
  publishedInsight: {overallConfidence: 'high', generatedAt: at, workflow: {evidenceFingerprint: 'fingerprint-current', runId: 'run-sanitized', harness: 'fixture-harness', model: 'fixture-model', skillVersion: '1.0.0', workflowVersion: '1.0.0'}, claims: [
    {claimId: 'claim-observed', conclusion: 'Observed traffic signal', classification: 'observed', confidence: 'high', confidenceReason: 'Direct provider observation.', evidenceRefs: ['company:alpha:traffic', 'keyword:alpha:one']},
    {claimId: 'claim-recommendation', conclusion: 'Prioritize the observed demand.', classification: 'inferred', confidence: 'medium', confidenceReason: 'The sample is limited.', evidenceRefs: ['keyword:alpha:one']},
  ]},
  evidence: [
    {ref: 'company:alpha:traffic', classification: 'observed', source: 'semrush', database: 'ca', observedAt: at, value: '<img src=x onerror=alert(1)>'},
    {ref: 'keyword:alpha:one', classification: 'observed', source: 'semrush', database: 'ca', observedAt: at, value: {keyword: '<script>alert(1)</script>'}},
  ],
};

describe('battlecard evidence trace', () => {
  it('opens exact evidence, highlights it, and returns focus to the originating claim', async () => {
    const user = userEvent.setup();
    render(<CompanyWorkspace company={company} initialTab="battlecard" />);
    const trace = screen.getByRole('link', {name: '2 linked observations'});
    trace.focus();
    await user.click(trace);
    expect(screen.getByRole('tab', {name: 'Evidence'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByTestId('highlighted-evidence')).toHaveLength(2);
    expect(window.location.search).toBe('?tab=evidence&claim=claim-observed&evidence=company%3Aalpha%3Atraffic%2Ckeyword%3Aalpha%3Aone');
    await user.click(screen.getByRole('button', {name: /return to claim/i}));
    await waitFor(() => expect(screen.getByTestId('claim-claim-observed')).toHaveFocus());
  });

  it('keeps published content while a review candidate needs review, and withholds stale claims', () => {
    const {rerender} = render(<CompanyWorkspace company={{...company, reviewCandidate: {status: 'needs_review', reasons: ['insufficient_evidence']}}} initialTab="battlecard" />);
    expect(screen.getByText('Insight review required')).toBeInTheDocument();
    expect(screen.getAllByText('Observed traffic signal').length).toBeGreaterThan(0);
    rerender(<CompanyWorkspace company={{...company, publishedInsightState: 'stale', publishedInsight: undefined}} initialTab="battlecard" />);
    expect(screen.getByText('Insight stale')).toBeInTheDocument();
    expect(screen.queryByText('Observed traffic signal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /publish/i})).not.toBeInTheDocument();
  });

  it('strictly bounds and canonicalizes evidence URLs to current members', () => {
    const knownClaims = new Set(['claim-observed']); const knownRefs = new Set(['company:alpha:traffic', 'keyword:alpha:one']);
    expect(parseEvidenceNavigation('?tab=evidence&claim=claim-observed&evidence=keyword%3Aalpha%3Aone,foreign,keyword%3Aalpha%3Aone&x=1', knownClaims, knownRefs)).toEqual({tab: 'evidence', claimId: 'claim-observed', evidenceRefs: ['keyword:alpha:one']});
    expect(parseEvidenceNavigation('?tab=evidence&claim=missing&evidence=missing', knownClaims, knownRefs)).toEqual({tab: 'evidence', evidenceRefs: []});
    expect(serializeEvidenceNavigation({tab: 'evidence', claimId: 'claim-observed', evidenceRefs: Array.from({length: 101}, (_, index) => `r${index}`)}, knownClaims, new Set(Array.from({length: 101}, (_, index) => `r${index}`)))).toContain('evidence=r0%2Cr1');
  });

  it('renders evidence as escaped text without raw references and provides a direct-link fallback', () => {
    const {container} = render(<CompanyWorkspace company={company} initialSearch="?tab=evidence&claim=claim-observed&evidence=company%3Aalpha%3Atraffic" />);
    expect(screen.getAllByText(/Raw source reference unavailable in browser/i)).toHaveLength(2);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /return to battlecard/i})).toBeInTheDocument();
    expect(screen.getAllByText('run-sanitized')).toHaveLength(2);
    expect(screen.getAllByText('fixture-harness')).toHaveLength(2);
  });

  it('handles direct and popstate evidence URLs without stealing focus or retaining foreign targets', async () => {
    render(<CompanyWorkspace company={company} initialTab="battlecard" />);
    const outside = document.createElement('button'); document.body.append(outside); outside.focus();
    window.history.pushState(null, '', '?tab=evidence&claim=foreign&evidence=foreign');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(screen.getByRole('tab', {name: 'Evidence'})).toHaveAttribute('aria-selected', 'true'));
    expect(document.activeElement).toBe(outside);
    expect(screen.queryByTestId('highlighted-evidence')).not.toBeInTheDocument();
    outside.remove();
  });

  it('uses the required persistent highlight and reduced-motion behavior', () => {
    const styles = readFileSync('components/company/company.module.scss', 'utf8');
    expect(styles).toContain('var(--motion-evidence)');
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });
});
