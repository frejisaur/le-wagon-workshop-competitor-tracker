import {describe, expect, it, vi} from 'vitest';
import type {DashboardSnapshot} from '@/lib/airtable/types';
import {DashboardCache} from '@/lib/cache/dashboard-cache';
import {shapeDashboardSnapshot} from '@/lib/api/shape-landscape';

const snapshot: DashboardSnapshot = {
  companies: [
    {id: 'rec-alpha', fields: {
      'Identity • Company ID': 'company-alpha', 'Identity • Canonical Domain': 'alpha.example',
      'Observed • Display Name': 'Alpha', 'Observed • Source': 'semrush', 'Observed • At': '2026-08-18T12:00:00.000Z', 'Observed • Database': 'ca',
      'Observed • Authority Score': 42, 'Observed • Organic Traffic': 200, 'Observed • Organic Keywords': 20,
      'Observed • Paid Traffic': 10, 'Observed • AI Visibility': 3, 'Observed • AI Visibility Benchmark': 2,
      'Observed • Referring Domains': 18, 'Calculated • Organic Traffic 30d Movement': 15,
      'Calculated • Non-brand Share': 0.6, 'Calculated • AI Benchmark Gap': 1,
      'Calculated • Tracked Set Traffic Share': 1, 'Calculated • Paid Activity Present': true,
    }},
  ], keywords: [], paidAds: [], publishedInsights: [], reviews: [],
  system: [{id: 'rec-system', fields: {'Identity • System ID': 'system', 'Workflow • Status': 'succeeded', 'Workflow • Last Successful Run At': '2026-08-18T12:00:00.000Z', 'Workflow • Processed Companies': 1, 'Workflow • Succeeded Companies': 1, 'Workflow • Failed Companies': 0}}],
};

describe('dashboard response and cache', () => {
  it('projects deterministic ordered classified landscape data without Airtable records', () => {
    const response = shapeDashboardSnapshot(snapshot).landscape;
    expect(response).toMatchObject({status: 'succeeded', kpis: {companiesTracked: {classification: 'calculated', value: 1}}});
    expect(response.companies.map((company) => company.companyId)).toEqual(['company-alpha']);
    expect(JSON.stringify(response)).not.toMatch(/rec-alpha|AIRTABLE|rawProviderPayload/i);
    expect(response.companies[0]?.organicTraffic).toMatchObject({classification: 'observed', value: 200});
  });

  it('single-flights first load, and preserves its last success when a later load fails', async () => {
    const cache = new DashboardCache<typeof snapshot>();
    const load = vi.fn(async () => snapshot);
    const [first, second] = await Promise.all([cache.getOrLoad(load), cache.getOrLoad(load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first.snapshot).toEqual(snapshot);
    expect(second.snapshot).toEqual(snapshot);

    cache.invalidate();
    const retained = await cache.getOrLoad(async () => { throw new Error('unavailable'); });
    expect(retained.snapshot).toEqual(snapshot);
    expect(retained.state.status).toBe('failed');
    const recovered = await cache.getOrLoad(async () => snapshot);
    expect(recovered.state.status).toBe('succeeded');
  });
});
