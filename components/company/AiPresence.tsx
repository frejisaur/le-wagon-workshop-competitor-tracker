import {Button} from '@carbon/react';
import type {CompanyResponse, DashboardValue} from '@/lib/domain/dashboard';
import {countryName, exactUtc, valueText} from './company-utils';
import styles from './ai-presence.module.scss';

type AiProps = Pick<CompanyResponse, 'ai' | 'countries'>;

function Metric({label, value, format = 'number'}: {label: string; value: DashboardValue; format?: 'number' | 'points'}) {
  return <div><dt>{label}</dt><dd>{valueText(value, format)}</dd><span data-classification={value.classification}>{value.classification}</span></div>;
}

function AiMetricLedger({ai}: Pick<CompanyResponse, 'ai'>) {
  return <dl className="ai-presence__metrics" aria-label="AI presence metrics">
    <Metric label="Visibility" value={ai.visibility} format="points" />
    <Metric label="Benchmark" value={ai.benchmark} format="points" />
    <Metric label="Mentions" value={ai.mentions} />
    <Metric label="Cited pages" value={ai.citedPages} />
  </dl>;
}

function ProvenanceDisclosure({value}: {value: DashboardValue}) {
  return <details className="ai-presence__provenance"><summary>View provenance</summary><dl>
    <div><dt>Source</dt><dd>{value.source ?? 'Not available'}</dd></div>
    <div><dt>Database</dt><dd>{value.database ?? 'Not available'}</dd></div>
    <div><dt>Observed</dt><dd>{exactUtc(value.observedAt)}</dd></div>
  </dl></details>;
}

export function AiSummary({ai, onOpen}: Pick<CompanyResponse, 'ai'> & {onOpen: () => void}) {
  const leadSource = ai.topCitedSources[0];
  return <section className={`${styles.aiPresence} ai-presence ai-presence--summary`} aria-labelledby="ai-summary-heading">
    <div className="company-module__heading"><div><h2 id="ai-summary-heading">AI presence</h2><p>Observed visibility, provider mentions, and citation coverage.</p></div><Button kind="ghost" size="sm" type="button" onClick={onOpen}>Explore AI evidence</Button></div>
    <AiMetricLedger ai={ai} />
    {leadSource ? <p className="ai-presence__lead-source">Top cited source <strong>{leadSource.domain}</strong> · {valueText(leadSource.mentions)} mentions</p> : null}
  </section>;
}

export function AiPresence({ai, countries}: AiProps) {
  const geographic = countries.filter((country) => (country.mentions ?? 0) !== 0 || (country.visibility ?? 0) !== 0);
  return <section className={`${styles.aiPresence} ai-presence`} aria-labelledby="ai-presence-heading">
    <div className="company-module__heading"><div><h2 id="ai-presence-heading">AI presence</h2><p>Observed visibility, mentions, cited pages, and provider-reported coverage.</p></div></div>
    <AiMetricLedger ai={ai} />
    <ProvenanceDisclosure value={ai.visibility} />

    <div className="company-module__heading"><div><h3>Top cited sources</h3><p>Provider-ranked domains cited in AI results.</p></div></div>
    {ai.topCitedSources.length === 0 ? <p className="company-module__unavailable">No cited-source domains were returned for this company.</p> : <ol className="ai-presence__rows ai-presence__sources" aria-label="AI top cited sources">{ai.topCitedSources.map((source) => <li key={source.domain}><strong>{source.domain}</strong><span>{valueText(source.mentions)} mentions</span></li>)}</ol>}

    <div className="company-module__heading"><div><h3>Model coverage</h3><p>Observed sample by reporting model.</p></div></div>
    {ai.byLlm.length === 0 ? <p className="company-module__unavailable">No model-level AI observations were returned.</p> : <ul className="ai-presence__rows" aria-label="AI presence by model">{ai.byLlm.map((row) => <li key={row.llm}><strong>{row.llm}</strong><dl><div><dt>Mentions</dt><dd>{valueText(row.mentions)}</dd></div><div><dt>Self mentions</dt><dd>{valueText(row.selfMentions)}</dd></div><div><dt>Cited pages</dt><dd>{valueText(row.citedPages)}</dd></div></dl></li>)}</ul>}

    <div className="company-module__heading"><div><h3>Meaningful geography</h3><p>Zero-value country rows are hidden.</p></div></div>
    {geographic.length === 0 ? <p className="company-module__unavailable">No meaningful country-level AI observations were returned.</p> : <ul className="ai-presence__rows" aria-label="AI presence by country">{geographic.map((country) => <li key={country.country}><strong>{countryName(country.country)}</strong><dl><div><dt>Mentions</dt><dd>{valueText(country.mentions)}</dd></div><div><dt>Visibility</dt><dd>{valueText(country.visibility, 'points')}</dd></div></dl></li>)}</ul>}
  </section>;
}
