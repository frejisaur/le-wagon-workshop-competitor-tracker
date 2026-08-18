import 'server-only';

import {AirtableClient} from '@/lib/airtable/client';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {DashboardCache} from '@/lib/cache/dashboard-cache';
import type {CompanyResponse, LandscapeResponse} from '@/lib/domain/dashboard';
import {getWebEnv} from '@/lib/config/server-env';
import {DashboardService} from './dashboard-service-core';


function repository() {
  const env = getWebEnv();
  return new AirtableCompetitorRepository(new AirtableClient({baseId: env.AIRTABLE_BASE_ID, apiToken: env.AIRTABLE_PAT}));
}

async function loadSnapshot(): Promise<DashboardSnapshot> { return repository().getDashboardSnapshot(); }
const dashboardService = new DashboardService(loadSnapshot);
export function getDashboardCache(): DashboardCache<DashboardSnapshot> { return dashboardService.getCache(); }

export async function getLandscapeResponse(): Promise<LandscapeResponse> {
  return dashboardService.landscape();
}

export async function getCompanyResponse(companyId: string): Promise<CompanyResponse | undefined> {
  return dashboardService.company(companyId);
}
