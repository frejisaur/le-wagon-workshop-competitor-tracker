import {readFileSync} from 'node:fs';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {CompanyWorkspace} from '@/components/company/CompanyWorkspace';
import {MAX_EVIDENCE_TRACE_QUERY_BYTES, parseEvidenceNavigation, serializeEvidenceNavigation} from '@/components/company/evidence-navigation';
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
    expect(window.location.search).toBe('?tab=evidence&claim=claim-observed&evidence=company%253Aalpha%253Atraffic%2Ckeyword%253Aalpha%253Aone');
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

  it('losslessly traces candidate-length references containing commas and falls back to claim-only under the URL budget', async () => {
    const user = userEvent.setup();
    const longRef = `ref-${'x'.repeat(253)}`; const commaRef = 'keyword:alpha:one,variant';
    const refs = new Set([longRef, commaRef]); const claims = new Set(['claim-observed']);
    const encoded = serializeEvidenceNavigation({tab: 'evidence', claimId: 'claim-observed', evidenceRefs: [longRef, commaRef]}, claims, refs);
    expect(parseEvidenceNavigation(`?${encoded}`, claims, refs)?.evidenceRefs).toEqual([longRef, commaRef]);
    const commaCompany: CompanyResponse = {...company, publishedInsight: {...company.publishedInsight!, claims: [{...company.publishedInsight!.claims[0]!, evidenceRefs: [longRef, commaRef]}]}, evidence: [longRef, commaRef].map((ref) => ({ref, classification: 'observed' as const, source: 'semrush', observedAt: at, value: ref}))};
    const commaView = render(<CompanyWorkspace company={commaCompany} initialTab="battlecard" />);
    await user.click(screen.getByRole('link', {name: '2 linked observations'}));
    expect(screen.getAllByTestId('highlighted-evidence')).toHaveLength(2);
    expect(screen.getAllByText(commaRef)).toHaveLength(2);
    commaView.unmount();
    const oversizedRefs = Array.from({length: 4}, (_, index) => `ref-${index}-${'x'.repeat(490)}`);
    const oversized = serializeEvidenceNavigation({tab: 'evidence', claimId: 'claim-observed', evidenceRefs: oversizedRefs}, claims, new Set(oversizedRefs));
    expect(oversized).toBe('tab=evidence&claim=claim-observed');
    expect(new TextEncoder().encode(oversized).byteLength).toBeLessThanOrEqual(MAX_EVIDENCE_TRACE_QUERY_BYTES);
    const oversizedCompany: CompanyResponse = {...company, publishedInsight: {...company.publishedInsight!, claims: [{...company.publishedInsight!.claims[0]!, evidenceRefs: oversizedRefs}]}, evidence: oversizedRefs.map((ref) => ({ref, classification: 'observed' as const, source: 'semrush', observedAt: at, value: ref}))};
    render(<CompanyWorkspace company={oversizedCompany} initialTab="battlecard" />);
    await user.click(screen.getByRole('link', {name: '4 linked observations'}));
    expect(window.location.search).toBe('?tab=evidence&claim=claim-observed');
    expect(screen.getAllByTestId('highlighted-evidence')).toHaveLength(4);
  });

  it('never emits a trace query above the UTF-8 budget for a valid multibyte claim ID', () => {
    const claimId = '調'.repeat(200); const refs = Array.from({length: 4}, (_, index) => `ref-${index}-${'x'.repeat(490)}`);
    const serialized = serializeEvidenceNavigation({tab: 'evidence', claimId, evidenceRefs: refs}, new Set([claimId]), new Set(refs));
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(MAX_EVIDENCE_TRACE_QUERY_BYTES);
    expect(serialized).toBe('tab=evidence');
    expect(parseEvidenceNavigation(`?${serialized}`, new Set([claimId]), new Set(refs))).toEqual({tab: 'evidence', evidenceRefs: []});
  });

  it('leads with the inferred interpretation and separates its claim confidence from the overall insight confidence', () => {
    render(<CompanyWorkspace company={{...company, publishedInsight: {...company.publishedInsight!, overallConfidence: 'low'}}} initialTab="battlecard" />);
    const lead = screen.getByLabelText('Published conclusion');
    expect(lead).toHaveTextContent('Prioritize the observed demand.');
    expect(lead).toHaveTextContent('Agent interpretation');
    expect(lead).toHaveTextContent('Claim confidence: medium');
    expect(screen.getByText('Overall insight confidence: low')).toBeInTheDocument();
    expect(screen.getAllByTestId('claim-claim-recommendation')).toHaveLength(1);
  });

  it('labels an observed lead as an observed finding when no inferred interpretation exists', () => {
    render(<CompanyWorkspace company={{...company, publishedInsight: {...company.publishedInsight!, claims: [company.publishedInsight!.claims[0]!]}}} initialTab="battlecard" />);
    expect(screen.getByLabelText('Published conclusion')).toHaveTextContent('Observed finding');
    expect(screen.getByLabelText('Published conclusion')).toHaveTextContent('Claim confidence: high');
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

  it('renders only safe review reason copy and never displays stored review text', () => {
    render(<CompanyWorkspace company={{...company, reviewCandidate: {status: 'needs_review', reasons: ['insufficient_evidence', 'prompt_injection_content']}}} initialTab="battlecard" />);
    expect(screen.getByText(/More supporting evidence is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Untrusted content requires review/i)).toBeInTheDocument();
    expect(screen.queryByText('prompt_injection_content')).not.toBeInTheDocument();
  });

  it('uses the required persistent highlight and reduced-motion behavior', () => {
    const styles = readFileSync('components/company/company.module.scss', 'utf8');
    expect(styles).toContain('var(--motion-evidence)');
    expect(styles).toContain('prefers-reduced-motion: reduce');
  });
});
