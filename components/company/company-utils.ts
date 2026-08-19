import type {DashboardValue} from '@/lib/domain/dashboard';

const integer = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
const decimal = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const percent = new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 1});

export function valueText(value: DashboardValue | number | null | undefined, format: 'number' | 'percent' = 'number'): string {
  const raw = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'Not available';
  return format === 'percent' ? percent.format(raw) : Number.isInteger(raw) ? integer.format(raw) : decimal.format(raw);
}

export function provenance(value: DashboardValue): string {
  return `Source: ${value.source ?? 'Not available'}; Database: ${value.database ?? 'Not available'}; ${value.observedAt ? `Observed: ${value.observedAt}` : value.calculatedAt ? `Calculated: ${value.calculatedAt}` : 'Date: Not available'}`;
}

/** Links are curated URLs, but presentation applies a final protocol guard. */
export function safeExternalUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch { return undefined; }
}

export function canonicalDomain(value: string): string {
  try { return new URL(`https://${value}`).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); } catch { return value.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); }
}
