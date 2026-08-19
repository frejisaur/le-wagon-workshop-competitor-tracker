import type {CompanySummary, LandscapeResponse} from '@/lib/domain/dashboard';

const priority: Record<LandscapeResponse['signals'][number]['kind'], number> = {ai_outperformance: 0, growth: 1, paid_activity: 2, non_brand_demand: 3};
const workspace: Record<LandscapeResponse['signals'][number]['kind'], string> = {ai_outperformance: 'ai', growth: 'search', paid_activity: 'paid', non_brand_demand: 'search'};
const copy: Record<LandscapeResponse['signals'][number]['kind'], string> = {ai_outperformance: 'Outperforming the AI benchmark', growth: 'Organic traffic growing', paid_activity: 'Meaningful paid activity observed', non_brand_demand: 'Majority non-brand demand'};
const format = new Intl.NumberFormat('en-US', {style: 'percent', maximumFractionDigits: 1});

export function AttentionSignals({companies, signals}: {companies: readonly CompanySummary[]; signals: ReadonlyArray<LandscapeResponse['signals'][number]>}) {
  const byId = new Map(companies.map((company) => [company.companyId, company]));
  const visible = signals.filter((signal) => byId.has(signal.companyId)).sort((left, right) => priority[left.kind] - priority[right.kind] || Math.abs(right.value) - Math.abs(left.value) || left.companyId.localeCompare(right.companyId)).slice(0, 5);
  return <section className="attention-signals" aria-labelledby="attention-signals-heading"><div className="landscape-panel-heading"><h2 id="attention-signals-heading">Attention signals</h2><p>Ranked investigation prompts</p></div>{visible.length ? <ol>{visible.map((signal) => { const company = byId.get(signal.companyId)!; const value = signal.kind === 'paid_activity' ? 'Active' : format.format(signal.value); return <li key={`${signal.companyId}-${signal.kind}`}><a href={`/companies/${encodeURIComponent(company.companyId)}?tab=${workspace[signal.kind]}`}><strong>{company.displayName ?? company.domain}</strong><span>{copy[signal.kind]}</span><data value={signal.value}>{value}</data><small>{signal.period}</small></a></li>; })}</ol> : <p>No attention signals match the current filters.</p>}</section>;
}
