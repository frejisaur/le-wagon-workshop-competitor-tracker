import {isIP} from 'node:net';

const explicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i;
const hostnameLabel = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|xn--[a-z0-9-]{1,59})$/i;
const publicSuffix = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i;

function parsePublicUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(explicitScheme.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!isPublicLookingHostname(hostname)) return null;
  return url;
}

function isPublicLookingHostname(hostname: string): boolean {
  if (!hostname || hostname === 'localhost' || isIP(hostname) !== 0 || hostname.length > 253) return false;
  const labels = hostname.split('.');
  if (labels.length < 2 || labels.some((label) => !hostnameLabel.test(label))) return false;
  return publicSuffix.test(labels.at(-1) ?? '');
}

/** Normalizes a provider domain into the one roster join key. */
export function normalizeDomain(value: string): string | null {
  const url = parsePublicUrl(value);
  if (!url) return null;
  return url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

/** Normalizes a keyword/ad landing URL while retaining path and query identity. */
export function normalizeUrl(value: string): string | null {
  const url = parsePublicUrl(value);
  if (!url) return null;
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  url.hash = '';
  return url.toString();
}
