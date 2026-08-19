'use client';

import {useMemo, useState, type KeyboardEvent} from 'react';
import {Dropdown} from '@carbon/react';
import type {CompanyComparison, CompanyResponse, DashboardValue} from '@/lib/domain/dashboard';
import {provenance} from './company-utils';

export type ComparisonDataset = readonly CompanyComparison[];

type TrendPoint = CompanyResponse['trend'][number];
type MetricKey = Exclude<keyof TrendPoint, 'date'>;
type Metric = {id: MetricKey; text: string; column: string; format: 'number' | 'currency'};
type TooltipPoint = {company: string; date: string; value: DashboardValue};
type PlottedPoint = {date: string; value: number; source: DashboardValue};

const METRICS: Metric[] = [
  {id: 'organicTraffic', text: 'Organic traffic', column: 'Estimated organic traffic', format: 'number'},
  {id: 'organicKeywords', text: 'Organic keywords', column: 'Estimated organic keywords', format: 'number'},
  {id: 'organicTrafficCostUsd', text: 'Organic traffic value', column: 'Estimated organic traffic value', format: 'currency'},
  {id: 'brandedTraffic', text: 'Branded traffic', column: 'Estimated branded traffic', format: 'number'},
  {id: 'nonBrandTraffic', text: 'Non-brand traffic', column: 'Estimated non-brand traffic', format: 'number'},
  {id: 'paidTraffic', text: 'Paid traffic', column: 'Estimated paid traffic', format: 'number'},
  {id: 'paidKeywords', text: 'Paid keywords', column: 'Estimated paid keywords', format: 'number'},
  {id: 'paidTrafficCostUsd', text: 'Paid traffic value', column: 'Estimated paid traffic value', format: 'currency'},
  {id: 'serpFeatureTraffic', text: 'SERP-feature traffic', column: 'Estimated SERP-feature traffic', format: 'number'},
] as const;
const PERIODS = [6, 12, 24] as const;
const WIDTH = 960;
const HEIGHT = 300;
const PADDING = {top: 24, right: 24, bottom: 42, left: 66};
const integer = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
const compact = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1});
const currency = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const month = new Intl.DateTimeFormat('en-US', {month: 'short', year: '2-digit', timeZone: 'UTC'});

function recentTrend(trend: readonly TrendPoint[], period = 24): TrendPoint[] {
  return [...trend].sort((left, right) => left.date.localeCompare(right.date)).slice(-period);
}

function rawValue(point: TrendPoint | undefined, metric: MetricKey): number | null {
  const value = point?.[metric].value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatted(value: number | null, format: Metric['format']): string {
  if (value === null) return 'Not available';
  return format === 'currency' ? currency.format(value) : integer.format(value);
}

function shortValue(value: number, format: Metric['format']): string {
  return format === 'currency' ? `$${compact.format(value)}` : compact.format(value);
}

function pathSegments(points: readonly TrendPoint[], metric: MetricKey, x: (index: number) => number, y: (value: number) => number): string[] {
  const segments: string[] = [];
  let current = '';
  points.forEach((point, index) => {
    const value = rawValue(point, metric);
    if (value === null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? ' L' : 'M'} ${x(index)} ${y(value)}`;
  });
  if (current) segments.push(current);
  return segments;
}

function keyActivates(event: KeyboardEvent<SVGCircleElement>, activate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate();
  }
}

export function HistoricalChart({trend, comparison = []}: {trend: CompanyResponse['trend']; comparison?: ComparisonDataset}) {
  const [metricId, setMetricId] = useState<MetricKey>('organicTraffic');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(24);
  const [tooltip, setTooltip] = useState<TooltipPoint>();
  const metric = METRICS.find((item) => item.id === metricId) ?? METRICS[0];
  const rows = useMemo(() => recentTrend(trend, period), [trend, period]);
  const comparisons = useMemo(() => comparison.filter((item) => item.companyId !== '').slice(0, 2), [comparison]);
  const comparisonRows = useMemo(() => comparisons.map((item) => ({company: item, rows: recentTrend(item.trend, period)})), [comparisons, period]);
  const available = rows.map((point) => rawValue(point, metric.id)).filter((value): value is number => value !== null);
  const gaps = rows.length - available.length;
  const latest = available.at(-1) ?? null;
  const earliest = available.at(0) ?? null;
  const change = latest !== null && earliest !== null && earliest !== 0 ? (latest - earliest) / Math.abs(earliest) : null;
  const allValues = [
    ...available,
    ...comparisonRows.flatMap(({rows: points}) => points.map((point) => rawValue(point, metric.id)).filter((value): value is number => value !== null)),
  ];
  const maxValue = Math.max(...allValues, 1);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (index: number) => PADDING.left + (rows.length <= 1 ? plotWidth / 2 : index * plotWidth / (rows.length - 1));
  const y = (value: number) => PADDING.top + plotHeight - value / maxValue * plotHeight;
  const axisTicks = [0, .25, .5, .75, 1];
  const dateIndexes = Array.from(new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])).filter((index) => index >= 0);

  const showTooltip = (company: string, point: TrendPoint) => setTooltip({company, date: point.date, value: point[metric.id]});

  return <section className="historical-chart" aria-labelledby="historical-chart-heading">
    <header className="historical-chart__header">
      <div>
        <p className="historical-chart__eyebrow">Calculated projection · Semrush monthly observations</p>
        <h2 id="historical-chart-heading">Historical performance</h2>
        <p>Explore the available scraper history without smoothing over missing months.</p>
      </div>
      <div className="historical-chart__controls">
        <Dropdown id="historical-metric" label="Metric" titleText="Metric" items={METRICS} selectedItem={metric} itemToString={(item) => item?.text ?? ''} onChange={({selectedItem}) => { setMetricId(selectedItem?.id ?? 'organicTraffic'); setTooltip(undefined); }} size="sm" />
        <fieldset className="historical-chart__periods">
          <legend>Period</legend>
          {PERIODS.map((value) => <button type="button" key={value} className={period === value ? 'historical-chart__period historical-chart__period--active' : 'historical-chart__period'} aria-pressed={period === value} onClick={() => { setPeriod(value); setTooltip(undefined); }}>{value}M</button>)}
        </fieldset>
      </div>
    </header>

    <div className="historical-chart__stats" aria-label={`${metric.text} summary`}>
      <div><span>Latest</span><strong className="historical-chart__stat-value">{formatted(latest, metric.format)}</strong></div>
      <div><span>Period change</span><strong className={change === null ? '' : change >= 0 ? 'historical-chart__positive' : 'historical-chart__negative'}>{change === null ? 'Not available' : `${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%`}</strong></div>
      <div><span>Low</span><strong>{available.length ? formatted(Math.min(...available), metric.format) : 'Not available'}</strong></div>
      <div><span>High</span><strong>{available.length ? formatted(Math.max(...available), metric.format) : 'Not available'}</strong></div>
      <div><span>Coverage</span><strong>{available.length}/{rows.length} months</strong></div>
    </div>

    {comparison.length > 2 ? <p className="company-module__notice">Comparison limit reached: showing the first 2 additional companies.</p> : null}
    <div className="historical-chart__legend" aria-label="Chart series">
      <span><i className="historical-chart__swatch historical-chart__swatch--primary" />Selected company</span>
      {comparisonRows.map(({company}, index) => <span key={company.companyId}><i className={`historical-chart__swatch historical-chart__swatch--comparison-${index + 1}`} />{company.identity.displayName ?? company.identity.domain}</span>)}
    </div>

    <div className="historical-chart__canvas" data-testid="historical-chart" data-gap-count={gaps} data-comparison-count={comparisons.length}>
      {rows.length ? <svg className="historical-chart__plot" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${metric.text} over time`}>
        <title>{`${metric.text} over time`}</title>
        {axisTicks.map((tick) => { const tickY = PADDING.top + plotHeight - tick * plotHeight; return <g key={tick}><line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={tickY} y2={tickY} className="historical-chart__gridline" /><text x={PADDING.left - 10} y={tickY + 4} textAnchor="end" className="historical-chart__axis-label">{shortValue(maxValue * tick, metric.format)}</text></g>; })}
        {dateIndexes.map((index) => <text key={rows[index].date} x={x(index)} y={HEIGHT - 12} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'} className="historical-chart__axis-label">{month.format(new Date(`${rows[index].date}T00:00:00Z`))}</text>)}
        {pathSegments(rows, metric.id, x, y).map((path, index) => <path key={index} d={path} className="historical-chart__line historical-chart__line--primary" />)}
        {rows.map((point, index) => { const value = rawValue(point, metric.id); return value === null ? null : <circle key={point.date} cx={x(index)} cy={y(value)} r="5" className="historical-chart__dot historical-chart__dot--primary" role="button" tabIndex={0} aria-label={`${point.date}, ${formatted(value, metric.format)}`} onClick={() => showTooltip('Selected company', point)} onKeyDown={(event) => keyActivates(event, () => showTooltip('Selected company', point))} />; })}
        {comparisonRows.map(({company, rows: points}, seriesIndex) => {
          const name = company.identity.displayName ?? company.identity.domain;
          const byDate = new Map(points.map((point) => [point.date, point]));
          const aligned = rows.map((point) => byDate.get(point.date) ?? ({...point, [metric.id]: {...point[metric.id], value: null}} as TrendPoint));
          return <g key={company.companyId} data-testid="historical-comparison-series" data-company-id={company.companyId} role="group" aria-label={`${name} ${metric.text} comparison series`}>
            {pathSegments(aligned, metric.id, x, y).map((path, index) => <path key={index} d={path} className={`historical-chart__line historical-chart__line--comparison-${seriesIndex + 1}`} />)}
            {aligned.map((point, index) => { const value = rawValue(point, metric.id); return value === null ? null : <circle key={point.date} cx={x(index)} cy={y(value)} r="4" className={`historical-chart__dot historical-chart__dot--comparison-${seriesIndex + 1}`} role="button" tabIndex={0} aria-label={`${name}, ${point.date}, ${formatted(value, metric.format)}`} onClick={() => showTooltip(name, point)} onKeyDown={(event) => keyActivates(event, () => showTooltip(name, point))} />; })}
          </g>;
        })}
      </svg> : <p className="company-module__unavailable">No historical observations are available.</p>}
      {gaps ? <p className="historical-chart__gap-note">{gaps} missing {gaps === 1 ? 'month is' : 'months are'} shown as {gaps === 1 ? 'a gap' : 'gaps'}.</p> : null}
    </div>

    {tooltip ? <div className="historical-chart__tooltip" role="tooltip"><strong>{tooltip.company}</strong><p>Date: {tooltip.date}</p><p>Value: {formatted(typeof tooltip.value.value === 'number' ? tooltip.value.value : null, metric.format)}</p><p>Source: {tooltip.value.source ?? 'Not available'}</p><p>Database: {tooltip.value.database ?? 'Not available'}</p><p>Classification: {tooltip.value.classification}</p></div> : null}

    <details className="historical-chart__data">
      <summary>View chart data ({rows.length} {rows.length === 1 ? 'month' : 'months'})</summary>
      <div className="company-table__scroll">
        <table className="company-table" aria-label={`${metric.text} historical data`}><caption>{metric.text} calculated monthly series</caption><thead><tr><th scope="col">Date</th><th scope="col" className="company-table__numeric">{metric.column}</th><th scope="col">Provenance</th>{comparisonRows.map(({company}) => <th scope="col" className="company-table__numeric" key={company.companyId}>{company.identity.displayName ?? company.identity.domain}</th>)}</tr></thead><tbody>{rows.map((point) => <tr key={point.date}><td>{point.date}</td><td className="company-table__numeric">{formatted(rawValue(point, metric.id), metric.format)}</td><td>{provenance(point[metric.id])}</td>{comparisonRows.map(({company, rows: points}) => { const comparisonPoint = points.find((row) => row.date === point.date); return <td className="company-table__numeric" key={company.companyId}>{comparisonPoint ? `${formatted(rawValue(comparisonPoint, metric.id), metric.format)} · ${provenance(comparisonPoint[metric.id])}` : 'Not available'}</td>; })}</tr>)}</tbody></table>
      </div>
    </details>
  </section>;
}
