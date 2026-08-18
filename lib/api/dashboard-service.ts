import 'server-only';

import {AirtableClient} from '@/lib/airtable/client';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {DashboardCache} from '@/lib/cache/dashboard-cache';
import type {CompanyResponse, LandscapeResponse} from '@/lib/domain/dashboard';
import {getWebEnv} from '@/lib/config/server-env';
import {shapeDashboardSnapshot} from './shape-landscape';

const emptySnapshot: DashboardSnapshot = {companies: [], keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []};
const dashboardCache = new DashboardCache<DashboardSnapshot>();

function repository() {
  const env = getWebEnv();
  return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}));
}

async function loadSnapshot(): Promise<DashboardSnapshot> { return repository().getDashboardSnapshot(); }
export function getDashboardCache(): DashboardCache<DashboardSnapshot> { return dashboardCache; }

export async function getLandscapeResponse(): Promise<LandscapeResponse> {
  const result = await dashboardCache.getOrLoad(loadSnapshot, {background: true});
  const state = result.state.status === 'succeeded' ? {cachedAt: result.state.cachedAt} : {status: result.state.status, cachedAt: result.state.cachedAt};
  return shapeDashboardSnapshot(result.snapshot ?? emptySnapshot, state).landscape;
}

export async function getCompanyResponse(companyId: string): Promise<CompanyResponse | undefined> {
  const result = await dashboardCache.getOrLoad(loadSnapshot, {background: true});
  if (!result.snapshot) return undefined;
  const state = result.state.status === 'succeeded' ? {cachedAt: result.state.cachedAt} : {status: result.state.status, cachedAt: result.state.cachedAt};
  return shapeDashboardSnapshot(result.snapshot, state).companies.get(companyId);
}
