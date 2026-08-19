'use client';

import {useId, useState} from 'react';
import type {Freshness as FreshnessValue} from '@/lib/domain/dashboard';

function exactUtc(timestamp: string | null): string {
  if (!timestamp) return 'Not available';
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return 'Not available';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function Freshness({freshness}: {freshness: FreshnessValue}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const label = freshness.isStale ? 'Insight stale' : 'Data current';
  const tooltip = `Last successful refresh: ${exactUtc(freshness.lastSuccessfulRunAt)}`;
  return <button className="freshness" data-stale={freshness.isStale} type="button" aria-expanded={open} aria-describedby={open ? tooltipId : undefined} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
    {label}
    <span className="freshness__tooltip" id={tooltipId} role="tooltip" hidden={!open} aria-hidden={!open}>{tooltip}</span>
  </button>;
}
