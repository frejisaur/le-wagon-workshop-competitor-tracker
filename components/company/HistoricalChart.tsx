'use client';

import {useMemo, useState} from 'react';
import {Dropdown} from '@carbon/react';
import type {CompanyResponse} from '@/lib/domain/dashboard';
import {provenance, valueText} from './company-utils';

export type ComparisonDataset = readonly CompanyResponse[];

type TrendPoint = CompanyResponse['trend'][number];

function recentTrend(trend: readonly TrendPoint[]): TrendPoint[] { return [...trend].sort((left, right) => left.date.localeCompare(right.date)).slice(-24); }

export function HistoricalChart({trend, comparison = []}: {trend: CompanyResponse['trend']; comparison?: ComparisonDataset}) {
  const [metric, setMetric] = useState('organicTraffic');
  const [tooltip, setTooltip] = useState<TrendPoint | undefined>();
  const rows = useMemo(() => recentTrend(trend), [trend]);
  const comparisons = useMemo(() => comparison.filter((item) => item.companyId !== '').slice(0, 3), [comparison]);
  const gaps = rows.filter((item) => typeof item.organicTraffic.value !== 'number').length;
  const available = rows.filter((item) => typeof item.organicTraffic.value === 'number');
  return <section className="historical-chart" aria-labelledby="historical-chart-heading">
    <div className="company-module__heading"><div><h2 id="historical-chart-heading">Historical organic reach</h2><p>24-month observed window. Missing observations remain gaps.</p></div><Dropdown id="historical-metric" label="Metric" titleText="Metric" items={[{id: 'organicTraffic', text: 'Organic traffic'}, {id: 'unavailable', text: 'Organic keywords (not available)'}]} selectedItem={metric === 'organicTraffic' ? {id: 'organicTraffic', text: 'Organic traffic'} : {id: 'unavailable', text: 'Organic keywords (not available)'}} itemToString={(item) => item?.text ?? ''} onChange={({selectedItem}) => setMetric(selectedItem?.id ?? 'organicTraffic')} size="sm" /></div>
    {metric === 'unavailable' ? <p className="company-module__unavailable">No keyword history is available in the validated response.</p> : <>
      <p className="historical-chart__summary">{available.length ? `Organic traffic is available for ${available.length} of ${rows.length} months.` : 'No observed organic traffic history is available.'} {comparisons.length ? `Showing ${comparisons.length} explicitly supplied comparison ${comparisons.length === 1 ? 'company' : 'companies'}.` : ''}</p>
      {comparison.length > 3 ? <p className="company-module__notice">Showing the first 3 comparison companies in supplied order.</p> : null}
      {comparisons.length ? <ul className="historical-chart__comparisons" aria-label="Comparison companies">{comparisons.map((item) => <li key={item.companyId}>{item.identity.displayName ?? item.identity.domain}: {recentTrend(item.trend).filter((point) => typeof point.organicTraffic.value === 'number').length} observed months</li>)}</ul> : null}
      <div className="historical-chart__canvas" data-testid="historical-chart" data-gap-count={gaps} data-comparison-count={comparisons.length} aria-label="Organic traffic chart">
        {rows.map((point) => typeof point.organicTraffic.value === 'number' ? <button type="button" className="historical-chart__point" key={point.date} aria-label={`${point.date}, ${valueText(point.organicTraffic)}`} onClick={() => setTooltip(point)}>{valueText(point.organicTraffic)}</button> : <span className="historical-chart__gap" key={point.date} aria-label={`${point.date}, not available`} role="img">Gap</span>)}
      </div>
      {tooltip ? <div className="historical-chart__tooltip" role="tooltip"><p>Date: {tooltip.date}</p><p>Value: {valueText(tooltip.organicTraffic)}</p><p>Source: {tooltip.organicTraffic.source ?? 'Not available'}</p><p>Database: {tooltip.organicTraffic.database ?? 'Not available'}</p></div> : null}
      <table className="company-table" aria-label="Organic traffic historical data"><caption>Organic traffic data table</caption><thead><tr><th scope="col">Date</th><th scope="col" className="company-table__numeric">Estimated organic traffic</th><th scope="col">Provenance</th></tr></thead><tbody>{rows.map((point) => <tr key={point.date}><td>{point.date}</td><td className="company-table__numeric">{valueText(point.organicTraffic)}</td><td>{provenance(point.organicTraffic)}</td></tr>)}</tbody></table>
    </>}
  </section>;
}
