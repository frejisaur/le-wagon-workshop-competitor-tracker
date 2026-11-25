import {normalizeDomain} from '@/lib/transforms/normalize';
import {ApifyClient, type ApifyOperationOptions} from './client';

export type DomainOverviewOptions = ApifyOperationOptions & {actorId: string};
export type DomainOverviewResult = {items: unknown[]; datasetId: string};

export function actorInput(domains: string[]) {
  const normalized = domains.map(domain => normalizeDomain(domain));
  if (!normalized.length || normalized.some(domain => !domain) || new Set(normalized).size !== domains.length) {
    throw new Error('invalid_roster_domains');
  }
  return {mode: 'domain', domains: normalized as string[], database: 'worldwide', include_moz: false, concurrency: 5};
}

/** Runs one bounded, validated-domain batch in the provider's Domain Overview mode. */
export async function runDomainOverview(client: ApifyClient, domains: string[], options: DomainOverviewOptions): Promise<DomainOverviewResult> {
  if (domains.length === 0) return {items: [], datasetId: ''};
  if (domains.some((domain) => !domain || domain !== domain.toLowerCase())) throw new TypeError('domains must be normalized');
  const run = await client.startRun(options.actorId, actorInput(domains), options);
  try {
    const completed = await client.waitForRun(run.id, options);
    return {items: await client.getDatasetItems(completed.datasetId!, options), datasetId: completed.datasetId!};
  } catch (error) {
    // A timed-out caller must not leave a run owned by this invocation active.
    // Cleanup uses a fresh bounded request, never the already-aborted parent signal.
    try { await client.abortRun(run.id, {timeoutMs: 5_000}); } catch {}
    throw error;
  }
}
