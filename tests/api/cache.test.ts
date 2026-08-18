import {describe, expect, it, vi} from 'vitest';
import {createHmac} from 'node:crypto';
import {cacheInvalidationCanonicalBytes, CacheInvalidationReplayStore, readBoundedInvalidationBody, signCacheInvalidation, verifyCacheInvalidation} from '@/lib/cache/signature';
import {createCacheInvalidationAdapter} from '@/lib/cache/invalidation-client';

describe('signed cache invalidation', () => {
  it('accepts only a current signature over the exact versioned timestamp/body bytes', () => {
    const body = new TextEncoder().encode('{"version":"v1","nonce":"0123456789abcdef"}');
    const timestamp = '1766059200000';
    const signature = createHmac('sha256', 'test-secret').update(cacheInvalidationCanonicalBytes(timestamp, body)).digest('hex');
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => Number(timestamp)})).toMatchObject({ok: true, nonce: '0123456789abcdef'});
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature.slice(1)}`}), body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': String(Number(timestamp) + 1), 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature}`, 'content-type': 'application/json'}), body: new TextEncoder().encode('{"version":"v2","nonce":"0123456789abcdef"}'), secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    const multiple = new Headers({'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signature}`}); multiple.append('x-cache-signature', `v1=${signature}`);
    expect(verifyCacheInvalidation({headers: multiple, body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
    expect(verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': String(Number(timestamp) - 300_001), 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => Number(timestamp)}).ok).toBe(false);
  });

  it('records a nonce only after authentication and rejects a bounded replay', () => {
    const now = 1_766_059_200_000;
    const body = new TextEncoder().encode('{"version":"v1","nonce":"0123456789abcdef"}');
    const signature = signCacheInvalidation(String(now), body, 'test-secret');
    const verified = verifyCacheInvalidation({headers: new Headers({'x-cache-timestamp': String(now), 'x-cache-signature': `v1=${signature}`}), body, secret: 'test-secret', now: () => now});
    expect(verified.ok).toBe(true);
    const replay = new CacheInvalidationReplayStore({maxEntries: 2, now: () => now});
    if (verified.ok) {
      expect(replay.consume(verified.nonce, signature)).toBe(true);
      expect(replay.consume(verified.nonce, signature)).toBe(false);
    }
    expect(replay.size()).toBe(1);
  });

  it('stops reading a chunked body once it exceeds the one-kibibyte cap', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({start(controller) { controller.enqueue(new Uint8Array(800)); controller.enqueue(new Uint8Array(300)); }, cancel() { cancelled = true; }});
    await expect(readBoundedInvalidationBody(stream)).rejects.toThrow('body_too_large');
    expect(cancelled).toBe(true);
  });

  it('posts exact signed bytes after the workflow terminal transition and safely handles non-2xx', async () => {
    const calls: Array<{url: string; body: string; headers: HeadersInit | undefined}> = [];
    const adapter = createCacheInvalidationAdapter({baseUrl: 'https://app.example', secret: 'test-secret', nonce: () => '0123456789abcdef', now: () => new Date('2026-08-18T12:00:00.000Z'), fetch: async (url, init) => {
      calls.push({url: String(url), body: new TextDecoder().decode(init?.body as Uint8Array), headers: init?.headers});
      return new Response('', {status: 503});
    }});
    await expect(adapter.invalidate()).rejects.toThrow('cache_invalidation_failed');
    expect(calls[0]).toMatchObject({url: 'https://app.example/api/internal/cache', body: '{"version":"v1","nonce":"0123456789abcdef"}'});
    const headers = calls[0]?.headers as Record<string, string>;
    const sent = new TextEncoder().encode(calls[0]!.body);
    expect(headers['x-cache-signature']).toBe(`v1=${signCacheInvalidation(headers['x-cache-timestamp'], sent, 'test-secret')}`);
  });

  it('rejects unsafe live cache destinations and permits explicit local development loopback only', () => {
    expect(() => createCacheInvalidationAdapter({baseUrl: 'http://app.example', secret: 'test-secret'})).toThrow(/https/i);
    expect(() => createCacheInvalidationAdapter({baseUrl: 'https://user:pass@app.example/path?x=1', secret: 'test-secret'})).toThrow(/base URL/i);
    expect(() => createCacheInvalidationAdapter({baseUrl: 'http://127.0.0.1:3000', secret: 'test-secret', environment: 'development'})).not.toThrow();
  });

  it('disables redirects and turns a redirect into the same sanitized adapter failure', async () => {
    const fetch = vi.fn(async () => new Response('', {status: 302, headers: {location: 'https://attacker.example'}}));
    const adapter = createCacheInvalidationAdapter({baseUrl: 'https://app.example', secret: 'test-secret', nonce: () => '0123456789abcdef', fetch});
    await expect(adapter.invalidate()).rejects.toThrow('cache_invalidation_failed');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>)[0]?.[1]).toMatchObject({redirect: 'error'});
  });
});
