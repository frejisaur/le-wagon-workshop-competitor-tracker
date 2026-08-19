import {describe, expect, it, vi} from 'vitest';
import {ApifyClient, ApifyClientError} from '@/lib/apify/client';

describe('ApifyClient', () => {
  it('uses bearer authentication without placing a token in the URL and redacts failures', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).not.toContain('secret-token');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token');
      return new Response(JSON.stringify({error: {message: 'token secret-token rejected'}}), {status: 401});
    });
    const client = new ApifyClient({token: 'secret-token', endpoint: 'https://apify.test/v2', fetch});

    await expect(client.startRun('owner/actor', {domains: ['alpha.example']}, {timeoutMs: 100}))
      .rejects.toEqual(expect.objectContaining<Partial<ApifyClientError>>({message: 'Apify request failed (401)'}));
  });

  it('honors caller aborts and per-operation timeouts', async () => {
    const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));
    const client = new ApifyClient({token: 'safe', endpoint: 'https://apify.test/v2', fetch});
    const caller = new AbortController();
    caller.abort(new Error('caller stopped'));

    await expect(client.getDatasetItems('dataset-1', {signal: caller.signal, timeoutMs: 100})).rejects.toThrow('Apify operation aborted');
    await expect(client.getDatasetItems('dataset-1', {timeoutMs: 1})).rejects.toThrow('Apify operation timed out');
  });

  it('polls with bounded exponential backoff and parses Apify array dataset pages and pagination headers', async () => {
    let runReads = 0;
    const urls: string[] = [];
    const delays: number[] = [];
    const client = new ApifyClient({
      token: 'safe', endpoint: 'https://apify.test/v2', maxPollAttempts: 3, pollDelayMs: 50, sleep: async (milliseconds) => { delays.push(milliseconds); },
      fetch: async (input) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('actor-runs')) {
          runReads += 1;
          return new Response(JSON.stringify({data: {id: 'provider-run', status: runReads === 1 ? 'RUNNING' : 'SUCCEEDED', defaultDatasetId: 'dataset-1'}}));
        }
        if (url.includes('offset=0')) return new Response(JSON.stringify([{domain: 'alpha.example'}]), {headers: {
          'X-Apify-Pagination-Offset': '0', 'X-Apify-Pagination-Limit': '1000', 'X-Apify-Pagination-Count': '1', 'X-Apify-Pagination-Total': '2',
        }});
        return new Response(JSON.stringify([{domain: 'beta.example'}]), {headers: {
          'X-Apify-Pagination-Offset': '1', 'X-Apify-Pagination-Limit': '1000', 'X-Apify-Pagination-Count': '1', 'X-Apify-Pagination-Total': '2',
        }});
      },
    });

    await expect(client.waitForRun('provider-run', {timeoutMs: 100})).resolves.toMatchObject({status: 'SUCCEEDED', datasetId: 'dataset-1'});
    await expect(client.getDatasetItems('dataset-1', {timeoutMs: 100})).resolves.toEqual([{domain: 'alpha.example'}, {domain: 'beta.example'}]);
    expect(urls.filter((url) => url.includes('datasets'))).toHaveLength(2);
    expect(delays).toEqual([50]);
  });

  it('rejects unsafe polling, pagination, and timeout caps before requesting the provider', () => {
    expect(() => new ApifyClient({token: 'safe', maxPollAttempts: 121})).toThrow('maxPollAttempts');
    expect(() => new ApifyClient({token: 'safe', maxDatasetPages: Number.NaN})).toThrow('maxDatasetPages');
    expect(() => new ApifyClient({token: 'safe', pollDelayMs: 1.5})).toThrow('pollDelayMs');
    const client = new ApifyClient({token: 'safe', endpoint: 'https://apify.test/v2', fetch: vi.fn()});
    expect(client.getDatasetItems('dataset', {timeoutMs: 120_001})).rejects.toThrow('timeoutMs');
  });
});
