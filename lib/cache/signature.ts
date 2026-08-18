import {createHmac, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';

export const CACHE_INVALIDATION_MAX_BODY_BYTES = 1024;
export const CACHE_INVALIDATION_MAX_AGE_MS = 5 * 60 * 1000;
const BodySchema = z.object({version: z.literal('v1'), nonce: z.string().regex(/^[A-Za-z0-9_-]{16,96}$/)}).strict();
export type VerifiedInvalidation = {ok: true; nonce: string; signature: string} | {ok: false; code: 'unauthorized' | 'invalid_request'};

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

export function verifyCacheInvalidation(input: {headers: Headers; body: Uint8Array; secret: string | undefined; now?: () => number}): VerifiedInvalidation {
  const timestamp = singleHeader(input.headers, 'x-cache-timestamp');
  const signature = singleHeader(input.headers, 'x-cache-signature');
  if (!input.secret || !timestamp || !signature) return {ok: false, code: 'unauthorized'};
  if (!/^\d{13}$/.test(timestamp) || !/^v1=[a-f0-9]{64}$/.test(signature) || input.body.byteLength > CACHE_INVALIDATION_MAX_BODY_BYTES) return {ok: false, code: 'invalid_request'};
  const now = (input.now ?? Date.now)(); const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp) || parsedTimestamp > now || now - parsedTimestamp > CACHE_INVALIDATION_MAX_AGE_MS) return {ok: false, code: 'unauthorized'};
  let body: z.infer<typeof BodySchema>;
  try { body = BodySchema.parse(JSON.parse(new TextDecoder().decode(input.body))); } catch { return {ok: false, code: 'invalid_request'}; }
  const expected = Buffer.from(signCacheInvalidation(timestamp, input.body, input.secret), 'hex');
  const received = Buffer.from(signature.slice(3), 'hex');
  if (expected.byteLength !== received.byteLength || !timingSafeEqual(expected, received)) return {ok: false, code: 'unauthorized'};
  return {ok: true, nonce: body.nonce, signature: signature.slice(3)};
}

/** Bounded per-process replay defence. Serverless instances cannot share this state. */
export class CacheInvalidationReplayStore {
  private readonly entries = new Map<string, {signature: string; timestamp: number}>();
  private readonly maxEntries: number;
  private readonly now: () => number;
  constructor(options: {maxEntries?: number; now?: () => number} = {}) { this.maxEntries = options.maxEntries ?? 1_000; this.now = options.now ?? Date.now; }
  consume(nonce: string, signature: string): boolean {
    const now = this.now();
    for (const [key, entry] of this.entries) if (now - entry.timestamp > CACHE_INVALIDATION_MAX_AGE_MS) this.entries.delete(key);
    // Either token is single-use: changing the timestamp cannot make a nonce reusable.
    if (this.entries.has(nonce) || [...this.entries.values()].some((entry) => entry.signature === signature)) return false;
    this.entries.set(nonce, {signature, timestamp: now});
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    return true;
  }
  size(): number { return this.entries.size; }
}

/** Reads a request incrementally and cancels before retaining more than the signed body limit. */
export async function readBoundedInvalidationBody(stream: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
  if (!stream) throw new RangeError('invalid_body');
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > CACHE_INVALIDATION_MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError('body_too_large'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}
