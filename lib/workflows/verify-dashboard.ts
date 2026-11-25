import {CompanyResponseSchema, LandscapeResponseSchema} from '@/lib/domain/dashboard';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {companyIdOf} from '@/lib/airtable/company-row';

/** Check the serving path after invalidation, including instances still inside their snapshot TTL. */
export async function verifyDashboard(baseUrl: string, snapshot: DashboardSnapshot, options: {
  fetch?: typeof globalThis.fetch; sleep?: (ms: number) => Promise<void>; attempts?: number;
} = {}) {
  const fetcher = options.fetch ?? fetch;
  const attempts = options.attempts ?? 15;
  const company = snapshot.companies.find(row => !!row.fields['Observed • At']);
  const companyId = company && companyIdOf(company);
  if (!companyId || !snapshot.system?.lastSuccessfulRunAt) throw new Error('saved_observation_missing');
  async function get(path: string) {
    const response = await fetcher(new URL(path, baseUrl), {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error('dashboard_unavailable');
    return response.json();
  }
  for (let i = 0; i < attempts; i++) {
    try {
      const dashboard = LandscapeResponseSchema.parse(await get('/api/dashboard'));
      if (dashboard.status === 'succeeded' && dashboard.freshness.lastSuccessfulRunAt === snapshot.system.lastSuccessfulRunAt
        && dashboard.companies.length === snapshot.companies.length) {
        const detail = CompanyResponseSchema.parse(await get('/api/companies/' + encodeURIComponent(companyId)));
        if (detail.companyId === companyId && detail.enrichedAt === company.fields['Observed • At']
          && detail.kpis.authorityScore.value === (company.fields['Observed • Authority Score'] ?? null)
          && detail.kpis.organicTraffic.value === (company.fields['Observed • Organic Traffic'] ?? null)) return dashboard.freshness;
      }
    } catch {
      // A cold instance or in-flight cache reload can briefly serve the prior snapshot.
    }
    if (i + 1 < attempts) await (options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(5000);
  }
  throw new Error('dashboard_snapshot_mismatch');
}
