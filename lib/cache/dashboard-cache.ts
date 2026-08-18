import type {DashboardStatus} from '@/lib/domain/dashboard';

export type CacheState = {status: DashboardStatus; failedCompanies: number; cachedAt: string | null; error: boolean};
export type CacheResult<T> = {snapshot?: T; state: CacheState};

/** One bounded in-process snapshot. Failed loads never replace good dashboard data. */
export class DashboardCache<T> {
  private snapshot: T | undefined;
  private loading: {generation: number; promise: Promise<CacheResult<T>>} | undefined;
  private generation = 0;
  private needsLoad = true;
  private state: CacheState = {status: 'loading', failedCompanies: 0, cachedAt: null, error: false};

  seed(snapshot: T, cachedAt = new Date().toISOString()): void { this.snapshot = snapshot; this.needsLoad = false; this.state = {status: 'succeeded', failedCompanies: 0, cachedAt, error: false}; }
  replaceAfterSuccess(snapshot: T, cachedAt = new Date().toISOString()): void { this.seed(snapshot, cachedAt); }
  markRefreshState(input: {status: Exclude<DashboardStatus, 'loading' | 'empty'>; failedCompanies?: number}): void {
    this.state = {...this.state, status: input.status, failedCompanies: input.failedCompanies ?? this.state.failedCompanies, error: input.status === 'failed' || input.status === 'stale'};
  }
  invalidate(): void { this.generation += 1; this.needsLoad = true; if (this.snapshot) this.markRefreshState({status: 'stale'}); }
  peek(): CacheResult<T> { return {snapshot: this.snapshot, state: {...this.state}}; }

  async getOrLoad(loader: () => Promise<T>, options: {background?: boolean} = {}): Promise<CacheResult<T>> {
    if (!this.needsLoad && this.snapshot) return this.peek();
    const generation = this.generation;
    if (this.loading?.generation === generation) return options.background && this.snapshot ? this.peek() : this.loading.promise;
    // An invalidated snapshot stays visibly stale until the in-flight replacement succeeds.
    if (!this.snapshot) this.state = {...this.state, status: 'loading', error: false};
    const promise = (async () => {
      try {
        const next = await loader();
        // Never let an earlier load clear a newer invalidation generation.
        if (this.generation === generation) this.replaceAfterSuccess(next);
      } catch {
        // Preserve the last known-good snapshot; only the separate state changes.
        if (this.generation === generation) this.state = {...this.state, status: 'failed', error: true};
      } finally {
        if (this.loading?.generation === generation) this.loading = undefined;
      }
      return this.peek();
    })();
    this.loading = {generation, promise};
    return options.background && this.snapshot ? this.peek() : promise;
  }
}
