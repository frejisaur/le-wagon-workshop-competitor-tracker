import {describe, expect, it, vi} from 'vitest';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {DashboardService} from '@/lib/api/dashboard-service-core';

const snapshot: DashboardSnapshot = {companies: [{id: 'rec-alpha', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example'}}], keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []};

describe('DashboardService singleton contract', () => {
  it('returns a route-ready empty response with zero KPI coverage', async () => {
    const service = new DashboardService(async () => ({companies: [], keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []}));
    await expect(service.landscape()).resolves.toMatchObject({status: 'empty', kpis: {combinedOrganicTraffic: {coverage: {available: 0, total: 0}}}});
  });

  it('shares one snapshot load across concurrent landscape and company reads, including stale revalidation', async () => {
    let resolve!: (value: DashboardSnapshot) => void;
    const load = vi.fn(() => new Promise<DashboardSnapshot>((done) => { resolve = done; }));
    const service = new DashboardService(load);
    const landscape = service.landscape(); const company = service.company('company-alpha');
    expect(load).toHaveBeenCalledTimes(1);
    resolve(snapshot);
    await expect(landscape).resolves.toMatchObject({status: 'succeeded'});
    await expect(company).resolves.toMatchObject({companyId: 'company-alpha'});

    service.invalidate();
    let resolveReload!: (value: DashboardSnapshot) => void;
    const reload = vi.fn(() => new Promise<DashboardSnapshot>((done) => { resolveReload = done; }));
    service.setLoaderForTest(reload);
    const staleLandscape = await service.landscape(); const staleCompany = await service.company('company-alpha');
    expect(staleLandscape.status).toBe('stale'); expect(staleCompany?.status).toBe('stale'); expect(reload).toHaveBeenCalledTimes(1);
    resolveReload(snapshot);
    await vi.waitFor(() => expect(service.peek().state.status).toBe('succeeded'));
  });
});
