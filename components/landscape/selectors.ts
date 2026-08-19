import type {CompanySummary, DashboardValue, LandscapeResponse} from '@/lib/domain/dashboard';
import type {LandscapeFilterState, LandscapeSort} from './filter-state';

export type DerivedMapRow = {company: CompanySummary; authorityScore: number | null; organicTraffic: number | null; trafficShare: number | null; aiBenchmarkGap: number | null};
export type AttentionSignal = LandscapeResponse['signals'][number];

export function numeric(value: DashboardValue): number | null { return typeof value.value === 'number' ? value.value : null; }

const comparison: Record<string, (company: CompanySummary) => number | boolean | null> = {
  authority: (company) => numeric(company.authorityScore), traffic: (company) => numeric(company.organicTraffic), movement: (company) => numeric(company.organicTraffic30DayMovement), nonBrand: (company) => numeric(company.nonBrandShare), keywords: (company) => numeric(company.organicKeywords), paid: (company) => typeof company.paidActivity.value === 'boolean' ? company.paidActivity.value : null, ai: (company) => numeric(company.aiBenchmarkGap), referring: (company) => numeric(company.referringDomains),
};

export function filterCompanies(companies: readonly CompanySummary[], state: LandscapeFilterState): CompanySummary[] {
  return companies.filter((company) => {
    const traffic = numeric(company.organicTraffic); const authority = numeric(company.authorityScore); const paid = company.paidActivity.value; const ai = numeric(company.aiBenchmarkGap);
    return (!state.paid || state.paid === 'active' && paid === true || state.paid === 'inactive' && paid === false || state.paid === 'unknown' && paid === null) && (!state.ai || state.ai === 'outperforming' && ai !== null && ai > 0 || state.ai === 'not_outperforming' && ai !== null && ai <= 0 || state.ai === 'unknown' && ai === null) && (state.trafficMin === undefined || traffic !== null && traffic >= state.trafficMin) && (state.trafficMax === undefined || traffic !== null && traffic <= state.trafficMax) && (state.authorityMin === undefined || authority !== null && authority >= state.authorityMin) && (state.authorityMax === undefined || authority !== null && authority <= state.authorityMax) && (!state.country || state.country === 'unknown' && !company.country || state.country === company.country) && (!state.segment || state.segment === 'unknown' && !company.segment || state.segment === company.segment);
  });
}

export function sortCompanies(companies: readonly CompanySummary[], sort: LandscapeSort): CompanySummary[] {
  const [key, direction] = sort.split('-'); const get = comparison[key]!;
  return [...companies].sort((left, right) => { const a = get(left); const b = get(right); if (a === null && b === null) return left.domain.localeCompare(right.domain); if (a === null) return 1; if (b === null) return -1; const order = (Number(a) - Number(b)) * (direction === 'asc' ? 1 : -1); return order || left.domain.localeCompare(right.domain); });
}

/** Recalculates traffic share from the current filtered cohort; it never reuses a global response share. */
export function deriveMapRows(companies: readonly CompanySummary[]): DerivedMapRow[] {
  const knownPositiveTraffic = companies.map((company) => numeric(company.organicTraffic)).filter((value): value is number => value !== null && value > 0);
  const trafficTotal = knownPositiveTraffic.reduce((sum, value) => sum + value, 0);
  return companies.map((company) => { const organicTraffic = numeric(company.organicTraffic); return {company, authorityScore: numeric(company.authorityScore), organicTraffic, trafficShare: organicTraffic !== null && organicTraffic > 0 && trafficTotal > 0 ? organicTraffic / trafficTotal : null, aiBenchmarkGap: numeric(company.aiBenchmarkGap)}; });
}

const priority: Record<AttentionSignal['kind'], number> = {ai_outperformance: 0, growth: 1, paid_activity: 2, non_brand_demand: 3};

/** Derives eligible signals after filtering and only then applies the five-item display cap. */
export function deriveAttentionSignals(companies: readonly CompanySummary[]): AttentionSignal[] {
  return companies.flatMap((company) => {
    const signals: AttentionSignal[] = []; const movement = numeric(company.organicTraffic30DayMovement); const aiGap = numeric(company.aiBenchmarkGap); const nonBrand = numeric(company.nonBrandShare);
    if (movement !== null && movement > 0) signals.push({companyId: company.companyId, kind: 'growth', value: movement, period: '30 days'});
    if (company.paidActivity.value === true) signals.push({companyId: company.companyId, kind: 'paid_activity', value: 1, period: 'current'});
    if (aiGap !== null && aiGap > 0) signals.push({companyId: company.companyId, kind: 'ai_outperformance', value: aiGap, period: 'current'});
    if (nonBrand !== null && nonBrand > 0.5) signals.push({companyId: company.companyId, kind: 'non_brand_demand', value: nonBrand, period: 'current'});
    return signals;
  }).sort((left, right) => priority[left.kind] - priority[right.kind] || Math.abs(right.value) - Math.abs(left.value) || left.companyId.localeCompare(right.companyId)).slice(0, 5);
}
