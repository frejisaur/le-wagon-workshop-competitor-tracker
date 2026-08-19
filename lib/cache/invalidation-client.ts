import {randomUUID} from 'node:crypto';
import {signCacheInvalidation} from './signature';

export type CacheInvalidationAdapterOptions = {baseUrl: string; secret: string; timeoutMs?: number; now?: () => Date; nonce?: () => string; environment?: 'production' | 'development' | 'test'; fetch?: typeof globalThis.fetch};

function validatedEndpoint(value: string, environment: CacheInvalidationAdapterOptions['environment']): string {
  const base = new URL(value);
  const loopback = base.hostname === 'localhost' || base.hostname === '127.0.0.1' || base.hostname === '[::1]';
  const allowHttp = loopback && (environment === 'development' || environment === 'test');
  if ((base.protocol !== 'https:' && !allowHttp) || base.username || base.password || base.hash || base.search || base.pathname !== '/') throw new TypeError('cache invalidation base URL must be an HTTPS origin with a root base path');
  return new URL('/api/internal/cache', base).toString();
}

/** Server-only refresh adapter. It signs exact JSON bytes and never includes its secret in errors. */
export function createCacheInvalidationAdapter(options: CacheInvalidationAdapterOptions): {invalidate: () => Promise<void>} {
  const endpoint = validatedEndpoint(options.baseUrl, options.environment ?? (process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'test' ? 'test' : 'development'));
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError('cache invalidation timeout must be between 1 and 30000ms');
  return {invalidate: async () => {
    const nonce = (options.nonce ?? (() => randomUUID().replaceAll('-', '')))();
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(nonce)) throw new Error('cache_invalidation_failed');
    const body = new TextEncoder().encode(JSON.stringify({version: 'v1', nonce}));
    const timestamp = String((options.now ?? (() => new Date()))().getTime());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await (options.fetch ?? globalThis.fetch)(endpoint, {method: 'POST', redirect: 'error', body, signal: controller.signal, headers: {'content-type': 'application/json', 'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signCacheInvalidation(timestamp, body, options.secret)}`}});
      if (!response.ok) throw new Error('cache_invalidation_failed');
    } catch {
      throw new Error('cache_invalidation_failed');
    } finally { clearTimeout(timer); }
  }};
}
