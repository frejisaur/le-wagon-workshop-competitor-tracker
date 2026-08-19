'use client';

import {Button, Select, SelectItem, TextInput} from '@carbon/react';
import {useEffect, useState} from 'react';
import type {LandscapeFilterState} from './filter-state';

type Props = {state: LandscapeFilterState; countries: readonly string[]; segments: readonly string[]; paidAvailable: boolean; aiAvailable: boolean; onChange: (change: Partial<LandscapeFilterState>) => void; onClear: () => void; active: boolean};

function present(value: number | undefined): string { return value === undefined ? '' : String(value); }

export function LandscapeFilters({state, countries, segments, paidAvailable, aiAvailable, onChange, onClear, active}: Props) {
  const [trafficMin, setTrafficMin] = useState(present(state.trafficMin));
  const [trafficMax, setTrafficMax] = useState(present(state.trafficMax));
  const [authorityMin, setAuthorityMin] = useState(present(state.authorityMin));
  const [authorityMax, setAuthorityMax] = useState(present(state.authorityMax));
  const [rangeError, setRangeError] = useState<string>();
  useEffect(() => { setTrafficMin(present(state.trafficMin)); setTrafficMax(present(state.trafficMax)); setAuthorityMin(present(state.authorityMin)); setAuthorityMax(present(state.authorityMax)); setRangeError(undefined); }, [state.trafficMin, state.trafficMax, state.authorityMin, state.authorityMax]);
  const number = (value: string, max: number) => value === '' ? undefined : /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number(value) <= max ? Number(value) : null;
  const applyRanges = () => {
    const nextTrafficMin = number(trafficMin, 1_000_000_000_000); const nextTrafficMax = number(trafficMax, 1_000_000_000_000);
    const nextAuthorityMin = number(authorityMin, 100); const nextAuthorityMax = number(authorityMax, 100);
    if ([nextTrafficMin, nextTrafficMax, nextAuthorityMin, nextAuthorityMax].includes(null) || (nextTrafficMin !== undefined && nextTrafficMax !== undefined && nextTrafficMin! > nextTrafficMax!) || (nextAuthorityMin !== undefined && nextAuthorityMax !== undefined && nextAuthorityMin! > nextAuthorityMax!)) {
      setRangeError('Enter non-negative ranges with a minimum no greater than its maximum.'); return;
    }
    setRangeError(undefined);
    onChange({trafficMin: nextTrafficMin ?? undefined, trafficMax: nextTrafficMax ?? undefined, authorityMin: nextAuthorityMin ?? undefined, authorityMax: nextAuthorityMax ?? undefined});
  };
  return <section className="landscape-filters" aria-label="Landscape filters">
    <div className="landscape-filters__frequent">
      <Select id="country" labelText="Country" value={state.country ?? ''} onChange={(event) => onChange({country: event.target.value || undefined})}>
        <SelectItem value="" text="All countries" />{countries.map((country) => <SelectItem key={country} value={country} text={country} />)}<SelectItem value="unknown" text="Not available" />
      </Select>
      <Select id="paid" labelText="Paid activity" value={state.paid ?? ''} disabled={!paidAvailable} onChange={(event) => onChange({paid: (event.target.value || undefined) as LandscapeFilterState['paid']})}>
        <SelectItem value="" text="All activity" /><SelectItem value="active" text="Active" /><SelectItem value="inactive" text="Inactive" /><SelectItem value="unknown" text="Not available" />
      </Select>
      <Select id="ai" labelText="AI performance" value={state.ai ?? ''} disabled={!aiAvailable} onChange={(event) => onChange({ai: (event.target.value || undefined) as LandscapeFilterState['ai']})}>
        <SelectItem value="" text="All performance" /><SelectItem value="outperforming" text="Outperforming" /><SelectItem value="not_outperforming" text="Not outperforming" /><SelectItem value="unknown" text="Not available" />
      </Select>
    </div>
    <details className="landscape-filters__expanded"><summary>More filters</summary><div className="landscape-filters__range-grid">
      <TextInput id="trafficMin" labelText="Traffic minimum" value={trafficMin} invalid={Boolean(rangeError)} invalidText={rangeError} onChange={(event) => setTrafficMin(event.target.value)} />
      <TextInput id="trafficMax" labelText="Traffic maximum" value={trafficMax} invalid={Boolean(rangeError)} invalidText={rangeError} onChange={(event) => setTrafficMax(event.target.value)} />
      <TextInput id="authorityMin" labelText="Authority minimum" value={authorityMin} invalid={Boolean(rangeError)} invalidText={rangeError} onChange={(event) => setAuthorityMin(event.target.value)} />
      <TextInput id="authorityMax" labelText="Authority maximum" value={authorityMax} invalid={Boolean(rangeError)} invalidText={rangeError} onChange={(event) => setAuthorityMax(event.target.value)} />
      <Select id="segment" labelText="Apollo segment" value={state.segment ?? ''} onChange={(event) => onChange({segment: event.target.value || undefined})}><SelectItem value="" text="All segments" />{segments.map((segment) => <SelectItem key={segment} value={segment} text={segment} />)}<SelectItem value="unknown" text="Not available" /></Select>
      <Button kind="secondary" type="button" onClick={applyRanges}>Apply numeric filters</Button>
    </div></details>
    {active ? <Button kind="ghost" type="button" onClick={onClear}>Clear filters</Button> : null}
  </section>;
}
