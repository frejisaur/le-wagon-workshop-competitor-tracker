import type {DashboardValue} from '@/lib/domain/dashboard';
import {normalizeDomain} from '@/lib/transforms/normalize';

const integer = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
const decimal = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const percent = new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 1});

export function valueText(value: DashboardValue | number | null | undefined, format: 'number' | 'percent' | 'points' = 'number'): string {
  const raw = typeof value === 'object' && value !== null && 'value' in value ? value.value : value;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'Not available';
  if (format === 'percent') return percent.format(raw);
  const formatted = (Number.isInteger(raw) ? integer.format(raw) : decimal.format(raw)).replace(/^-/, '−');
  return format === 'points' ? `${formatted} pts` : formatted;
}

export function exactUtc(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Not available';
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? 'Not available' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function countryName(value: string): string {
  const code = value.trim();
  if (!/^[a-z]{2}$/i.test(code)) return value;
  try { return new Intl.DisplayNames(['en'], {type: 'region'}).of(code.toUpperCase()) ?? code.toUpperCase(); } catch { return code.toUpperCase(); }
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
  return normalizeDomain(value) ?? value.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}
