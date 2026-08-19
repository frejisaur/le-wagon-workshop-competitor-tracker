import {describe, expect, it, vi} from 'vitest';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {DashboardService} from '@/lib/api/dashboard-service-core';
import {CompanyComparisonSchema} from '@/lib/domain/dashboard';

const snapshot: DashboardSnapshot = {companies: [{id: 'rec-alpha', fields: {'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example'}}], keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []};

describe('DashboardService singleton contract', () => {
  it('returns a route-ready empty response with zero KPI coverage', async () => {
    const service = new DashboardService(async () => ({companies: [], keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []}));
    await expect(service.landscape()).resolves.toMatchObject({status: 'empty', kpis: {combinedOrganicTraffic: {coverage: {available: 0, total: 0}}}});
  });

  it('shares one snapshot load across concurrent landscape and company reads, including stale revalidation', async () => {
    let resolve!: (value: DashboardSnapshot) => void;
    const load = vi.fn(() => new Promise<DashboardSnapshot>((done) => { resolve = done; }));
    let activeLoader: () => Promise<DashboardSnapshot> = load;
    const service = new DashboardService(() => activeLoader());
    const landscape = service.landscape(); const company = service.company('company-alpha');
    expect(load).toHaveBeenCalledTimes(1);
    resolve(snapshot);
    await expect(landscape).resolves.toMatchObject({status: 'succeeded'});
    await expect(company).resolves.toMatchObject({companyId: 'company-alpha'});

    service.invalidate();
    let resolveReload!: (value: DashboardSnapshot) => void;
    const reload = vi.fn(() => new Promise<DashboardSnapshot>((done) => { resolveReload = done; }));
    activeLoader = reload;
    const staleLandscape = await service.landscape(); const staleCompany = await service.company('company-alpha');
    expect(staleLandscape.status).toBe('stale'); expect(staleCompany?.status).toBe('stale'); expect(reload).toHaveBeenCalledTimes(1);
    resolveReload(snapshot);
    await vi.waitFor(() => expect(service.peek().state.status).toBe('succeeded'));
  });

  it('returns a deterministic bounded CompanyComparison projection from one cached snapshot load', async () => {
    const companies = Array.from({length: 53}, (_, index) => ({id: `rec-${index}`, fields: {'Identity • Company ID': `company-${String(index).padStart(2, '0')}`, 'Identity • Canonical Domain': `company-${String(index).padStart(2, '0')}.example`, 'Calculated • Compact Organic Trend JSON': JSON.stringify([{date: '2026-08-01', organicTraffic: index}])}}));
    const load = vi.fn(async (): Promise<DashboardSnapshot> => ({companies, keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []}));
    const service = new DashboardService(load);

    const workspace = await service.companyWorkspace('company-52');

    expect(load).toHaveBeenCalledTimes(1);
    expect(workspace?.company.companyId).toBe('company-52');
    expect(workspace?.comparisons).toHaveLength(51);
    expect(workspace?.comparisons.map((item) => item.companyId)).toEqual(Array.from({length: 51}, (_, index) => `company-${String(index).padStart(2, '0')}`));
    expect(JSON.stringify(workspace?.comparisons)).not.toMatch(/evidence|publishedInsight|reviewCandidate|raw/i);
    expect(workspace?.comparisons[0]).toEqual({companyId: 'company-00', identity: {domain: 'company-00.example'}, trend: [expect.objectContaining({date: '2026-08-01', organicTraffic: expect.any(Object), organicKeywords: expect.any(Object), paidTraffic: expect.any(Object), serpFeatureTraffic: expect.any(Object)})]});
    expect(CompanyComparisonSchema.safeParse({...workspace?.comparisons[0], evidence: []}).success).toBe(false);
  });
});
