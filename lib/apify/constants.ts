/** The reviewed production actor for the scheduled deterministic Domain Overview job. */
export const DEFAULT_APIFY_ACTOR_ID = 'pro100chok/semrush-scraper';

export function datasetItemRef(datasetId: string, offset: number): string | undefined {
  if (!datasetId) return undefined;
  return `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?offset=${offset}&limit=1`;
}
