'use client';

import {useEffect, useMemo, useState} from 'react';
import type {CompanySummary, DashboardValue, LandscapeResponse} from '@/lib/domain/dashboard';
import {KpiLedger, type KpiMetric} from '@/components/shared/KpiLedger';
import {ScreenState} from '@/components/shared/ScreenState';
import {AttentionSignals} from './AttentionSignals';
import {CompanyLeaderboard} from './CompanyLeaderboard';
import {clearLandscapeFilters, hasActiveFilters, parseLandscapeState, serializeLandscapeState, type LandscapeFilterState} from './filter-state';
import {LandscapeFilters} from './LandscapeFilters';
import {MarketMap} from './MarketMap';
import {deriveAttentionSignals, deriveMapRows, filterCompanies, numeric, sortCompanies} from './selectors';

const integer = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
function aggregate(companies: readonly CompanySummary[], get: (company: CompanySummary) => number | null): DashboardValue {
  const values = companies.map(get); const available = values.filter((value): value is number => value !== null);
  return {classification: 'calculated', value: available.length === values.length ? available.reduce((sum, value) => sum + value, 0) : null, coverage: {available: available.length, total: values.length}};
}
function count(companies: readonly CompanySummary[], predicate: (company: CompanySummary) => boolean | null): DashboardValue {
  const values = companies.map(predicate); const available = values.filter((value): value is boolean => value !== null);
  return {classification: 'calculated', value: available.length === values.length ? available.filter(Boolean).length : null, coverage: {available: available.length, total: values.length}};
}
function activeConstraints(state: LandscapeFilterState): string[] { return [state.paid && `paid activity is ${state.paid === 'unknown' ? 'not available' : state.paid}`, state.ai && `AI performance is ${state.ai.replace('_', ' ')}`, state.trafficMin !== undefined && `traffic at least ${integer.format(state.trafficMin)}`, state.trafficMax !== undefined && `traffic no more than ${integer.format(state.trafficMax)}`, state.authorityMin !== undefined && `authority at least ${integer.format(state.authorityMin)}`, state.authorityMax !== undefined && `authority no more than ${integer.format(state.authorityMax)}`, state.country && `country is ${state.country}`, state.segment && `segment is ${state.segment}`].filter((value): value is string => Boolean(value)); }

export function LandscapeScreen({initialData, initialSearch = ''}: {initialData: LandscapeResponse; initialSearch?: string}) {
  const parseOptions = useMemo(() => ({companyIds: new Set(initialData.companies.map((company) => company.companyId)), countries: new Set(initialData.filters.countries), segments: new Set(initialData.filters.segments)}), [initialData]);
  const [state, setState] = useState(() => parseLandscapeState(initialSearch, parseOptions));
  const [draftResetGeneration, setDraftResetGeneration] = useState(0);
  const [mapFocusRequest, setMapFocusRequest] = useState<{companyId: string; token: number} | undefined>();
  useEffect(() => { const restore = () => { setState(parseLandscapeState(window.location.search, parseOptions)); setDraftResetGeneration((generation) => generation + 1); }; window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore); }, [parseOptions]);
  const update = (change: Partial<LandscapeFilterState>) => { const next = {...state, ...change}; const query = serializeLandscapeState(next); if (typeof window !== 'undefined') window.history.pushState(null, '', query ? `?${query}` : window.location.pathname); setState(next); };
  const replace = (next: LandscapeFilterState) => { const query = serializeLandscapeState(next); if (typeof window !== 'undefined') window.history.pushState(null, '', query ? `?${query}` : window.location.pathname); setState(next); setDraftResetGeneration((generation) => generation + 1); };
  const clear = () => { replace(clearLandscapeFilters(state)); requestAnimationFrame(() => document.getElementById('country')?.focus()); };
  const filtered = useMemo(() => filterCompanies(initialData.companies, state), [initialData.companies, state]);
  const sorted = useMemo(() => sortCompanies(filtered, state.sort), [filtered, state.sort]);
  const kpis: KpiMetric[] = [{label: 'Companies tracked', value: {classification: 'calculated', value: filtered.length}}, {label: 'Combined organic traffic', value: aggregate(filtered, (company) => numeric(company.organicTraffic))}, {label: 'Organic keyword footprint', value: aggregate(filtered, (company) => numeric(company.organicKeywords))}, {label: 'Growing companies', value: count(filtered, (company) => { const value = numeric(company.organicTraffic30DayMovement); return value === null ? null : value > 0; })}, {label: 'Paid active', value: count(filtered, (company) => company.paidActivity.value === null ? null : company.paidActivity.value === true)}];
  const mapRows = useMemo(() => deriveMapRows(sorted), [sorted]);
  const signals = useMemo(() => deriveAttentionSignals(sorted), [sorted]);
  const constraints = activeConstraints(state); const filtersActive = hasActiveFilters(state);
  const content = <><header className="landscape-heading"><div><h1 className="page-title">Competitive landscape</h1><p aria-live="polite" aria-atomic="true">{filtered.length} {filtered.length === 1 ? 'company' : 'companies'} across the selected market</p></div></header><LandscapeFilters state={state} countries={initialData.filters.countries} segments={initialData.filters.segments} paidAvailable={initialData.filters.paidActivityAvailable} aiAvailable={initialData.filters.aiPerformanceAvailable} draftResetGeneration={draftResetGeneration} active={filtersActive} onChange={update} onClear={clear} />{filtered.length === 0 ? <section className="landscape-empty" aria-labelledby="landscape-empty-heading"><h2 id="landscape-empty-heading">No companies match the active constraints</h2><p>{constraints.join('; ')}.</p></section> : <><div data-testid="landscape-kpis"><KpiLedger metrics={kpis} /></div><div className="landscape-modules"><MarketMap rows={mapRows} selectedCompany={state.selectedCompany} onSelect={(companyId) => { setMapFocusRequest((current) => ({companyId, token: (current?.token ?? 0) + 1})); update({selectedCompany: companyId}); }} /><AttentionSignals companies={sorted} signals={signals} /></div><CompanyLeaderboard companies={sorted} selectedCompany={state.selectedCompany} focusRequest={mapFocusRequest} sort={state.sort} onSort={(sort) => update({sort})} onSelect={(companyId) => update({selectedCompany: companyId})} /></>}</>;
  const retained = initialData.companies.length > 0 && (initialData.status === 'stale' || initialData.status === 'partial' || initialData.status === 'failed' || initialData.status === 'running');
  const completedOutcome = initialData.status === 'partial' || initialData.status === 'failed' || initialData.status === 'stale';
  return <ScreenState status={initialData.status} hasRetainedData={retained} recoveryMessage={initialData.recoveryMessage} announce={completedOutcome}>{content}</ScreenState>;
}
