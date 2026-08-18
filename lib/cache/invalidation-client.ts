import {signCacheInvalidation} from './signature';

export type CacheInvalidationAdapterOptions = {baseUrl: string; secret: string; timeoutMs?: number; now?: () => Date; fetch?: typeof globalThis.fetch};

/** Server-only refresh adapter. It signs exact JSON bytes and never includes its secret in errors. */
export function createCacheInvalidationAdapter(options: CacheInvalidationAdapterOptions): {invalidate: () => Promise<void>} {
  const baseUrl = new URL(options.baseUrl);
  const endpoint = new URL('/api/internal/cache', baseUrl).toString();
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError('cache invalidation timeout must be between 1 and 30000ms');
  return {invalidate: async () => {
    const body = new TextEncoder().encode('{"version":"v1"}');
    const timestamp = String((options.now ?? (() => new Date()))().getTime());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await (options.fetch ?? globalThis.fetch)(endpoint, {method: 'POST', body, signal: controller.signal, headers: {'content-type': 'application/json', 'x-cache-timestamp': timestamp, 'x-cache-signature': `v1=${signCacheInvalidation(timestamp, body, options.secret)}`}});
      if (!response.ok) throw new Error('cache_invalidation_failed');
    } catch {
      throw new Error('cache_invalidation_failed');
    } finally { clearTimeout(timer); }
  }};
}
