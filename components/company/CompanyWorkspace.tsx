'use client';

import {useEffect, useMemo, useState} from 'react';
import {Select, SelectItem, Tab, TabList, TabPanel, TabPanels, Tabs} from '@carbon/react';
import {z} from 'zod';
import {KpiLedger, type KpiMetric} from '@/components/shared/KpiLedger';
import {ScreenState} from '@/components/shared/ScreenState';
import {CompanyResponseSchema, type CompanyResponse} from '@/lib/domain/dashboard';
import {AiPresence} from './AiPresence';
import {AuthorityDistribution} from './AuthorityDistribution';
import {CompetitorTable} from './CompetitorTable';
import {DemandComposition} from './DemandComposition';
import {HistoricalChart, type ComparisonDataset} from './HistoricalChart';
import {KeywordTable} from './KeywordTable';
import {LandingPagePortfolio} from './LandingPagePortfolio';
import {PaidActivity} from './PaidActivity';
import {Battlecard} from './Battlecard';
import {EvidenceWorkspace} from './EvidenceWorkspace';
import {canonicalWorkspaceSearch, parseEvidenceNavigation, serializeEvidenceNavigation, type EvidenceNavigation} from './evidence-navigation';
import styles from './company.module.scss';

export const companyTabs = ['overview', 'search', 'ai', 'authority', 'paid', 'battlecard', 'evidence'] as const;
export type CompanyTab = (typeof companyTabs)[number];

const labels: Record<CompanyTab, string> = {overview: 'Overview', search: 'Search', ai: 'AI presence', authority: 'Authority', paid: 'Paid activity', battlecard: 'Battlecard', evidence: 'Evidence'};

export function parseCompanyTab(search: string, paidAvailable: boolean): CompanyTab {
  const tab = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tab');
  return companyTabs.includes(tab as CompanyTab) && (tab !== 'paid' || paidAvailable) ? tab as CompanyTab : 'overview';
}

export function serializeCompanyTab(tab: CompanyTab, paidAvailable: boolean): string {
  return tab !== 'overview' && (tab !== 'paid' || paidAvailable) ? `tab=${tab}` : '';
}

function paidMeaningful(paid: CompanyResponse['paid']): boolean {
  if (!paid) return false;
  const traffic = paid.traffic.value; const keywords = paid.keywords.value;
  return paid.ads.length > 0 || (typeof traffic === 'number' && traffic > 0) || (typeof keywords === 'number' && keywords > 0);
}

function valid<T>(schema: z.ZodType<T>, value: unknown): T | undefined { const parsed = schema.safeParse(value); return parsed.success ? parsed.data : undefined; }

type TraceOrigin = {url: string; claimId: string; scrollY: number};
function traceOrigin(value: unknown): TraceOrigin | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>; const origin = record.evidenceTrace;
  if (!origin || typeof origin !== 'object') return undefined;
  const item = origin as Record<string, unknown>;
  if (typeof item.url !== 'string' || typeof item.claimId !== 'string' || typeof item.scrollY !== 'number' || !Number.isFinite(item.scrollY)) return undefined;
  try { const url = new URL(item.url, window.location.origin); return url.origin === window.location.origin && url.pathname === window.location.pathname ? {url: `${url.pathname}${url.search}${url.hash}`, claimId: item.claimId, scrollY: Math.max(0, Math.min(item.scrollY, 1_000_000))} : undefined; } catch { return undefined; }
}

export function CompanyWorkspace({company, initialTab = 'overview', initialSearch, comparison}: {company: CompanyResponse; initialTab?: CompanyTab; initialSearch?: string; comparison?: ComparisonDataset}) {
  const paid = valid(CompanyResponseSchema.shape.paid, company.paid);
  const paidAvailable = paidMeaningful(paid);
  const initial = initialSearch === undefined ? (initialTab === 'paid' && !paidAvailable ? 'overview' : initialTab) : parseCompanyTab(initialSearch, paidAvailable);
  const [tab, setTab] = useState<CompanyTab>(initial);
  const tabs = useMemo(() => companyTabs.filter((item) => item !== 'paid' || paidAvailable), [paidAvailable]);
  const claimIds = useMemo(() => new Set(company.publishedInsightState === 'current' ? (company.publishedInsight?.claims ?? []).map((claim) => claim.claimId) : []), [company.publishedInsight, company.publishedInsightState]);
  const evidenceRefs = useMemo(() => new Set(company.evidence.map((evidence) => evidence.ref)), [company.evidence]);
  const claimEvidence = useMemo(() => new Map((company.publishedInsightState === 'current' ? company.publishedInsight?.claims ?? [] : []).map((claim) => [claim.claimId, claim.evidenceRefs.filter((ref) => evidenceRefs.has(ref))])), [company.publishedInsight, company.publishedInsightState, evidenceRefs]);
  const sourceSearch = initialSearch ?? (typeof window === 'undefined' ? '' : window.location.search);
  const [evidenceNavigation, setEvidenceNavigation] = useState<EvidenceNavigation | null>(() => parseEvidenceNavigation(sourceSearch, claimIds, evidenceRefs));
  const [traceInitiated, setTraceInitiated] = useState(false);
  const authority = valid(CompanyResponseSchema.shape.authority, company.authority);
  const ai = valid(CompanyResponseSchema.shape.ai, company.ai);
  const trend = valid(CompanyResponseSchema.shape.trend, company.trend);
  const demand = valid(CompanyResponseSchema.shape.demand, company.demand);
  const keywords = valid(CompanyResponseSchema.shape.keywords, company.keywords);
  const landingPages = valid(CompanyResponseSchema.shape.landingPages, company.landingPages);
  const competitors = valid(CompanyResponseSchema.shape.competitors, company.competitors);
  const countries = valid(CompanyResponseSchema.shape.countries, company.countries);
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([]);
  const comparisonOptions = useMemo(() => [...(comparison ?? [])].filter((item) => item.companyId !== company.companyId).sort((left, right) => (left.identity.displayName ?? left.identity.domain).localeCompare(right.identity.displayName ?? right.identity.domain)).slice(0, 51), [comparison, company.companyId]);
  const selectedComparisonData = comparisonOptions.filter((item) => selectedComparisons.includes(item.companyId));
  useEffect(() => {
    if (initialSearch === undefined) setTab(initialTab === 'paid' && !paidAvailable ? 'overview' : initialTab);
  }, [initialSearch, initialTab, paidAvailable]);
  useEffect(() => {
    const restore = () => { setTab(parseCompanyTab(window.location.search, paidAvailable)); setEvidenceNavigation(parseEvidenceNavigation(window.location.search, claimIds, evidenceRefs)); setTraceInitiated(false); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [claimIds, evidenceRefs, paidAvailable]);
  useEffect(() => {
    const expected = canonicalWorkspaceSearch(tab, paidAvailable, evidenceNavigation, claimIds, evidenceRefs); const current = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search;
    if (current !== expected) window.history.replaceState(window.history.state, '', expected ? `?${expected}` : window.location.pathname);
  }, [claimIds, evidenceNavigation, evidenceRefs, paidAvailable, tab]);
  const select = (next: CompanyTab) => { if (!tabs.includes(next)) return; setTraceInitiated(false); setEvidenceNavigation(null); setTab(next); const search = next === 'evidence' ? 'tab=evidence' : serializeCompanyTab(next, paidAvailable); window.history.pushState(null, '', search ? `?${search}` : window.location.pathname); };
  const traceEvidence = (claimId: string, refs: string[]) => {
    if (!claimIds.has(claimId)) return;
    const navigation: EvidenceNavigation = {tab: 'evidence', claimId, evidenceRefs: refs.filter((ref, index) => evidenceRefs.has(ref) && refs.indexOf(ref) === index).slice(0, 100)};
    if (!navigation || navigation.evidenceRefs.length === 0) return;
    const origin = {evidenceTrace: {url: `${window.location.pathname}${window.location.search}`, claimId, scrollY: Math.max(0, Math.min(window.scrollY || 0, 1_000_000))}};
    const search = serializeEvidenceNavigation(navigation, claimIds, evidenceRefs);
    window.history.pushState(origin, '', `?${search}`); setEvidenceNavigation(navigation); setTraceInitiated(true); setTab('evidence');
  };
  const returnToClaim = () => {
    const origin = traceOrigin(window.history.state); const claimId = origin?.claimId ?? evidenceNavigation?.claimId;
    const safeClaim = claimId && claimIds.has(claimId) ? claimId : undefined;
    const url = origin?.url ?? `${window.location.pathname}?tab=battlecard`;
    window.history.pushState(null, '', url); setEvidenceNavigation(null); setTraceInitiated(false); setTab('battlecard');
    requestAnimationFrame(() => { if (!navigator.userAgent.includes('jsdom')) { try { window.scrollTo({top: origin?.scrollY ?? 0, behavior: 'auto'}); } catch { /* restricted browsers may not implement scroll restoration */ } } const target = safeClaim ? document.getElementById(`claim-${safeClaim}`) : undefined; target instanceof HTMLElement && target.focus({preventScroll: true}); });
  };
  const metrics: KpiMetric[] = [{label: 'Authority score', value: company.kpis.authorityScore}, {label: 'Estimated organic traffic', value: company.kpis.organicTraffic, movement: {value: company.kpis.organicTraffic30DayMovement, trend: 'beneficial', format: 'percent'}}, {label: 'Organic keywords', value: company.kpis.organicKeywords}, {label: 'AI benchmark gap', value: company.kpis.aiBenchmarkGap, format: 'percent'}, {label: 'Referring domains', value: company.kpis.referringDomains}];
  const comparisonControl = comparisonOptions.length ? <div className="company-workspace__comparison"><Select id="add-comparison" labelText="Add comparison" value="" disabled={selectedComparisons.length >= 2} onChange={(event) => { const next = event.target.value; if (next && selectedComparisons.length < 2) setSelectedComparisons((current) => [...current, next]); }}><SelectItem value="" text={selectedComparisons.length >= 2 ? 'Comparison limit reached' : 'Choose a company'} />{comparisonOptions.filter((item) => !selectedComparisons.includes(item.companyId)).map((item) => <SelectItem key={item.companyId} value={item.companyId} text={item.identity.displayName ?? item.identity.domain} />)}</Select>{selectedComparisons.length >= 2 ? <p>Comparison limit reached: select at most two additional companies.</p> : null}</div> : null;
  const overview = <div className="company-workspace__overview">{comparisonControl}{trend ? <HistoricalChart trend={trend} comparison={selectedComparisonData} /> : <p className="company-module__unavailable">Historical detail is unavailable because the received subsection is malformed.</p>}{demand ? <DemandComposition demand={demand} /> : <p className="company-module__unavailable">Demand detail is unavailable because the received subsection is malformed.</p>}{keywords ? <KeywordTable keywords={keywords} /> : <p className="company-module__unavailable">Keyword detail is unavailable because the received subsection is malformed.</p>}{competitors ? <CompetitorTable competitors={competitors} domain={company.identity.domain} /> : <p className="company-module__unavailable">Competitor detail is unavailable because the received subsection is malformed.</p>}{ai && countries ? <AiPresence ai={ai} countries={countries} /> : <p className="company-module__unavailable">Geographic AI detail is unavailable because the received subsection is malformed.</p>}{!paidAvailable ? <p className="company-workspace__paid-absence">No meaningful paid-search activity was observed in this enrichment.</p> : null}</div>;
  const selectedEvidenceRefs = evidenceNavigation?.evidenceRefs.length ? evidenceNavigation.evidenceRefs : evidenceNavigation?.claimId ? claimEvidence.get(evidenceNavigation.claimId) ?? [] : [];
  const panels: Record<CompanyTab, React.ReactNode> = {overview, search: <div className="company-workspace__search">{keywords ? <><KeywordTable keywords={keywords} /><LandingPagePortfolio landingPages={landingPages ?? []} /></> : <p className="company-module__unavailable">Search detail is unavailable because the received subsection is malformed.</p>}</div>, ai: ai && countries ? <AiPresence ai={ai} countries={countries} /> : <p className="company-module__unavailable">AI detail is unavailable because the received subsection is malformed.</p>, authority: authority ? <AuthorityDistribution authority={authority} /> : <p className="company-module__unavailable">Authority detail is unavailable because the received subsection is malformed.</p>, paid: paidAvailable && paid ? <PaidActivity paid={paid} paidCompetitors={company.paidCompetitors} /> : <p className="company-workspace__paid-absence">No meaningful paid-search activity was observed in this enrichment.</p>, battlecard: <Battlecard state={company.publishedInsightState} insight={company.publishedInsight} review={company.reviewCandidate} onTrace={traceEvidence} />, evidence: <EvidenceWorkspace evidence={company.evidence} workflow={company.publishedInsight?.workflow} highlightedRefs={selectedEvidenceRefs} claimId={evidenceNavigation?.claimId} traceInitiated={traceInitiated} hasTraceOrigin={Boolean(traceOrigin(typeof window === 'undefined' ? null : window.history.state))} onReturn={returnToClaim} onHighlightFocusMoved={() => setEvidenceNavigation((current) => current ? {...current, evidenceRefs: []} : current)} />};
  const selectedIndex = Math.max(0, tabs.indexOf(tab));
  const retained = company.status === 'stale' || company.status === 'partial' || company.status === 'failed' || company.status === 'running';
  return <ScreenState status={company.status} hasRetainedData={retained} recoveryMessage={company.recoveryMessage} announce={company.status !== 'succeeded'}><article className={`${styles.companyWorkspace} company-workspace`}><header className="company-workspace__heading"><h1 className="page-title">{company.identity.displayName ?? company.identity.domain}</h1><p>{company.identity.domain}{company.identity.segment ? ` · ${company.identity.segment}` : ''}{company.identity.country ? ` · ${company.identity.country}` : ''}</p></header><div className="company-workspace__tabs"><Tabs selectedIndex={selectedIndex} onChange={({selectedIndex: next}) => select(tabs[next] ?? 'overview')}><TabList aria-label="Company research areas" activation="automatic" scrollIntoView>{tabs.map((item) => <Tab key={item}>{labels[item]}</Tab>)}</TabList><TabPanels>{tabs.map((item) => <TabPanel key={item}>{item === tab ? <div className="company-workspace__ledger"><KpiLedger metrics={metrics} /></div> : null}{item === tab ? panels[item] : null}</TabPanel>)}</TabPanels></Tabs></div></article></ScreenState>;
}
