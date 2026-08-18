import type {DashboardSnapshot} from '@/lib/airtable/types';
import {DashboardCache, type CacheResult} from '@/lib/cache/dashboard-cache';
import type {CompanyResponse, LandscapeResponse} from '@/lib/domain/dashboard';
import {shapeDashboardSnapshot} from './shape-landscape';

const emptySnapshot: DashboardSnapshot = {companies: [], keywords: [], paidAds: [], publishedInsights: [], reviews: [], system: []};

/** Shared cache façade used by both server routes; loader injection keeps its singleton behavior testable. */
export class DashboardService {
  private readonly cache = new DashboardCache<DashboardSnapshot>();
  private loader: () => Promise<DashboardSnapshot>;
  constructor(loader: () => Promise<DashboardSnapshot>) { this.loader = loader; }
  setLoaderForTest(loader: () => Promise<DashboardSnapshot>): void { this.loader = loader; }
  invalidate(): void { this.cache.invalidate(); }
  peek(): CacheResult<DashboardSnapshot> { return this.cache.peek(); }
  getCache(): DashboardCache<DashboardSnapshot> { return this.cache; }

  private state(result: CacheResult<DashboardSnapshot>) {
    return result.state.status === 'succeeded' ? {cachedAt: result.state.cachedAt} : {status: result.state.status, cachedAt: result.state.cachedAt};
  }
  async landscape(): Promise<LandscapeResponse> {
    const result = await this.cache.getOrLoad(this.loader, {background: true});
    return shapeDashboardSnapshot(result.snapshot ?? emptySnapshot, this.state(result)).landscape;
  }
  async company(companyId: string): Promise<CompanyResponse | undefined> {
    const result = await this.cache.getOrLoad(this.loader, {background: true});
    if (!result.snapshot) return undefined;
    return shapeDashboardSnapshot(result.snapshot, this.state(result)).companies.get(companyId);
  }
}
