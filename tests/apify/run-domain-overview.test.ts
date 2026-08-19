import {describe, expect, it, vi} from 'vitest';
import {ApifyClient} from '@/lib/apify/client';
import {runDomainOverview} from '@/lib/apify/run-domain-overview';

describe('runDomainOverview', () => {
  it('uses the documented bounded Domain Overview actor input', async () => {
    const startRun = vi.fn(async () => ({id: 'run-1', status: 'RUNNING' as const, datasetId: null}));
    const client = {
      startRun,
      waitForRun: vi.fn(async () => ({id: 'run-1', status: 'SUCCEEDED' as const, datasetId: 'dataset-1'})),
      getDatasetItems: vi.fn(async () => []),
    } as unknown as ApifyClient;

    await expect(runDomainOverview(client, ['alpha.example', 'beta.example'], {
      actorId: 'pro100chok/semrush-scraper', timeoutMs: 5_000,
    })).resolves.toEqual({items: [], datasetId: 'dataset-1'});

    expect(startRun).toHaveBeenCalledWith('pro100chok/semrush-scraper', {
      mode: 'domain',
      domains: ['alpha.example', 'beta.example'],
      database: 'worldwide',
      include_moz: false,
      concurrency: 5,
    }, expect.objectContaining({timeoutMs: 5_000}));
  });

  it('best-effort aborts one owned nonterminal run when polling is aborted', async () => {
    const client = {
      startRun: vi.fn(async () => ({id: 'run-1', status: 'RUNNING' as const, datasetId: null})),
      waitForRun: vi.fn(async () => { throw new Error('aborted'); }),
      getDatasetItems: vi.fn(), abortRun: vi.fn(async () => {}),
    } as unknown as ApifyClient;

    await expect(runDomainOverview(client, ['alpha.example'], {actorId: 'pro100chok/semrush-scraper', timeoutMs: 10})).rejects.toThrow('aborted');
    expect(client.abortRun).toHaveBeenCalledTimes(1);
    expect(client.abortRun).toHaveBeenCalledWith('run-1', {timeoutMs: 5_000});
  });
});
