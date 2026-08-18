import type {ProviderNumber} from '@/lib/domain/metrics';

const compactNumber = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([kKmMbB])?\s*(%)?$/;
const multiplier: Record<string, number> = {k: 1_000, m: 1_000_000, b: 1_000_000_000};

/** Parses the compact number formats observed in Moz while preserving the provider string. */
export function parseCompactNumber(value: string | null | undefined): ProviderNumber {
  if (typeof value !== 'string') return {raw: null, normalized: null};
  const match = compactNumber.exec(value.trim());
  if (!match) return {raw: value, normalized: null};
  const numeric = Number(match[1]) * (match[2] ? multiplier[match[2].toLowerCase()] : 1);
  const normalized = match[3] ? numeric / 100 : numeric;
  return {raw: value, normalized: Number.isFinite(normalized) ? normalized : null};
}
