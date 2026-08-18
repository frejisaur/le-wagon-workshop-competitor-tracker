import type {Freshness as FreshnessValue} from '@/lib/domain/dashboard';

function exactUtc(timestamp: string | null): string {
  if (!timestamp) return 'Not available';
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return 'Not available';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function Freshness({freshness}: {freshness: FreshnessValue}) {
  const label = freshness.isStale ? 'Insight stale' : 'Data current';
  const tooltip = `Last successful refresh: ${exactUtc(freshness.lastSuccessfulRunAt)}`;
  return <button className="freshness" data-stale={freshness.isStale} type="button" aria-describedby="freshness-tooltip" aria-label={`${label}. ${tooltip}`}>
    {label}
    <span className="freshness__tooltip" id="freshness-tooltip" role="tooltip">{tooltip}</span>
  </button>;
}
