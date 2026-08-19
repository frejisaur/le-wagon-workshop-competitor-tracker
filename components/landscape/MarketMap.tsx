'use client';

import type {CSSProperties} from 'react';
import type {DerivedMapRow} from './selectors';

const format = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const axisFormat = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
const compactFormat = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 0});
const PLOT_EDGE = 7;

function exactUtc(timestamp: string | null): string {
  const date = timestamp ? new Date(timestamp) : undefined;
  return date && !Number.isNaN(date.valueOf()) ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'Not available';
}

function scale(value: number, minimum: number, maximum: number, invert = false): number {
  if (minimum === maximum) return 50;
  const normalized = (value - minimum) / (maximum - minimum);
  const position = PLOT_EDGE + normalized * (100 - PLOT_EDGE * 2);
  return Math.round((invert ? 100 - position : position) * 100) / 100;
}

function ticks(minimum: number, maximum: number, count = 5): number[] {
  if (minimum === maximum) return [minimum];
  return Array.from({length: count}, (_, index) => minimum + ((maximum - minimum) * index) / (count - 1));
}

export function MarketMap({rows, selectedCompany, onSelect}: {rows: readonly DerivedMapRow[]; selectedCompany?: string; onSelect: (companyId: string) => void}) {
  const available = rows.filter((row) => row.authorityScore !== null && row.authorityScore >= 0 && row.organicTraffic !== null && row.organicTraffic > 0 && row.trafficShare !== null && row.trafficShare > 0);
  const unavailableAxis = rows.filter((row) => row.authorityScore === null || row.authorityScore < 0 || row.organicTraffic === null).length;
  const zeroTraffic = rows.filter((row) => row.organicTraffic === 0).length;
  const unavailableShare = rows.filter((row) => row.authorityScore !== null && row.organicTraffic !== null && row.organicTraffic > 0 && (row.trafficShare === null || row.trafficShare <= 0)).length;
  const authorities = available.map((row) => row.authorityScore!);
  const logTraffic = available.map((row) => Math.log10(row.organicTraffic!));
  const authorityMinimum = Math.min(...authorities);
  const authorityMaximum = Math.max(...authorities);
  const trafficMinimum = Math.min(...logTraffic);
  const trafficMaximum = Math.max(...logTraffic);
  const maximumShare = Math.max(...available.map((row) => row.trafficShare!));
  const authorityTicks = available.length ? ticks(authorityMinimum, authorityMaximum) : [];
  const trafficTicks = available.length ? ticks(trafficMinimum, trafficMaximum) : [];
  const selectByIndex = (index: number, direction: number) => {
    const next = available[index + direction];
    if (next) document.getElementById(`market-map-point-${next.company.companyId}`)?.focus();
  };

  return <section className="market-map-panel" aria-labelledby="market-map-heading">
    <div className="landscape-panel-heading"><h2 id="market-map-heading">Authority and organic reach</h2><p>Authority score × estimated organic traffic</p></div>
    <div className="market-map__legend" aria-label="Market map legend">
      <span><i className="market-map__legend-dot market-map__legend-dot--sized" aria-hidden="true" />Point size: tracked-set traffic share</span>
      <span><i className="market-map__legend-dot market-map__legend-dot--ai" aria-hidden="true" />Blue fill: AI benchmark outperformance</span>
      <span><i className="market-map__legend-dot market-map__legend-dot--selected" aria-hidden="true" />Outer ring: selected company</span>
    </div>
    <div className="market-map" data-testid="market-map" data-count={available.length} aria-label="Market map: authority score on the horizontal axis and organic traffic on the logarithmic vertical axis">
      <p className="market-map__axis market-map__axis--y">Organic traffic (logarithmic scale)</p><p className="market-map__axis market-map__axis--x">Authority score</p>
      <div className="market-map__plot">
        {authorityTicks.map((tick) => <span key={`authority-${tick}`} className="market-map__grid-line market-map__grid-line--x" style={{'--map-x': `${scale(tick, authorityMinimum, authorityMaximum)}%`} as CSSProperties} aria-hidden="true"><span>{axisFormat.format(tick)}</span></span>)}
        {trafficTicks.map((tick) => <span key={`traffic-${tick}`} className="market-map__grid-line market-map__grid-line--y" style={{'--map-y': `${scale(tick, trafficMinimum, trafficMaximum, true)}%`} as CSSProperties} aria-hidden="true"><span>{compactFormat.format(10 ** tick)}</span></span>)}
        {available.map((row, index) => {
          const {company} = row;
          const tooltipId = `market-map-tooltip-${company.companyId}`;
          const source = company.organicTraffic.source ?? company.authorityScore.source ?? 'Not available';
          const x = scale(row.authorityScore!, authorityMinimum, authorityMaximum);
          const y = scale(Math.log10(row.organicTraffic!), trafficMinimum, trafficMaximum, true);
          const dotSize = 12 + 20 * Math.sqrt(row.trafficShare! / maximumShare);
          return <span key={company.companyId}><button id={`market-map-point-${company.companyId}`} type="button" className="market-map__point" data-selected={selectedCompany === company.companyId} data-ai-outperforming={row.aiBenchmarkGap !== null && row.aiBenchmarkGap > 0} style={{'--map-x': `${x}%`, '--map-y': `${y}%`, '--map-dot-size': `${dotSize.toFixed(2)}px`} as CSSProperties} aria-pressed={selectedCompany === company.companyId} aria-describedby={tooltipId} aria-label={`${company.displayName ?? company.domain}, ${company.domain}, authority ${format.format(row.authorityScore!)}, traffic ${format.format(row.organicTraffic!)}, tracked share ${format.format(row.trafficShare! * 100)}%, ${row.aiBenchmarkGap !== null ? `AI benchmark gap ${format.format(row.aiBenchmarkGap * 100)}%` : 'AI benchmark gap not available'}`} onClick={() => onSelect(company.companyId)} onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); selectByIndex(index, 1); }
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); selectByIndex(index, -1); }
          }}>
            <span className="market-map__dot" aria-hidden="true" />
          </button><span id={tooltipId} role="tooltip" className="market-map__tooltip" data-tooltip-horizontal={x > 62 ? 'left' : 'right'} data-tooltip-vertical={y < 38 ? 'below' : 'above'} style={{'--map-x': `${x}%`, '--map-y': `${y}%`} as CSSProperties}><strong>{company.displayName ?? company.domain}</strong><span>{company.domain}</span><dl><div><dt>Authority score</dt><dd>{format.format(row.authorityScore!)}</dd></div><div><dt>Estimated organic traffic</dt><dd>{format.format(row.organicTraffic!)}</dd></div><div><dt>Tracked-set traffic share</dt><dd>{format.format(row.trafficShare! * 100)}%</dd></div><div><dt>AI benchmark gap</dt><dd>{row.aiBenchmarkGap === null ? 'Not available' : `${format.format(row.aiBenchmarkGap * 100)}%`}</dd></div></dl><small>Source: {source} · Last successful refresh: {exactUtc(company.freshness.lastSuccessfulRunAt)}</small></span></span>;
        })}
      </div>
    </div>
    <p className="market-map__note">{unavailableAxis || zeroTraffic || unavailableShare ? `${unavailableAxis} ${unavailableAxis === 1 ? 'company has' : 'companies have'} unavailable axis values; ${zeroTraffic} ${zeroTraffic === 1 ? 'has' : 'have'} zero organic traffic; ${unavailableShare} ${unavailableShare === 1 ? 'has' : 'have'} unavailable tracked-share values. These records are excluded from the logarithmic map.` : 'All filtered companies have complete market-map values.'}</p>
    <details className="market-map__data-disclosure"><summary>View chart data ({available.length} {available.length === 1 ? 'company' : 'companies'})</summary><div className="market-map__data-scroll"><table className="market-map__data" aria-label="Market map accessible data"><thead><tr><th scope="col">Company</th><th scope="col">Authority</th><th scope="col">Organic traffic</th><th scope="col">Tracked share</th><th scope="col">AI benchmark gap</th><th scope="col">Source</th><th scope="col">Last successful refresh</th></tr></thead><tbody>{available.map((row) => <tr key={row.company.companyId}><th scope="row">{row.company.displayName ?? row.company.domain}</th><td>{format.format(row.authorityScore!)}</td><td>{format.format(row.organicTraffic!)}</td><td>{format.format(row.trafficShare! * 100)}%</td><td>{row.aiBenchmarkGap === null ? 'Not available' : `${format.format(row.aiBenchmarkGap * 100)}%`}</td><td>{row.company.organicTraffic.source ?? row.company.authorityScore.source ?? 'Not available'}</td><td>{exactUtc(row.company.freshness.lastSuccessfulRunAt)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
