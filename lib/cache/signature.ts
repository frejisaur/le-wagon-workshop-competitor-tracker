import {createHmac, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';

export const CACHE_INVALIDATION_MAX_BODY_BYTES = 1024;
export const CACHE_INVALIDATION_MAX_AGE_MS = 5 * 60 * 1000;
const BodySchema = z.object({version: z.literal('v1')}).strict();

/** Length-prefixing makes the signed byte sequence unambiguous even for arbitrary bodies. */
export function cacheInvalidationCanonicalBytes(timestamp: string, body: Uint8Array): Uint8Array {
  const timestampBytes = new TextEncoder().encode(timestamp);
  const prefix = new TextEncoder().encode(`v1\n${timestampBytes.byteLength}\n${timestamp}\n${body.byteLength}\n`);
  const canonical = new Uint8Array(prefix.byteLength + body.byteLength);
  canonical.set(prefix); canonical.set(body, prefix.byteLength);
  return canonical;
}

export function signCacheInvalidation(timestamp: string, body: Uint8Array, secret: string): string {
  return createHmac('sha256', secret).update(cacheInvalidationCanonicalBytes(timestamp, body)).digest('hex');
}

function singleHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  // Fetch combines duplicate request headers with commas. These headers have no valid comma syntax.
  return value && !value.includes(',') ? value : null;
}

export function verifyCacheInvalidation(input: {headers: Headers; body: Uint8Array; secret: string | undefined; now?: () => number}): {ok: true} | {ok: false; code: 'unauthorized' | 'invalid_request'} {
  const timestamp = singleHeader(input.headers, 'x-cache-timestamp');
  const signature = singleHeader(input.headers, 'x-cache-signature');
  if (!input.secret || !timestamp || !signature) return {ok: false, code: 'unauthorized'};
  if (!/^\d{13}$/.test(timestamp) || !/^v1=[a-f0-9]{64}$/.test(signature) || input.body.byteLength > CACHE_INVALIDATION_MAX_BODY_BYTES) return {ok: false, code: 'invalid_request'};
  const now = (input.now ?? Date.now)(); const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp) || parsedTimestamp > now || now - parsedTimestamp > CACHE_INVALIDATION_MAX_AGE_MS) return {ok: false, code: 'unauthorized'};
  try { BodySchema.parse(JSON.parse(new TextDecoder().decode(input.body))); } catch { return {ok: false, code: 'invalid_request'}; }
  const expected = Buffer.from(signCacheInvalidation(timestamp, input.body, input.secret), 'hex');
  const received = Buffer.from(signature.slice(3), 'hex');
  if (expected.byteLength !== received.byteLength || !timingSafeEqual(expected, received)) return {ok: false, code: 'unauthorized'};
  return {ok: true};
}
