import {LandscapeResponseSchema, type DashboardValue, type LandscapeResponse} from '@/lib/domain/dashboard';

const at = '2026-08-18T12:00:00.000Z';
const cachedAt = '2026-08-18T12:01:00.000Z';
const freshness = {lastSuccessfulRunAt: at, cachedAt, isStale: false};
const staleFreshness = {...freshness, isStale: true};
const observed = (value: number | null): DashboardValue => ({classification: 'observed', value, source: 'semrush', database: 'ca', observedAt: at});
const calculated = (value: number | boolean | null): DashboardValue => ({classification: 'calculated', value, calculatedAt: at});

const companies: LandscapeResponse['companies'] = [
  {companyId: 'alpha', domain: 'alpha.example', displayName: 'Alpha', country: 'Canada', segment: 'Enterprise', authorityScore: observed(42), organicTraffic: observed(12_000), organicTraffic30DayMovement: calculated(0.15), nonBrandShare: calculated(0.7), organicKeywords: observed(900), paidActivity: calculated(true), aiBenchmarkGap: calculated(0.2), referringDomains: observed(450), freshness},
  {companyId: 'bravo', domain: 'bravo.example', displayName: 'Bravo', country: 'United States', segment: 'Mid-market', authorityScore: observed(65), organicTraffic: observed(8_000), organicTraffic30DayMovement: calculated(-0.03), nonBrandShare: calculated(0.3), organicKeywords: observed(500), paidActivity: calculated(false), aiBenchmarkGap: calculated(-0.1), referringDomains: observed(750), freshness},
  {companyId: 'charlie', domain: 'charlie.example', displayName: 'Charlie', authorityScore: observed(null), organicTraffic: observed(null), organicTraffic30DayMovement: calculated(null), nonBrandShare: calculated(null), organicKeywords: observed(null), paidActivity: calculated(null), aiBenchmarkGap: calculated(null), referringDomains: observed(null), freshness},
];

const current = LandscapeResponseSchema.parse({
  status: 'succeeded', freshness,
  kpis: {companiesTracked: calculated(3), combinedOrganicTraffic: calculated(20_000), organicKeywordFootprint: calculated(1_400), growingCompanies: calculated(1), paidActiveCompanies: calculated(1)},
  companies,
  marketMap: [{companyId: 'alpha', authorityScore: 42, organicTraffic: 12_000, trafficShare: 0.6, aiBenchmarkGap: 0.2}, {companyId: 'bravo', authorityScore: 65, organicTraffic: 8_000, trafficShare: 0.4, aiBenchmarkGap: -0.1}],
  signals: [{companyId: 'alpha', kind: 'growth', value: 0.15, period: '30 days'}, {companyId: 'alpha', kind: 'paid_activity', value: 1, period: 'current'}, {companyId: 'alpha', kind: 'ai_outperformance', value: 0.2, period: 'current'}, {companyId: 'alpha', kind: 'non_brand_demand', value: 0.7, period: 'current'}],
  filters: {countries: ['Canada', 'United States'], segments: ['Enterprise', 'Mid-market'], paidActivityAvailable: true, aiPerformanceAvailable: true},
});

const withoutCompanies = (status: LandscapeResponse['status'], recoveryMessage?: string): LandscapeResponse => LandscapeResponseSchema.parse({...current, status, ...(recoveryMessage ? {recoveryMessage} : {}), companies: [], marketMap: [], signals: [], freshness: status === 'loading' ? {lastSuccessfulRunAt: null, cachedAt: null, isStale: false} : current.freshness});
const retained = (status: LandscapeResponse['status'], recoveryMessage: string): LandscapeResponse => LandscapeResponseSchema.parse({...current, status, recoveryMessage, freshness: status === 'stale' ? staleFreshness : current.freshness, companies: current.companies.map((company) => status === 'stale' ? {...company, freshness: staleFreshness} : company)});

export const dashboardStates = {
  current,
  loading: withoutCompanies('loading'),
  refreshing: retained('running', 'Refresh running. Last successful data remains visible.'),
  stale: retained('stale', 'Data is stale but remains available.'),
  partial: retained('partial', 'Some companies failed. Available company data remains visible.'),
  failedWithData: retained('failed', 'Refresh failed. Last successful data remains available.'),
  empty: withoutCompanies('empty'),
  noResults: current,
} satisfies Record<string, LandscapeResponse>;
