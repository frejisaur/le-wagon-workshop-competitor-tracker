import {ApifyClient, type ApifyOperationOptions} from './client';

export type DomainOverviewOptions = ApifyOperationOptions & {actorId: string};

/** Runs one bounded, validated-domain batch in the provider's Domain Overview mode. */
export async function runDomainOverview(client: ApifyClient, domains: string[], options: DomainOverviewOptions): Promise<unknown[]> {
  if (domains.length === 0) return [];
  if (domains.some((domain) => !domain || domain !== domain.toLowerCase())) throw new TypeError('domains must be normalized');
  const run = await client.startRun(options.actorId, {domains, mode: 'domain_overview'}, options);
  const completed = await client.waitForRun(run.id, options);
  return client.getDatasetItems(completed.datasetId!, options);
}
