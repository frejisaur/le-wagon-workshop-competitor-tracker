import type {LandingPagePortfolio} from '@/lib/domain/metrics';
import {normalizeUrl} from './normalize';

export type DatedMetricPoint = {date: string; value: number | null | undefined};
export type LandingPageKeyword = {keyword: string | null; url: string | null; traffic: number | null | undefined};

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export type ParsedIsoCalendarDate = {year: number; month: number; day: number; timestamp: number; isoDate: string};

/** Validates ISO or Semrush compact calendar dates and returns one canonical ISO date. */
export function parseIsoCalendarDate(value: string): ParsedIsoCalendarDate | null {
  const match = /^(\d{4})(?:-?)(\d{2})(?:-?)(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  return Number.isFinite(timestamp) && new Date(timestamp).getUTCFullYear() === year && new Date(timestamp).getUTCMonth() === month - 1 && new Date(timestamp).getUTCDate() === day
    ? {year, month, day, timestamp, isoDate: `${match[1]}-${match[2]}-${match[3]}`}
    : null;
}

function sortedValidDates(points: DatedMetricPoint[]) {
  return points
    .map((point) => ({...point, dateParts: parseIsoCalendarDate(point.date)}))
    .filter((point): point is DatedMetricPoint & {dateParts: ParsedIsoCalendarDate} => point.dateParts !== null)
    .sort((left, right) => left.dateParts.timestamp - right.dateParts.timestamp);
}

function calculateMovementAtTarget(points: DatedMetricPoint[], target: (latest: {year: number; month: number; day: number; timestamp: number}) => number): number | null {
  const sorted = sortedValidDates(points);
  const latest = sorted.at(-1);
  if (!latest || !finiteNumber(latest.value)) return null;
  const baseline = [...sorted].reverse().find((point) => point.dateParts.timestamp <= target(latest.dateParts));
  if (!baseline || !finiteNumber(baseline.value) || baseline.value === 0) return null;
  return (latest.value - baseline.value) / baseline.value;
}

/** Returns `(latest - baseline) / baseline` using the latest point at or before the target date. */
export function calculateMovement(points: DatedMetricPoint[], days: number): number | null {
  if (!Number.isFinite(days) || days < 0) return null;
  return calculateMovementAtTarget(points, (latest) => latest.timestamp - days * 86_400_000);
}

/** Returns movement against the corresponding calendar month, clamping day-of-month at month end. */
export function calculateMovementMonths(points: DatedMetricPoint[], months: number): number | null {
  if (!Number.isInteger(months) || months < 0) return null;
  return calculateMovementAtTarget(points, (latest) => {
    const targetMonth = latest.month - 1 - months;
    const finalDay = new Date(Date.UTC(latest.year, targetMonth + 1, 0)).getUTCDate();
    return Date.UTC(latest.year, targetMonth, Math.min(latest.day, finalDay));
  });
}

export function calculateNonBrandShare(branded: number | null | undefined, nonBrand: number | null | undefined): number | null {
  if (!finiteNumber(branded) || !finiteNumber(nonBrand)) return null;
  const total = branded + nonBrand;
  return total === 0 ? null : nonBrand / total;
}

/** Difference in provider visibility points; a negative result is below benchmark. */
export function calculateBenchmarkGap(visibility: number | null | undefined, benchmark: number | null | undefined): number | null {
  return finiteNumber(visibility) && finiteNumber(benchmark) ? visibility - benchmark : null;
}

export function calculateTrackedSetShare(companyTraffic: number | null | undefined, totalTraffic: number | null | undefined): number | null {
  return finiteNumber(companyTraffic) && finiteNumber(totalTraffic) && totalTraffic !== 0 ? companyTraffic / totalTraffic : null;
}

/** Groups the observed keyword sample by a normalized, public landing URL. */
export function buildLandingPagePortfolio(keywords: LandingPageKeyword[]): LandingPagePortfolio[] {
  const groups = new Map<string, {keywords: string[]; traffic: number | null}>();
  for (const keyword of keywords) {
    if (!keyword.keyword || !keyword.url) continue;
    const normalizedLandingUrl = normalizeUrl(keyword.url);
    if (!normalizedLandingUrl) continue;
    const group = groups.get(normalizedLandingUrl) ?? {keywords: [], traffic: 0};
    group.keywords.push(keyword.keyword);
    group.traffic = finiteNumber(group.traffic) && finiteNumber(keyword.traffic) ? group.traffic + keyword.traffic : null;
    groups.set(normalizedLandingUrl, group);
  }
  return [...groups.entries()]
    .map(([normalizedLandingUrl, group]) => ({normalizedLandingUrl, keywordCount: group.keywords.length, estimatedTraffic: group.traffic, keywords: group.keywords}))
    .sort((left, right) => left.normalizedLandingUrl.localeCompare(right.normalizedLandingUrl));
}
