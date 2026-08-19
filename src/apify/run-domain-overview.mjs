import {ApifyClient} from './client.mjs';

export const SEMRUSH_ACTOR_ID = 'pro100chok/semrush-scraper';
export const MAX_DOMAINS_PER_RUN = 100;

export async function runDomainOverview({domains, token, timeoutMs, signal, client, actorId = SEMRUSH_ACTOR_ID}) {
  if (!Array.isArray(domains) || domains.length === 0 || domains.length > MAX_DOMAINS_PER_RUN) {
    throw new Error(`Domain Overview requires 1-${MAX_DOMAINS_PER_RUN} domains`);
  }
  const requestController = new AbortController();
  const timeout = setTimeout(() => requestController.abort(new Error('Apify refresh timed out')), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, requestController.signal]) : requestController.signal;
  const apify = client || new ApifyClient({token});
  try {
    const run = await apify.startRun({
      actorId,
      signal: combinedSignal,
      input: {
        mode: 'domain', domains, database: 'worldwide', include_moz: false, concurrency: 5,
      },
    });
    const completed = await apify.waitForRun(run.id, {signal: combinedSignal});
    const datasetId = completed.defaultDatasetId;
    if (!datasetId) throw new Error('Apify run completed without a dataset');
    const items = await apify.getDatasetItems(datasetId, {signal: combinedSignal});
    return {items, datasetId};
  } finally {
    clearTimeout(timeout);
    requestController.abort();
  }
}
