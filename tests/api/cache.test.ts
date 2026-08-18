import {describe, expect, it} from 'vitest';
import {createHmac} from 'node:crypto';
import {cacheInvalidationCanonicalBytes, signCacheInvalidation, verifyCacheInvalidation} from '@/lib/cache/signature';
import {createCacheInvalidationAdapter} from '@/lib/cache/invalidation-client';

describe('signed cache invalidation', () => {
  it('accepts only a current signature over the exact versioned timestamp/body bytes', () => {
    const body = new TextEncoder().encode('{"version":"v1"}');
    const timestamp = '1766059200000';
    const signature = createHmac('sha256', 'test-secret').update(cacheInvalidationCanonicalBytes(timestamp, body)).digest('hex');
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => Number(timestamp)})).toEqual({ok: true});
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature.slice(1)}`}), body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': String(Number(timestamp) + 1), 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature}`, 'content-type': 'application/json'}), body: new TextEncoder().encode('{"version":"v2"}'), secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    const multiple = new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature}`}); multiple.append('x-cache-signature', `v1=${signature}`);
    expect(verifyCacheInvalidation({headers: multiple, body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': String(Number(timestamp) - 300_001), 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
  });

  it('posts exact signed bytes after the workflow terminal transition and safely handles non-2xx', async () => {
    const calls: Array<{url: string; body: string; headers: HeadersInit | undefined}> = [];
    const adapter = createCacheInvalidationAdapter({baseUrl: 'https://app.example', secret: 'test-secret', now: () => new Date('2026-08-18T12:00:00.000Z'), fetch: async (url, init) => {
      calls.push({url: String(url), body: new TextDecoder().decode(init?.body as Uint8Array), headers: init?.headers});
      return new Response('', {status: 503});
    }});
    await expect(adapter.invalidate()).rejects.toThrow('cache_invalidation_failed');
    expect(calls[0]).toMatchObject({url: 'https://app.example/api/internal/cache', body: '{"version":"v1"}'});
    const headers = calls[0]?.headers as Record<string, string>;
    const sent = new TextEncoder().encode(calls[0]!.body);
    expect(headers['x-cache-signature']).toBe(`v1=${signCacheInvalidation(headers['x-cache-timestamp'], sent, 'test-secret')}`);
  });
});
