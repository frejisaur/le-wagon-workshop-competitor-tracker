'use client';

import {useMemo, useState} from 'react';
import {Dropdown} from '@carbon/react';
import type {CompanyComparison, CompanyResponse} from '@/lib/domain/dashboard';
import {provenance, valueText} from './company-utils';

export type ComparisonDataset = readonly CompanyComparison[];

type TrendPoint = CompanyResponse['trend'][number];
type TooltipPoint = {company: string; point: TrendPoint};

function recentTrend(trend: readonly TrendPoint[]): TrendPoint[] { return [...trend].sort((left, right) => left.date.localeCompare(right.date)).slice(-24); }

export function HistoricalChart({trend, comparison = []}: {trend: CompanyResponse['trend']; comparison?: ComparisonDataset}) {
  const [metric, setMetric] = useState('organicTraffic');
  const [tooltip, setTooltip] = useState<TooltipPoint | undefined>();
  const rows = useMemo(() => recentTrend(trend), [trend]);
  const comparisons = useMemo(() => comparison.filter((item) => item.companyId !== '').slice(0, 2), [comparison]);
  const gaps = rows.filter((item) => typeof item.organicTraffic.value !== 'number').length;
  const available = rows.filter((item) => typeof item.organicTraffic.value === 'number');
  return <section className="historical-chart" aria-labelledby="historical-chart-heading">
    <div className="company-module__heading"><div><h2 id="historical-chart-heading">Historical organic reach</h2><p>24-month observed window. Missing observations remain gaps.</p></div><Dropdown id="historical-metric" label="Metric" titleText="Metric" items={[{id: 'organicTraffic', text: 'Organic traffic'}, {id: 'unavailable', text: 'Organic keywords (not available)'}]} selectedItem={metric === 'organicTraffic' ? {id: 'organicTraffic', text: 'Organic traffic'} : {id: 'unavailable', text: 'Organic keywords (not available)'}} itemToString={(item) => item?.text ?? ''} onChange={({selectedItem}) => setMetric(selectedItem?.id ?? 'organicTraffic')} size="sm" /></div>
    {metric === 'unavailable' ? <p className="company-module__unavailable">No keyword history is available in the validated response.</p> : <>
      <p className="historical-chart__summary">{available.length ? `Organic traffic is available for ${available.length} of ${rows.length} months.` : 'No observed organic traffic history is available.'} {comparisons.length ? `Showing ${comparisons.length} explicitly supplied comparison ${comparisons.length === 1 ? 'company' : 'companies'}.` : ''}</p>
      {comparison.length > 2 ? <p className="company-module__notice">Comparison limit reached: showing the first 2 additional companies.</p> : null}
      {comparisons.length ? <ul className="historical-chart__comparisons" aria-label="Comparison companies">{comparisons.map((item) => <li key={item.companyId}>{item.identity.displayName ?? item.identity.domain}: {recentTrend(item.trend).filter((point) => typeof point.organicTraffic.value === 'number').length} observed months</li>)}</ul> : null}
      <div className="historical-chart__canvas" data-testid="historical-chart" data-gap-count={gaps} data-comparison-count={comparisons.length} aria-label="Organic traffic chart">
        {rows.map((point) => typeof point.organicTraffic.value === 'number' ? <button type="button" className="historical-chart__point" key={point.date} aria-label={`${point.date}, ${valueText(point.organicTraffic)}`} onClick={() => setTooltip({company: 'Selected company', point})}>{valueText(point.organicTraffic)}</button> : <span className="historical-chart__gap" key={point.date} aria-label={`${point.date}, not available`} role="img">Gap</span>)}
        {comparisons.map((company) => { const name = company.identity.displayName ?? company.identity.domain; return <div className="historical-chart__comparison-series" data-testid="historical-comparison-series" data-company-id={company.companyId} key={company.companyId} aria-label={`${name} organic traffic comparison series`}><strong className="historical-chart__comparison-label">{name}</strong>{recentTrend(company.trend).map((point) => typeof point.organicTraffic.value === 'number' ? <button type="button" className="historical-chart__comparison-point" key={point.date} aria-label={`${name}, ${point.date}, ${valueText(point.organicTraffic)}`} onClick={() => setTooltip({company: name, point})}>{valueText(point.organicTraffic)}</button> : <span className="historical-chart__comparison-gap" key={point.date} aria-label={`${name}, ${point.date}, not available`} role="img">Gap</span>)}</div>; })}
      </div>
      {tooltip ? <div className="historical-chart__tooltip" role="tooltip"><p>Company: {tooltip.company}</p><p>Date: {tooltip.point.date}</p><p>Value: {valueText(tooltip.point.organicTraffic)}</p><p>Source: {tooltip.point.organicTraffic.source ?? 'Not available'}</p><p>Database: {tooltip.point.organicTraffic.database ?? 'Not available'}</p></div> : null}
      <table className="company-table" aria-label="Organic traffic historical data"><caption>Organic traffic data table</caption><thead><tr><th scope="col">Date</th><th scope="col" className="company-table__numeric">Estimated organic traffic</th><th scope="col">Provenance</th>{comparisons.map((item) => <th scope="col" className="company-table__numeric" key={item.companyId}>{item.identity.displayName ?? item.identity.domain}</th>)}</tr></thead><tbody>{Array.from(new Set([...rows.map((point) => point.date), ...comparisons.flatMap((item) => recentTrend(item.trend).map((point) => point.date))])).sort().map((date) => { const primary = rows.find((point) => point.date === date); return <tr key={date}><td>{date}</td><td className="company-table__numeric">{primary ? valueText(primary.organicTraffic) : 'Not available'}</td><td>{primary ? provenance(primary.organicTraffic) : 'Not available'}</td>{comparisons.map((item) => { const point = recentTrend(item.trend).find((row) => row.date === date); return <td className="company-table__numeric" key={item.companyId}>{point ? `${valueText(point.organicTraffic)} · ${provenance(point.organicTraffic)}` : 'Not available'}</td>; })}</tr>; })}</tbody></table>
    </>}
  </section>;
}
