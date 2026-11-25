import type {CompanyRow, StoredPaidAd} from '@/lib/airtable/company-row';
import type {AirtableFieldValue, AirtableFields} from '@/lib/airtable/types';
import type {CuratedKeyword, DataQualityIssue} from '@/lib/domain/metrics';
import {EvidencePackageSchema, type EvidencePackage, type EvidenceReference, type EvidenceValue, type PublishedInsightMetadata, type ReviewMetadata} from '@/lib/agents/types';

// This is deliberately an allow-list, not a prefix match: future Airtable
// columns (especially an accidental raw-payload column) cannot reach agents.
const COMPANY_OBSERVED_FIELDS = new Set([
  'Apify Domain',
  'Domain', 'Authority Score', 'Backlinks', 'Referring Domains', 'Follow Backlinks', 'No-follow Backlinks', 'Organic Traffic', 'Total Traffic', 'Organic Keywords', 'Organic Traffic Cost USD', 'Paid Traffic', 'Paid Keywords', 'Paid Traffic Cost USD', 'AI Visibility', 'AI Visibility Benchmark', 'AI Mentions', 'AI Cited Pages', 'Top Country', 'Top Country Traffic', 'Moz Domain Authority Raw', 'Moz Spam Score Raw',
  'Organic Competitors JSON', 'Organic Competitors Observed Count', 'Paid Competitors JSON', 'Paid Competitors Observed Count', 'AI Countries JSON', 'AI Countries Observed Count', 'AI by LLM JSON', 'AI by LLM Observed Count', 'AI Top Cited Sources JSON', 'AI Top Cited Sources Observed Count', 'SERP Codes JSON', 'SERP Codes Observed Count', 'Moz Top Pages JSON', 'Moz Top Pages Observed Count',
]);
const COMPANY_CALCULATED_FIELDS = new Set([
  'Inputs JSON', 'Organic Traffic 30d Movement', 'Organic Traffic 12m Movement', 'Non-brand Share', 'AI Benchmark Gap', 'Tracked Set Traffic Share', 'Organic Competitors JSON', 'Paid Competitors JSON', 'AI Countries JSON', 'AI Countries Observed Count', 'Moz Domain Authority', 'Moz Spam Score', 'Moz Top Pages JSON', 'Moz Top Pages Observed Count', 'Top Keyword Sample Count', 'Compact Organic Trend JSON', 'Landing Page Portfolio JSON', 'Paid Activity Present',
]);
// Allow-listed observed keys of stored keyword and paid-ad objects, mapped to their evidence keys.
const KEYWORD_FIELDS = {keyword: 'keyword', landingUrl: 'landing_url', position: 'position', previousPosition: 'previous_position', positionDifference: 'position_difference', volume: 'volume', cpcUsd: 'cpc_usd', keywordDifficulty: 'keyword_difficulty', competition: 'competition', traffic: 'traffic', trafficSharePct: 'traffic_share_pct', trafficCostUsd: 'traffic_cost_usd', intents: 'intents', rawSerpCodes: 'serp_codes', results: 'results'} as const satisfies Partial<Record<keyof CuratedKeyword['observed'], string>>;
const PAID_AD_FIELDS = {keyword: 'keyword', title: 'title', description: 'description', visibleUrl: 'visible_url', landingUrl: 'landing_url', position: 'position', previousPosition: 'previous_position', volume: 'volume', cpcUsd: 'cpc_usd', keywordDifficulty: 'keyword_difficulty', competition: 'competition', traffic: 'traffic', trafficSharePct: 'traffic_share_pct', trafficCostUsd: 'traffic_cost_usd', firstObservedAt: 'first_observed_at', lastObservedAt: 'last_observed_at'} as const satisfies Partial<Record<keyof StoredPaidAd['observed'], string>>;
const MAX_QUALITY_EVIDENCE = 25;
const QUALITY_PATHS = {
  suspicious_moz_top_page: /^moz\.top_pages\[\d+\]\.url$/,
  invalid_keyword_landing_url: /^organic\.top_keywords\[\d+\]\.url$/,
  duplicate_keyword_identity: /^organic\.top_keywords\[\d+\]$/,
  invalid_paid_ad_landing_url: /^paid\.top_ads\[\d+\]\.url$/,
  invalid_trend_date: /^organic\.trend_global_(?:daily|monthly)\[\d+\]\.date$/,
  malformed_organic_module: /^organic$/,
  malformed_paid_module: /^paid$/,
  tracked_set_coverage_incomplete: /^refresh\.coverage$/,
  unreadable_stored_json: /^storage\.(?:keywords|paid_ads)$/,
} as const;
type QualityCode = keyof typeof QUALITY_PATHS;

function stringField(fields: AirtableFields, name: string): string | undefined {
  const value = fields[name];
  return typeof value === 'string' && value ? value : undefined;
}

function curatedValue(value: AirtableFieldValue | undefined): EvidenceValue | undefined {
  if (typeof value !== 'string' || !value.trim().startsWith('[') && !value.trim().startsWith('{')) return jsonValue(value);
  try {
    const parsed: unknown = JSON.parse(value);
    return jsonValue(parsed);
  } catch {
    return undefined;
  }
}

function jsonValue(value: unknown): EvidenceValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const items = value.map(jsonValue);
    return items.every((item): item is EvidenceValue => item !== undefined) ? items : undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const output: {[key: string]: EvidenceValue} = {};
  for (const key of Object.keys(value).sort()) {
    const item = jsonValue((value as Record<string, unknown>)[key]);
    if (item === undefined) return undefined;
    output[key] = item;
  }
  return output;
}

function fieldSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function observedProvenance(fields: AirtableFields) {
  const database = stringField(fields, 'Observed • Database');
  const observedAt = stringField(fields, 'Observed • At');
  const rawDatasetRef = stringField(fields, 'Observed • Raw Ref');
  return {
    source: stringField(fields, 'Observed • Source') ?? 'airtable_curated',
    ...(database ? {database} : {}),
    ...(observedAt ? {observedAt} : {}),
    ...(rawDatasetRef ? {rawDatasetRef} : {}),
  };
}

function calculatedProvenance(fields: AirtableFields) {
  const calculatedAt = stringField(fields, 'Calculated • At');
  return {source: 'deterministic_calculation', ...(calculatedAt ? {calculatedAt} : {})};
}

/** Evidence for one stored keyword or paid ad: allow-listed observed values only, with nulls left out. */
function itemEvidence(ref: string, observed: CuratedKeyword['observed'] | StoredPaidAd['observed'], allowed: Record<string, string>): EvidenceReference | undefined {
  const value: {[key: string]: EvidenceValue} = {};
  for (const [field, key] of Object.entries(allowed)) {
    const curated = jsonValue((observed as Record<string, unknown>)[field]);
    if (curated !== undefined && curated !== null) value[key] = curated;
  }
  if (Object.keys(value).length === 0) return undefined;
  const {source, database, observedAt, rawRef} = observed;
  return {ref, classification: 'observed', source, ...(database ? {database} : {}), ...(observedAt ? {observedAt} : {}), ...(rawRef ? {rawDatasetRef: rawRef} : {}), value};
}

function publishedMetadata(row: CompanyRow): PublishedInsightMetadata | undefined {
  if (!row.battlecard) return undefined;
  const {evidenceFingerprint, skillVersion, workflowVersion} = row.battlecard;
  return {evidenceFingerprint, skillVersion, workflowVersion};
}

function reviewMetadata(row: CompanyRow): ReviewMetadata | undefined {
  const review = row.review;
  if (!review) return undefined;
  const candidate = review.candidate;
  return {
    ...(review.status ? {status: review.status} : {}),
    ...(candidate ? {evidenceFingerprint: candidate.evidenceFingerprint, skillVersion: candidate.skillVersion, workflowVersion: candidate.workflowVersion} : {}),
    reviewReasons: [...(candidate?.reviewReasons ?? [])].sort(),
    ...(review.reviewerNotes ? {untrustedReviewerNotes: review.reviewerNotes} : {}),
  };
}

function storedIssues(fields: AirtableFields): unknown[] {
  const raw = fields['Quality • Issues JSON'];
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function qualityEvidence(companyId: string, fields: AirtableFields, storageIssues: DataQualityIssue[]): EvidenceReference[] {
  const seen = new Set<string>();
  const observedAt = stringField(fields, 'Observed • At');
  return [...storedIssues(fields), ...storageIssues]
    .flatMap((issue) => {
      if (!issue || typeof issue !== 'object') return [];
      const code = (issue as Record<string, unknown>).code;
      const sourcePath = (issue as Record<string, unknown>).sourcePath;
      if (typeof code !== 'string' || typeof sourcePath !== 'string' || !Object.hasOwn(QUALITY_PATHS, code)) return [];
      const qualityCode = code as QualityCode;
      if (!QUALITY_PATHS[qualityCode].test(sourcePath)) return [];
      const identity = `${qualityCode}\u0000${sourcePath}`;
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [{code: qualityCode, sourcePath}];
    })
    .sort((left, right) => left.code.localeCompare(right.code) || left.sourcePath.localeCompare(right.sourcePath))
    .slice(0, MAX_QUALITY_EVIDENCE)
    .map((issue, index) => ({ref: `quality:company:${companyId}:${issue.code}:${index}`, classification: 'observed' as const, source: 'data_quality', ...(observedAt ? {observedAt} : {}), value: issue}));
}

/** Builds an allow-listed evidence package from one curated company row. */
export function buildEvidencePackage(row: CompanyRow): EvidencePackage {
  const fields = row.fields;
  const companyId = stringField(fields, 'Identity • Company ID');
  if (!companyId) throw new TypeError('company record requires a stable company ID');
  const evidence: EvidenceReference[] = [];
  const canonicalDomain = stringField(fields, 'Identity • Canonical Domain');
  if (canonicalDomain) evidence.push({ref: `company:${companyId}:identity:canonical_domain`, classification: 'observed', source: 'airtable_curated', value: canonicalDomain});

  for (const [field, value] of Object.entries(fields).sort(([left], [right]) => left.localeCompare(right))) {
    if (field.startsWith('Observed • ')) {
      const label = field.slice('Observed • '.length);
      if (!COMPANY_OBSERVED_FIELDS.has(label)) continue;
      const curated = curatedValue(value);
      if (curated !== undefined) evidence.push({ref: `company:${companyId}:metric:${fieldSlug(label)}`, classification: 'observed', ...observedProvenance(fields), value: curated});
    }
    if (field.startsWith('Calculated • ')) {
      const label = field.slice('Calculated • '.length);
      if (!COMPANY_CALCULATED_FIELDS.has(label)) continue;
      const curated = curatedValue(value);
      if (curated !== undefined) evidence.push({ref: `company:${companyId}:calculation:${fieldSlug(label)}`, classification: 'calculated', ...calculatedProvenance(fields), value: curated});
    }
  }

  for (const keyword of row.keywords) {
    const item = itemEvidence(`keyword:${keyword.calculated.keywordId}`, keyword.observed, KEYWORD_FIELDS);
    if (item) evidence.push(item);
  }
  for (const ad of row.paidAds) {
    const item = itemEvidence(`paid-ad:${ad.calculated.paidAdId}`, ad.observed, PAID_AD_FIELDS);
    if (item) evidence.push(item);
  }

  evidence.push(...qualityEvidence(companyId, fields, row.storageIssues));
  return EvidencePackageSchema.parse({companyId, canonicalDomain, evidence: evidence.sort((left, right) => left.ref.localeCompare(right.ref)), published: publishedMetadata(row), review: reviewMetadata(row)});
}
