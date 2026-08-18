import type {AirtableFieldValue, AirtableFields, AirtableRecord} from '@/lib/airtable/types';
import type {BuildEvidencePackageInput, EvidencePackage, EvidenceReference, EvidenceValue, PublishedInsightMetadata, ReviewMetadata} from '@/lib/agents/types';

// This is deliberately an allow-list, not a prefix match: future Airtable
// columns (especially an accidental raw-payload column) cannot reach agents.
const COMPANY_OBSERVED_FIELDS = new Set([
  'Apollo Account ID', 'Apollo Record ID', 'Display Name', 'Segment', 'Apollo Website', 'Apify Domain', 'Apollo Account Stage', 'Apollo Lists', 'Apollo Employees', 'Apollo Industry', 'Apollo Company Country',
  'Domain', 'Authority Score', 'Backlinks', 'Referring Domains', 'Follow Backlinks', 'No-follow Backlinks', 'Organic Traffic', 'Total Traffic', 'Organic Keywords', 'Organic Traffic Cost USD', 'Paid Traffic', 'Paid Keywords', 'Paid Traffic Cost USD', 'AI Visibility', 'AI Visibility Benchmark', 'AI Mentions', 'AI Cited Pages', 'Top Country', 'Top Country Traffic', 'Moz Domain Authority Raw', 'Moz Spam Score Raw',
  'Organic Competitors JSON', 'Organic Competitors Observed Count', 'Paid Competitors JSON', 'Paid Competitors Observed Count', 'AI Countries JSON', 'AI Countries Observed Count', 'AI by LLM JSON', 'AI by LLM Observed Count', 'SERP Codes JSON', 'SERP Codes Observed Count', 'Moz Top Pages JSON', 'Moz Top Pages Observed Count',
]);
const COMPANY_CALCULATED_FIELDS = new Set([
  'Inputs JSON', 'Organic Traffic 30d Movement', 'Organic Traffic 12m Movement', 'Non-brand Share', 'AI Benchmark Gap', 'Tracked Set Traffic Share', 'Organic Competitors JSON', 'Paid Competitors JSON', 'AI Countries JSON', 'AI Countries Observed Count', 'Moz Domain Authority', 'Moz Spam Score', 'Moz Top Pages JSON', 'Moz Top Pages Observed Count', 'Top Keyword Sample Count', 'Compact Organic Trend JSON', 'Landing Page Portfolio JSON', 'Paid Activity Present',
]);
const KEYWORD_FIELDS = ['Keyword', 'Landing URL', 'Position', 'Previous Position', 'Position Difference', 'Volume', 'CPC USD', 'Keyword Difficulty', 'Competition', 'Traffic', 'Traffic Share Pct', 'Traffic Cost USD', 'Intents JSON', 'SERP Codes JSON', 'Results'];
const PAID_AD_FIELDS = ['Keyword', 'Title', 'Description', 'Visible URL', 'Landing URL', 'Position', 'Previous Position', 'Volume', 'CPC USD', 'Keyword Difficulty', 'Competition', 'Traffic', 'Traffic Share Pct', 'Traffic Cost USD', 'First Observed At', 'Last Observed At'];

function stringField(fields: AirtableFields, name: string): string | undefined {
  const value = fields[name];
  return typeof value === 'string' && value ? value : undefined;
}

function scalarOrStrings(value: AirtableFieldValue | undefined): EvidenceValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return [...value];
  return undefined;
}

function curatedValue(value: AirtableFieldValue | undefined): EvidenceValue | undefined {
  if (typeof value !== 'string' || !value.trim().startsWith('[') && !value.trim().startsWith('{')) return scalarOrStrings(value);
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
  return {
    source: stringField(fields, 'Observed • Source') ?? 'airtable_curated',
    database: stringField(fields, 'Observed • Database'),
    observedAt: stringField(fields, 'Observed • At'),
    rawDatasetRef: stringField(fields, 'Observed • Raw Ref'),
  };
}

function calculatedProvenance(fields: AirtableFields) {
  return {source: 'deterministic_calculation', calculatedAt: stringField(fields, 'Calculated • At')};
}

function rowEvidence(ref: string, fields: AirtableFields, allowedFields: string[]): EvidenceReference | undefined {
  const value: {[key: string]: EvidenceValue} = {};
  for (const field of allowedFields) {
    const item = curatedValue(fields[`Observed • ${field}`]);
    if (item !== undefined) value[fieldSlug(field)] = item;
  }
  if (Object.keys(value).length === 0) return undefined;
  return {ref, classification: 'observed', ...observedProvenance(fields), value};
}

function reviewReasons(record: AirtableRecord | undefined): string[] {
  const raw = record?.fields['Inferred • Review Reasons JSON'];
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? [...parsed].sort() : [];
  } catch {
    return [];
  }
}

function publishedMetadata(record: AirtableRecord | undefined): PublishedInsightMetadata | undefined {
  if (!record) return undefined;
  return {
    evidenceFingerprint: stringField(record.fields, 'Workflow • Evidence Fingerprint'),
    skillVersion: stringField(record.fields, 'Workflow • Skill Version'),
    workflowVersion: stringField(record.fields, 'Workflow • Version'),
  };
}

function reviewMetadata(record: AirtableRecord | undefined): ReviewMetadata | undefined {
  if (!record) return undefined;
  return {
    status: stringField(record.fields, 'Review • Status'),
    evidenceFingerprint: stringField(record.fields, 'Workflow • Evidence Fingerprint'),
    skillVersion: stringField(record.fields, 'Workflow • Skill Version'),
    workflowVersion: stringField(record.fields, 'Workflow • Version'),
    reviewReasons: reviewReasons(record),
    untrustedReviewerNotes: stringField(record.fields, 'Review • Notes'),
  };
}

/** Builds an allow-listed evidence package from already-curated store records. */
export function buildEvidencePackage(input: BuildEvidencePackageInput): EvidencePackage {
  const companyId = stringField(input.company.fields, 'Identity • Company ID');
  if (!companyId) throw new TypeError('company record requires a stable company ID');
  const evidence: EvidenceReference[] = [];
  const canonicalDomain = stringField(input.company.fields, 'Identity • Canonical Domain');
  if (canonicalDomain) evidence.push({ref: `company:${companyId}:identity:canonical_domain`, classification: 'observed', source: 'airtable_curated', value: canonicalDomain});

  for (const [field, value] of Object.entries(input.company.fields).sort(([left], [right]) => left.localeCompare(right))) {
    if (field.startsWith('Observed • ')) {
      const label = field.slice('Observed • '.length);
      if (!COMPANY_OBSERVED_FIELDS.has(label)) continue;
      const curated = curatedValue(value);
      if (curated !== undefined) evidence.push({ref: `company:${companyId}:metric:${fieldSlug(label)}`, classification: 'observed', ...observedProvenance(input.company.fields), value: curated});
    }
    if (field.startsWith('Calculated • ')) {
      const label = field.slice('Calculated • '.length);
      if (!COMPANY_CALCULATED_FIELDS.has(label)) continue;
      const curated = curatedValue(value);
      if (curated !== undefined) evidence.push({ref: `company:${companyId}:calculation:${fieldSlug(label)}`, classification: 'calculated', ...calculatedProvenance(input.company.fields), value: curated});
    }
  }

  for (const keyword of [...input.keywords].sort((left, right) => String(left.fields['Identity • Keyword ID']).localeCompare(String(right.fields['Identity • Keyword ID'])))) {
    const keywordId = stringField(keyword.fields, 'Identity • Keyword ID');
    if (!keywordId) continue;
    const row = rowEvidence(`keyword:${keywordId}`, keyword.fields, KEYWORD_FIELDS);
    if (row) evidence.push(row);
  }
  for (const ad of [...input.paidAds].sort((left, right) => String(left.fields['Identity • Paid Ad ID']).localeCompare(String(right.fields['Identity • Paid Ad ID'])))) {
    const paidAdId = stringField(ad.fields, 'Identity • Paid Ad ID');
    if (!paidAdId) continue;
    const row = rowEvidence(`paid-ad:${paidAdId}`, ad.fields, PAID_AD_FIELDS);
    if (row) evidence.push(row);
  }

  return {companyId, canonicalDomain, evidence: evidence.sort((left, right) => left.ref.localeCompare(right.ref)), published: publishedMetadata(input.publishedInsight), review: reviewMetadata(input.review)};
}
