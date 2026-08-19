'use client';

import type {CompanySummary, LandscapeResponse} from '@/lib/domain/dashboard';

type MapRow = {company: CompanySummary; point: LandscapeResponse['marketMap'][number]};
const format = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});

export function MarketMap({rows, selectedCompany, onSelect}: {rows: readonly MapRow[]; selectedCompany?: string; onSelect: (companyId: string) => void}) {
  const available = rows.filter(({point}) => point.authorityScore !== null && point.authorityScore >= 0 && point.organicTraffic !== null && point.organicTraffic > 0 && point.trafficShare !== null && point.trafficShare > 0);
  const unavailable = rows.length - available.length;
  const selectByIndex = (index: number, direction: number) => { const next = available[index + direction]; if (next) document.getElementById(`market-map-point-${next.company.companyId}`)?.focus(); };
  return <section className="market-map-panel" aria-labelledby="market-map-heading"><div className="landscape-panel-heading"><h2 id="market-map-heading">Authority and organic reach</h2><p>Authority score × organic traffic</p></div>
    <div className="market-map" data-testid="market-map" data-count={available.length} aria-label="Market map: authority score on the horizontal axis and organic traffic on the logarithmic vertical axis">
      <p className="market-map__axis market-map__axis--y">Organic traffic (logarithmic scale)</p><p className="market-map__axis market-map__axis--x">Authority score</p>
      <div className="market-map__plot">{available.map(({company, point}, index) => <button id={`market-map-point-${company.companyId}`} key={company.companyId} type="button" className="market-map__point" data-selected={selectedCompany === company.companyId} data-ai-outperforming={point.aiBenchmarkGap !== null && point.aiBenchmarkGap > 0} style={{'--map-x': `${Math.min(100, point.authorityScore ?? 0)}%`, '--map-y': `${Math.max(4, 100 - ((Math.log10(point.organicTraffic ?? 1) / 8) * 100))}%`, '--map-size': `${Math.max(12, Math.min(44, (point.trafficShare ?? 0) * 60))}px`} as React.CSSProperties} aria-pressed={selectedCompany === company.companyId} aria-label={`${company.displayName ?? company.domain}, ${company.domain}, authority ${format.format(point.authorityScore!)}, traffic ${format.format(point.organicTraffic!)}, tracked share ${format.format(point.trafficShare! * 100)}%, ${point.aiBenchmarkGap !== null ? `AI benchmark gap ${format.format(point.aiBenchmarkGap * 100)}%` : 'AI benchmark gap not available'}`} onClick={() => onSelect(company.companyId)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); selectByIndex(index, 1); } if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); selectByIndex(index, -1); } }}>{company.displayName?.slice(0, 1) ?? company.domain.slice(0, 1)}</button>)}</div>
    </div>
    <p className="market-map__note">{unavailable ? `${unavailable} company ${unavailable === 1 ? 'has' : 'have'} unavailable values and ${unavailable === 1 ? 'is' : 'are'} excluded from the logarithmic map.` : 'All filtered companies have complete market-map values.'}</p>
    <table className="market-map__data" aria-label="Market map accessible data"><thead><tr><th scope="col">Company</th><th scope="col">Authority</th><th scope="col">Organic traffic</th><th scope="col">Tracked share</th><th scope="col">AI benchmark gap</th></tr></thead><tbody>{available.map(({company, point}) => <tr key={company.companyId}><th scope="row">{company.displayName ?? company.domain}</th><td>{format.format(point.authorityScore!)}</td><td>{format.format(point.organicTraffic!)}</td><td>{format.format(point.trafficShare! * 100)}%</td><td>{point.aiBenchmarkGap === null ? 'Not available' : `${format.format(point.aiBenchmarkGap * 100)}%`}</td></tr>)}</tbody></table>
  </section>;
}
