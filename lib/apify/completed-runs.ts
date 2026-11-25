import {z} from 'zod';
import type {ApifyClient} from './client';
import {DEFAULT_APIFY_ACTOR_ID} from './constants';
import {normalizeDomain} from '@/lib/transforms/normalize';

const id = z.string().regex(/^[a-zA-Z0-9]{1,64}$/);
const overviewInput = z.object({
  mode: z.literal('domain'), database: z.literal('worldwide'), include_moz: z.literal(false),
  concurrency: z.literal(5), domains: z.array(z.string().min(1)).nonempty(),
});
const metadata = z.object({
  id, actId: id, status: z.literal('SUCCEEDED'), defaultDatasetId: id, defaultKeyValueStoreId: id,
  finishedAt: z.iso.datetime(),
});

export function parseRunIds(value: string): string[] {
  const ids = z.array(id).min(1).max(20).parse(value.split(',').map(part => part.trim()));
  if (new Set(ids).size !== ids.length) throw new Error('duplicate_run_id');
  return ids.sort();
}

export async function loadCompletedRuns(client: ApifyClient, runIds: string[], domains: string[], signal: AbortSignal) {
  const actorPath = DEFAULT_APIFY_ACTOR_ID.replace('/', '~');
  const actor = z.object({id}).parse(await client.getResource('acts/' + actorPath, signal));
  const expected = new Set(domains);
  const runs = [];
  // Validate the entire submitted partition before reading any dataset or writing evidence.
  for (const runId of runIds) {
    const run = metadata.parse(await client.getResource('actor-runs/' + id.parse(runId), signal));
    if (run.id !== runId || run.actId !== actor.id) throw new Error('actor_run_mismatch');
    const input = overviewInput.parse(await client.getResource('key-value-stores/' + run.defaultKeyValueStoreId + '/records/INPUT', signal, false));
    for (const domain of input.domains) {
      if (domain !== normalizeDomain(domain) || !expected.delete(domain)) throw new Error('run_roster_mismatch');
    }
    runs.push({domains: input.domains, datasetId: run.defaultDatasetId, observedAt: run.finishedAt});
  }
  if (expected.size) throw new Error('run_roster_incomplete');
  const datasets = [];
  for (const run of runs) {
    try {
      datasets.push({...run, items: await client.getDatasetItems(run.datasetId, {signal})});
    } catch {
      datasets.push({...run, items: [], unavailable: true});
    }
  }
  return {datasets};
}
