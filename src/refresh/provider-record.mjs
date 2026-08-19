import {createHash} from 'node:crypto';

import {normalizeDomain} from '../domain/normalize.mjs';

const NUMBER_FIELDS = [
  'authority_score', 'backlinks', 'referring_domains', 'follow_backlinks', 'nofollow_backlinks',
  'organic_traffic', 'total_traffic', 'organic_keywords', 'organic_traffic_cost_usd',
  'organic_competitors_count', 'paid_traffic', 'paid_keywords', 'paid_traffic_cost_usd',
  'paid_competitors_count', 'ai_visibility', 'ai_visibility_benchmark', 'ai_mentions',
  'ai_cited_pages', 'top_country_traffic',
];

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateDomainOverviewRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {ok: false};
  const canonicalDomain = normalizeDomain(raw.domain);
  if (!canonicalDomain || typeof raw.database !== 'string') return {ok: false};
  if (NUMBER_FIELDS.some((name) => raw[name] !== undefined && !finiteNumber(raw[name]))) return {ok: false};
  if (raw.top_country !== undefined && typeof raw.top_country !== 'string') return {ok: false};
  return {
    ok: true,
    value: {
      canonicalDomain,
      domain: raw.domain,
      database: raw.database,
      ...Object.fromEntries(NUMBER_FIELDS.filter((name) => finiteNumber(raw[name])).map((name) => [name, raw[name]])),
      ...(typeof raw.top_country === 'string' ? {top_country: raw.top_country} : {}),
    },
  };
}

function stableFingerprint(fields) {
  return createHash('sha256').update(JSON.stringify(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
}

export function toCompanyRefreshRecord({company, observation, observedAt, datasetId}) {
  const observed = observation.value;
  const fields = {
    'Apify Domain': observed.domain,
    Database: observed.database,
    'Authority Score': observed.authority_score,
    Backlinks: observed.backlinks,
    'Referring Domains': observed.referring_domains,
    'Follow Backlinks': observed.follow_backlinks,
    'Nofollow Backlinks': observed.nofollow_backlinks,
    'Organic Traffic': observed.organic_traffic,
    'Total Traffic': observed.total_traffic,
    'Organic Keywords': observed.organic_keywords,
    'Organic Traffic Cost USD': observed.organic_traffic_cost_usd,
    'Organic Competitors Count': observed.organic_competitors_count,
    'Paid Traffic': observed.paid_traffic,
    'Paid Keywords': observed.paid_keywords,
    'Paid Traffic Cost USD': observed.paid_traffic_cost_usd,
    'Paid Competitors Count': observed.paid_competitors_count,
    'AI Visibility': observed.ai_visibility,
    'AI Visibility Benchmark': observed.ai_visibility_benchmark,
    'AI Mentions': observed.ai_mentions,
    'AI Cited Pages': observed.ai_cited_pages,
    'Top Country': observed.top_country,
    'Top Country Traffic': observed.top_country_traffic,
    'Raw Dataset Item URL': datasetId ? `https://console.apify.com/storage/datasets/${encodeURIComponent(datasetId)}` : undefined,
    'Enrichment Status': 'succeeded',
    'Enriched At': observedAt,
    'Last Successful Scraper Refresh': observedAt,
  };
  const cleanFields = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  cleanFields['Evidence Fingerprint'] = stableFingerprint({
    companyId: company.companyId,
    canonicalDomain: company.canonicalDomain,
    observed: cleanFields,
  });
  return {recordId: company.recordId, companyId: company.companyId, fields: cleanFields};
}
