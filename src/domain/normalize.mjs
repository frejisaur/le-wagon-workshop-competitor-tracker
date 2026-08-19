export function normalizeDomain(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return hostname && hostname.includes('.') ? hostname : null;
  } catch {
    return null;
  }
}

export function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
