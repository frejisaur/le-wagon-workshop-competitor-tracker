export const sortOptions = ['authority-asc', 'authority-desc', 'traffic-asc', 'traffic-desc', 'movement-asc', 'movement-desc', 'nonBrand-asc', 'nonBrand-desc', 'keywords-asc', 'keywords-desc', 'paid-asc', 'paid-desc', 'ai-asc', 'ai-desc', 'referring-asc', 'referring-desc'] as const;
export type LandscapeSort = (typeof sortOptions)[number];
export type PaidFilter = 'active' | 'inactive' | 'unknown';
export type AiFilter = 'outperforming' | 'not_outperforming' | 'unknown';
export type LandscapeFilterState = {country?: string; paid?: PaidFilter; ai?: AiFilter; trafficMin?: number; trafficMax?: number; authorityMin?: number; authorityMax?: number; segment?: string; sort: LandscapeSort; selectedCompany?: string};

type ParseOptions = {companyIds?: ReadonlySet<string>; countries?: ReadonlySet<string>; segments?: ReadonlySet<string>};
const MAX_TRAFFIC = 1_000_000_000_000;
const MAX_AUTHORITY = 100;
const allowedText = /^[\p{L}\p{N} .,&'/-]{1,64}$/u;

function stringFrom(params: URLSearchParams, key: string, allowed?: ReadonlySet<string>): string | undefined {
  const value = params.get(key);
  if (!value || !allowedText.test(value)) return undefined;
  return allowed && value !== 'unknown' && !allowed.has(value) ? undefined : value;
}
function boundedNumber(params: URLSearchParams, key: string, max: number): number | undefined {
  const value = params.get(key);
  if (!value || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= max ? numeric : undefined;
}

/** Parses only supported, bounded URL values; unknown query keys are ignored. */
export function parseLandscapeState(search: string, options: ParseOptions = {}): LandscapeFilterState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const paid = params.get('paid');
  const ai = params.get('ai');
  const sort = params.get('sort');
  const trafficMin = boundedNumber(params, 'trafficMin', MAX_TRAFFIC);
  const trafficMax = boundedNumber(params, 'trafficMax', MAX_TRAFFIC);
  const authorityMin = boundedNumber(params, 'authorityMin', MAX_AUTHORITY);
  const authorityMax = boundedNumber(params, 'authorityMax', MAX_AUTHORITY);
  const state: LandscapeFilterState = {
    ...(stringFrom(params, 'country', options.countries) ? {country: stringFrom(params, 'country', options.countries)} : {}),
    ...(paid === 'active' || paid === 'inactive' || paid === 'unknown' ? {paid} : {}),
    ...(ai === 'outperforming' || ai === 'not_outperforming' || ai === 'unknown' ? {ai} : {}),
    ...(trafficMin !== undefined && trafficMax !== undefined && trafficMin <= trafficMax ? {trafficMin, trafficMax} : trafficMin !== undefined && trafficMax === undefined ? {trafficMin} : trafficMax !== undefined && trafficMin === undefined ? {trafficMax} : {}),
    ...(authorityMin !== undefined && authorityMax !== undefined && authorityMin <= authorityMax ? {authorityMin, authorityMax} : authorityMin !== undefined && authorityMax === undefined ? {authorityMin} : authorityMax !== undefined && authorityMin === undefined ? {authorityMax} : {}),
    ...(stringFrom(params, 'segment', options.segments) ? {segment: stringFrom(params, 'segment', options.segments)} : {}),
    sort: sortOptions.includes(sort as LandscapeSort) ? sort as LandscapeSort : 'traffic-desc',
    ...(stringFrom(params, 'selectedCompany', options.companyIds) ? {selectedCompany: stringFrom(params, 'selectedCompany', options.companyIds)} : {}),
  };
  return state;
}

/** Emits one stable query representation, so links remain shareable and comparable. */
export function serializeLandscapeState(state: LandscapeFilterState): string {
  const params = new URLSearchParams();
  if (state.country) params.set('country', state.country);
  if (state.paid) params.set('paid', state.paid);
  if (state.ai) params.set('ai', state.ai);
  if (state.trafficMin !== undefined) params.set('trafficMin', String(state.trafficMin));
  if (state.trafficMax !== undefined) params.set('trafficMax', String(state.trafficMax));
  if (state.authorityMin !== undefined) params.set('authorityMin', String(state.authorityMin));
  if (state.authorityMax !== undefined) params.set('authorityMax', String(state.authorityMax));
  if (state.segment) params.set('segment', state.segment);
  params.set('sort', state.sort);
  if (state.selectedCompany) params.set('selectedCompany', state.selectedCompany);
  return params.toString();
}

export function hasActiveFilters(state: LandscapeFilterState): boolean {
  return Boolean(state.country || state.paid || state.ai || state.trafficMin !== undefined || state.trafficMax !== undefined || state.authorityMin !== undefined || state.authorityMax !== undefined || state.segment);
}

export function clearLandscapeFilters(state: LandscapeFilterState): LandscapeFilterState {
  return {sort: state.sort};
}
