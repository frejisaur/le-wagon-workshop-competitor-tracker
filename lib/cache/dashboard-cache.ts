import type {DashboardStatus} from '@/lib/domain/dashboard';

export type CacheState = {status: DashboardStatus; failedCompanies: number; cachedAt: string | null; error: boolean};
export type CacheResult<T> = {snapshot?: T; state: CacheState};

/** One bounded in-process snapshot. Failed loads never replace good dashboard data. */
export class DashboardCache<T> {
  private snapshot: T | undefined;
  private loading: Promise<CacheResult<T>> | undefined;
  private needsLoad = true;
  private state: CacheState = {status: 'loading', failedCompanies: 0, cachedAt: null, error: false};

  seed(snapshot: T, cachedAt = new Date().toISOString()): void { this.snapshot = snapshot; this.needsLoad = false; this.state = {status: 'succeeded', failedCompanies: 0, cachedAt, error: false}; }
  replaceAfterSuccess(snapshot: T, cachedAt = new Date().toISOString()): void { this.seed(snapshot, cachedAt); }
  markRefreshState(input: {status: Exclude<DashboardStatus, 'loading' | 'empty'>; failedCompanies?: number}): void {
    this.state = {...this.state, status: input.status, failedCompanies: input.failedCompanies ?? this.state.failedCompanies, error: input.status === 'failed' || input.status === 'stale'};
  }
  invalidate(): void { this.needsLoad = true; if (this.snapshot) this.markRefreshState({status: 'stale'}); }
  peek(): CacheResult<T> { return {snapshot: this.snapshot, state: {...this.state}}; }

  async getOrLoad(loader: () => Promise<T>): Promise<CacheResult<T>> {
    if (!this.needsLoad && this.snapshot) return this.peek();
    if (this.loading) return this.loading;
    this.state = {...this.state, status: this.snapshot ? 'running' : 'loading', error: false};
    this.loading = (async () => {
      let succeeded = false;
      try {
        const next = await loader();
        this.replaceAfterSuccess(next);
        succeeded = true;
      } catch {
        // Preserve the last known-good snapshot; only the separate state changes.
        this.state = {...this.state, status: 'failed', error: true};
      } finally {
        // A failed revalidation remains eligible for an explicit or next-request retry.
        this.needsLoad = !succeeded;
        this.loading = undefined;
      }
      return this.peek();
    })();
    return this.loading;
  }
}
