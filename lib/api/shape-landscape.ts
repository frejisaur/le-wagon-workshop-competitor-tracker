import type {AirtableRecord, DashboardSnapshot} from '@/lib/airtable/types';
import {LandscapeResponseSchema, type CompanyResponse, type DashboardStatus, type LandscapeResponse} from '@/lib/domain/dashboard';
import {freshnessFor, shapeCompany} from './shape-company';

function fieldNumber(record: AirtableRecord, field: string): number | null { const value = record.fields[field]; return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function fieldText(record: AirtableRecord, field: string): string | undefined { const value = record.fields[field]; return typeof value === 'string' && value.length ? value : undefined; }
function add(values: Array<number | null>): number { return values.reduce<number>((total, value) => total + (value ?? 0), 0); }
function storedStatus(snapshot: DashboardSnapshot): DashboardStatus { const value = snapshot.system.find((record) => record.fields['Identity • System ID'] === 'system')?.fields['Workflow • Status']; return value === 'running' || value === 'succeeded' || value === 'partial' || value === 'failed' ? value : snapshot.companies.length ? 'succeeded' : 'empty'; }
function recovery(status: DashboardStatus): string | undefined { return status === 'empty' ? 'No companies have been imported.' : status === 'failed' ? 'Refresh failed. Last successful data remains available.' : status === 'partial' ? 'Some companies failed. Available company data remains visible.' : status === 'stale' ? 'Data is stale but remains available.' : undefined; }

export type ShapedDashboard = {landscape: LandscapeResponse; companies: Map<string, CompanyResponse>};

/** Shapes only an allow-list of Airtable's curated fields into browser data. */
export function shapeDashboardSnapshot(snapshot: DashboardSnapshot, state?: {status?: DashboardStatus; cachedAt?: string | null}): ShapedDashboard {
  const status = state?.status ?? storedStatus(snapshot);
  const freshness = freshnessFor(snapshot, state?.cachedAt ?? null, status === 'stale' || status === 'failed');
  const companies = [...snapshot.companies].flatMap((record) => {
    const companyId = fieldText(record, 'Identity • Company ID'); const domain = fieldText(record, 'Identity • Canonical Domain');
    return companyId && domain ? [{record, companyId, domain}] : [];
  }).sort((left, right) => left.domain.localeCompare(right.domain) || left.companyId.localeCompare(right.companyId));
  const byId = new Map<string, CompanyResponse>();
  for (const item of companies) byId.set(item.companyId, shapeCompany(snapshot, item.record, freshness, status, recovery(status)));
  const summaries = companies.map(({record, companyId, domain}) => ({
    companyId, domain, ...(fieldText(record, 'Observed • Display Name') ? {displayName: fieldText(record, 'Observed • Display Name')} : {}),
    authorityScore: {classification: 'observed' as const, value: fieldNumber(record, 'Observed • Authority Score'), ...(fieldText(record, 'Observed • Source') ? {source: fieldText(record, 'Observed • Source')} : {})},
    organicTraffic: {classification: 'observed' as const, value: fieldNumber(record, 'Observed • Organic Traffic'), ...(fieldText(record, 'Observed • Source') ? {source: fieldText(record, 'Observed • Source')} : {})},
    organicTraffic30DayMovement: {classification: 'calculated' as const, value: fieldNumber(record, 'Calculated • Organic Traffic 30d Movement')}, nonBrandShare: {classification: 'calculated' as const, value: fieldNumber(record, 'Calculated • Non-brand Share')}, organicKeywords: {classification: 'observed' as const, value: fieldNumber(record, 'Observed • Organic Keywords')}, paidActivity: {classification: 'calculated' as const, value: record.fields['Calculated • Paid Activity Present'] === true}, aiBenchmarkGap: {classification: 'calculated' as const, value: fieldNumber(record, 'Calculated • AI Benchmark Gap')}, referringDomains: {classification: 'observed' as const, value: fieldNumber(record, 'Observed • Referring Domains')}, freshness,
  }));
  const landscape = LandscapeResponseSchema.parse({status, freshness, ...(recovery(status) ? {recoveryMessage: recovery(status)} : {}),
    kpis: {companiesTracked: {classification: 'calculated', value: summaries.length}, combinedOrganicTraffic: {classification: 'calculated', value: add(summaries.map((company) => company.organicTraffic.value as number | null))}, organicKeywordFootprint: {classification: 'calculated', value: add(summaries.map((company) => company.organicKeywords.value as number | null))}, growingCompanies: {classification: 'calculated', value: summaries.filter((company) => typeof company.organicTraffic30DayMovement.value === 'number' && company.organicTraffic30DayMovement.value > 0).length}, paidActiveCompanies: {classification: 'calculated', value: summaries.filter((company) => company.paidActivity.value === true).length}},
    companies: summaries,
    marketMap: summaries.map((company) => ({companyId: company.companyId, authorityScore: company.authorityScore.value as number | null, organicTraffic: company.organicTraffic.value as number | null, trafficShare: fieldNumber(companies.find((item) => item.companyId === company.companyId)!.record, 'Calculated • Tracked Set Traffic Share'), aiBenchmarkGap: company.aiBenchmarkGap.value as number | null})),
    signals: summaries.flatMap((company) => { const signals: Array<{companyId: string; kind: 'growth' | 'paid_activity' | 'ai_outperformance' | 'non_brand_demand'; value: number; period: string}> = []; if (typeof company.organicTraffic30DayMovement.value === 'number' && company.organicTraffic30DayMovement.value > 0) signals.push({companyId: company.companyId, kind: 'growth', value: company.organicTraffic30DayMovement.value, period: '30 days'}); if (company.paidActivity.value === true) signals.push({companyId: company.companyId, kind: 'paid_activity', value: 1, period: 'current'}); if (typeof company.aiBenchmarkGap.value === 'number' && company.aiBenchmarkGap.value > 0) signals.push({companyId: company.companyId, kind: 'ai_outperformance', value: company.aiBenchmarkGap.value, period: 'current'}); if (typeof company.nonBrandShare.value === 'number' && company.nonBrandShare.value > .5) signals.push({companyId: company.companyId, kind: 'non_brand_demand', value: company.nonBrandShare.value, period: 'current'}); return signals; }).sort((left, right) => right.value - left.value || left.companyId.localeCompare(right.companyId)).slice(0, 5),
    filters: {countries: [...new Set(companies.map(({record}) => fieldText(record, 'Observed • Apollo Company Country') ?? fieldText(record, 'Observed • Top Country')).filter((value): value is string => !!value))].sort(), segments: [...new Set(companies.map(({record}) => fieldText(record, 'Observed • Segment')).filter((value): value is string => !!value))].sort(), paidActivityAvailable: summaries.some((company) => company.paidActivity.value === true), aiPerformanceAvailable: summaries.some((company) => company.aiBenchmarkGap.value !== null)},
  });
  return {landscape, companies: byId};
}
