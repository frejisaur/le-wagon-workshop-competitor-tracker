import {z} from 'zod';
import type {CuratedKeyword, CuratedPaidAd, DataQualityIssue} from '@/lib/domain/metrics';
import {CandidateClaimSchema, CandidateReviewReasonSchema, ConfidenceSchema, type CandidateClaim, type CandidateReviewReason, type Confidence} from '@/lib/schemas/insight-candidate';
import type {AirtableFields, AirtableRecord, CompanyPersistenceWrite} from './types';

/** Airtable rejects long text over 100,000 characters; a UTF-8 byte budget below it is a safe upper bound. */
export const MAX_AIRTABLE_JSON_BYTES = 90_000;
const MAX_QUALITY_ISSUES = 25;
const MAX_SUMMARY_LENGTH = 300;

const JSON_CAPS = {
  competitors: 10,
  aiCountries: 25,
  aiByLlm: 4,
  aiCitedSources: 10,
  mozSummaries: 10,
  compactTrend: 24,
  portfolio: 50,
  serpCodes: 100,
  inputs: 100,
  keywords: 60,
  paidAds: 40,
  claims: 100,
  evidenceRefs: 100,
  reviewReasons: 7,
} as const;

/** Companies fields owned by this codec. Their JSON holds validated domain types, never provider objects or field-name maps. */
export const COMPANY_ROW_FIELDS = {
  keywords: 'Observed • Keywords JSON',
  keywordsAt: 'Observed • Keywords At',
  paidAds: 'Observed • Paid Ads JSON',
  battlecard: 'Inferred • Battlecard JSON',
  battlecardId: 'Workflow • Battlecard ID',
  battlecardHarness: 'Workflow • Battlecard Harness',
  battlecardModel: 'Workflow • Battlecard Model',
  battlecardSkillVersion: 'Workflow • Battlecard Skill Version',
  battlecardFingerprint: 'Workflow • Battlecard Evidence Fingerprint',
  battlecardWorkflowVersion: 'Workflow • Battlecard Version',
  battlecardRunId: 'Workflow • Battlecard Run ID',
  battlecardGeneratedAt: 'Workflow • Battlecard Generated At',
  reviewCandidate: 'Review • Candidate JSON',
  reviewStatus: 'Review • Status',
  reviewIdentity: 'Review • Identity',
  reviewAt: 'Review • At',
  reviewNotes: 'Review • Notes',
} as const;
const OWNED_FIELDS = new Set<string>(Object.values(COMPANY_ROW_FIELDS));

export type StoredPaidAd = {observed: CuratedPaidAd['observed'] & {firstObservedAt: string; lastObservedAt: string}; calculated: CuratedPaidAd['calculated']};
export type BattlecardClaims = {observedThemes: CandidateClaim[]; inferredClaims: CandidateClaim[]; recommendations: CandidateClaim[]; overallConfidence?: Confidence};
export type InsightProvenance = {evidenceFingerprint: string; agentHarness: string; model: string; skillVersion: string; workflowVersion: string; runId: string; generatedAt: string};
/** The one current published insight for a company. */
export type PublishedBattlecard = BattlecardClaims & InsightProvenance & {insightId: string};
/** The pending agent candidate awaiting human review. */
export type ReviewCandidate = BattlecardClaims & InsightProvenance & {reviewReasons: CandidateReviewReason[]};
export type ReviewStatus = 'needs_review' | 'approved' | 'rejected' | 'stale' | 'published';
/** Review state is edited by people in Airtable; every value here is untrusted data. */
export type CompanyReview = {status?: ReviewStatus; candidate?: ReviewCandidate; reviewerNotes?: string; reviewerIdentity?: string; reviewedAt?: string};
export type StorageSection = 'keywords' | 'paid_ads' | 'battlecard' | 'review';

/** One Companies record, with its JSON fields parsed into domain types. `fields` keeps only the scalar and metric columns. */
export type CompanyRow = {
  recordId: string;
  fields: AirtableFields;
  keywords: CuratedKeyword[];
  keywordsObservedAt?: string;
  paidAds: StoredPaidAd[];
  battlecard?: PublishedBattlecard;
  review?: CompanyReview;
  /** Unreadable stored JSON. The affected section renders as missing; it is never read as empty evidence. */
  storageIssues: DataQualityIssue[];
};

const finiteOrNull = z.number().finite().nullable();
const observedGroup = {classification: z.literal('observed'), source: z.enum(['apollo', 'semrush']), observedAt: z.string().min(1), database: z.string().optional(), rawRef: z.string().optional()};
const calculatedGroup = {classification: z.literal('calculated'), inputs: z.array(z.string()), calculatedAt: z.string().min(1)};

export const CuratedKeywordSchema = z.object({
  observed: z.object({
    ...observedGroup, keyword: z.string().min(1), landingUrl: z.string().min(1), position: finiteOrNull, previousPosition: finiteOrNull,
    positionDifference: finiteOrNull, volume: finiteOrNull, cpcUsd: finiteOrNull, keywordDifficulty: finiteOrNull, competition: finiteOrNull,
    traffic: finiteOrNull, trafficSharePct: finiteOrNull, trafficCostUsd: finiteOrNull, intents: z.array(z.string()),
    rawSerpCodes: z.array(z.union([z.string(), z.number().finite()])), results: finiteOrNull,
  }).strict(),
  calculated: z.object({...calculatedGroup, companyId: z.string().min(1), keywordId: z.string().min(1), normalizedLandingUrl: z.string().min(1)}).strict(),
}).strict() satisfies z.ZodType<CuratedKeyword>;

export const StoredPaidAdSchema = z.object({
  observed: z.object({
    ...observedGroup, keyword: z.string().nullable(), title: z.string().nullable(), description: z.string().nullable(), visibleUrl: z.string().nullable(),
    landingUrl: z.string().min(1), position: finiteOrNull, previousPosition: finiteOrNull, volume: finiteOrNull, cpcUsd: finiteOrNull,
    keywordDifficulty: finiteOrNull, competition: finiteOrNull, traffic: finiteOrNull, trafficSharePct: finiteOrNull, trafficCostUsd: finiteOrNull,
    firstObservedAt: z.string().min(1), lastObservedAt: z.string().min(1),
  }).strict(),
  calculated: z.object({...calculatedGroup, companyId: z.string().min(1), paidAdId: z.string().min(1), normalizedLandingUrl: z.string().min(1)}).strict(),
}).strict() satisfies z.ZodType<StoredPaidAd>;

function claimCollection(classification: CandidateClaim['classification']) {
  return z.array(CandidateClaimSchema).max(JSON_CAPS.claims).refine((claims) => claims.every((claim) => claim.classification === classification), `${classification} claim collection contains another classification`);
}
const BattlecardClaimsShape = {observedThemes: claimCollection('observed'), inferredClaims: claimCollection('inferred'), recommendations: claimCollection('inferred'), overallConfidence: ConfidenceSchema.optional()};
const uniqueClaimIds = (claims: BattlecardClaims) => {
  const ids = [...claims.observedThemes, ...claims.inferredClaims, ...claims.recommendations].map((claim) => claim.claimId);
  return new Set(ids).size === ids.length;
};
export const BattlecardClaimsSchema = z.object(BattlecardClaimsShape).strict().refine(uniqueClaimIds, 'claim IDs must be unique');
const nonEmpty = z.string().min(1);
const InsightProvenanceShape = {evidenceFingerprint: nonEmpty, agentHarness: nonEmpty, model: nonEmpty, skillVersion: nonEmpty, workflowVersion: nonEmpty, runId: nonEmpty, generatedAt: z.string().datetime({offset: true})};
const PublishedBattlecardSchema = z.object({...BattlecardClaimsShape, ...InsightProvenanceShape, insightId: nonEmpty}).strict().refine(uniqueClaimIds, 'claim IDs must be unique');
export const ReviewCandidateSchema = z.object({...BattlecardClaimsShape, ...InsightProvenanceShape, reviewReasons: z.array(CandidateReviewReasonSchema).max(JSON_CAPS.reviewReasons)}).strict().refine(uniqueClaimIds, 'claim IDs must be unique');
const ReviewStatusSchema = z.enum(['needs_review', 'approved', 'rejected', 'stale', 'published']);

function json(value: unknown): string {
  return JSON.stringify(value);
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(json(value)).byteLength;
}

/** True when a value serializes within the long-text budget of one Airtable field. */
export function fitsJsonField(value: unknown): boolean {
  return byteLength(value) <= MAX_AIRTABLE_JSON_BYTES;
}

/** Keeps structured JSON valid: whole tail items are removed, never character-truncated. */
function bounded<T>(items: T[], maxItems: number): {json: string; retained: number} {
  const kept = items.slice(0, maxItems);
  while (kept.length > 0 && !fitsJsonField(kept)) kept.pop();
  return {json: json(kept), retained: kept.length};
}

function boundedJson<T>(items: T[], maxItems: number): string {
  return bounded(items, maxItems).json;
}

function boundedText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_LENGTH);
}

function issueSummary(issue: DataQualityIssue): {code: DataQualityIssue['code']; sourcePath: string; summary: string} {
  return {code: issue.code, sourcePath: boundedText(issue.sourcePath), summary: boundedText(issue.summary)};
}

function truncationIssue(section: StorageSection, retained: number, original: number): DataQualityIssue {
  return {code: 'stored_snapshot_truncated', message: `Stored ${section} snapshot keeps the highest-traffic items within the Airtable field budget`, sourcePath: `storage.${section}`, summary: `retained ${retained} of ${original}`};
}

function validIsoTimestamp(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== value ? null : value;
}

/** Selects chronological bounds from valid ISO timestamps; invalid stored values cannot corrupt a refreshed ad. */
export function paidAdObservationRange(incomingAt: string, storedFirstAt?: string, storedLastAt?: string): {firstObservedAt: string; lastObservedAt: string} {
  const incoming = validIsoTimestamp(incomingAt);
  if (!incoming) throw new TypeError('paid ad observedAt must be a valid ISO timestamp');
  const firstCandidates = [incoming, validIsoTimestamp(storedFirstAt)].filter((value): value is string => value !== null);
  const lastCandidates = [incoming, validIsoTimestamp(storedLastAt)].filter((value): value is string => value !== null);
  return {firstObservedAt: firstCandidates.sort()[0], lastObservedAt: lastCandidates.sort().at(-1)!};
}

/** Replaces the paid-ad snapshot while carrying first/last-observed history for ads seen before. */
export function mergePaidAdHistory(companyId: string, incoming: CuratedPaidAd[], stored: StoredPaidAd[]): StoredPaidAd[] {
  const storedById = new Map(stored.map((ad) => [ad.calculated.paidAdId, ad]));
  const seen = new Set<string>();
  return incoming.map((ad) => {
    if (ad.calculated.companyId !== companyId) throw new TypeError('paid_ad_company_mismatch');
    if (!ad.calculated.paidAdId || seen.has(ad.calculated.paidAdId)) throw new TypeError('duplicate_incoming_paid_ad_identity');
    seen.add(ad.calculated.paidAdId);
    const previous = storedById.get(ad.calculated.paidAdId)?.observed;
    return {observed: {...ad.observed, ...paidAdObservationRange(ad.observed.observedAt, previous?.firstObservedAt, previous?.lastObservedAt)}, calculated: ad.calculated};
  });
}

function trafficOrder<T extends {observed: {traffic: number | null}}>(identity: (item: T) => string) {
  return (left: T, right: T) => (right.observed.traffic ?? -1) - (left.observed.traffic ?? -1) || identity(left).localeCompare(identity(right));
}

function keywordFields(companyId: string, keywords: CuratedKeyword[], observedAt: string, issues: DataQualityIssue[]): AirtableFields {
  const seen = new Set<string>();
  for (const keyword of keywords) {
    if (keyword.calculated.companyId !== companyId) throw new TypeError('keyword_company_mismatch');
    if (seen.has(keyword.calculated.keywordId)) throw new TypeError('duplicate_incoming_keyword_identity');
    seen.add(keyword.calculated.keywordId);
  }
  const stored = bounded([...keywords].sort(trafficOrder((keyword) => keyword.calculated.keywordId)), JSON_CAPS.keywords);
  if (stored.retained < keywords.length) issues.push(truncationIssue('keywords', stored.retained, keywords.length));
  return {[COMPANY_ROW_FIELDS.keywords]: stored.json, [COMPANY_ROW_FIELDS.keywordsAt]: observedAt};
}

function paidAdFields(ads: StoredPaidAd[], issues: DataQualityIssue[]): AirtableFields {
  const stored = bounded([...ads].sort(trafficOrder((ad) => ad.calculated.paidAdId)), JSON_CAPS.paidAds);
  if (stored.retained < ads.length) issues.push(truncationIssue('paid_ads', stored.retained, ads.length));
  return {[COMPANY_ROW_FIELDS.paidAds]: stored.json};
}

/**
 * Maps only validated curated evidence; raw provider records never cross this boundary.
 * Keyword and paid-ad snapshots are written only when supplied, so an omitted provider module keeps the stored snapshot.
 */
export function toCompanyFields(company: CompanyPersistenceWrite, stored?: CompanyRow): AirtableFields {
  const {observed, calculated} = company;
  const storageIssues: DataQualityIssue[] = [];
  const evidence = {
    ...(observed && company.keywords ? keywordFields(company.companyId, company.keywords, observed.observedAt, storageIssues) : {}),
    ...(observed && company.paidAds ? paidAdFields(mergePaidAdHistory(company.companyId, company.paidAds, stored?.paidAds ?? []), storageIssues) : {}),
  };
  return {
    'Identity • Company ID': company.companyId,
    'Identity • Canonical Domain': company.identity.canonicalDomain,
    'Observed • Apollo Account ID': company.identity.apolloAccountId,
    'Observed • Apollo Record ID': company.identity.apolloRecordId,
    'Observed • Display Name': company.displayName,
    'Observed • Segment': company.segment,
    'Observed • Apollo Website': company.apolloWebsite,
    'Observed • Apify Domain': company.apifyDomain,
    'Observed • Apollo Account Stage': company.apolloAccountStage,
    'Observed • Apollo Lists': company.apolloLists,
    'Observed • Apollo Employees': company.apolloEmployees,
    'Observed • Apollo Industry': company.apolloIndustry,
    'Observed • Apollo Company Country': company.apolloCompanyCountry,
    'Observed • Source': observed?.source,
    'Observed • At': observed?.observedAt,
    'Observed • Database': observed?.database,
    'Observed • Raw Ref': observed?.rawRef,
    'Observed • Domain': observed?.domain,
    'Observed • Authority Score': observed?.authorityScore,
    'Observed • Backlinks': observed?.backlinks,
    'Observed • Referring Domains': observed?.referringDomains,
    'Observed • Follow Backlinks': observed?.followBacklinks,
    'Observed • No-follow Backlinks': observed?.noFollowBacklinks,
    'Observed • Organic Traffic': observed?.organicTraffic,
    'Observed • Total Traffic': observed?.totalTraffic,
    'Observed • Organic Keywords': observed?.organicKeywords,
    'Observed • Organic Traffic Cost USD': observed?.organicTrafficCostUsd,
    'Observed • Paid Traffic': observed?.paidTraffic,
    'Observed • Paid Keywords': observed?.paidKeywords,
    'Observed • Paid Traffic Cost USD': observed?.paidTrafficCostUsd,
    'Observed • AI Visibility': observed?.aiVisibility,
    'Observed • AI Visibility Benchmark': observed?.aiVisibilityBenchmark,
    'Observed • AI Mentions': observed?.aiMentions,
    'Observed • AI Cited Pages': observed?.aiCitedPages,
    'Observed • Top Country': observed?.topCountry,
    'Observed • Top Country Traffic': observed?.topCountryTraffic,
    'Observed • Moz Domain Authority Raw': observed?.mozDomainAuthorityRaw,
    'Observed • Moz Spam Score Raw': observed?.mozSpamScoreRaw,
    'Observed • Organic Competitors JSON': observed ? boundedJson(observed.organicCompetitors, JSON_CAPS.competitors) : undefined,
    'Observed • Organic Competitors Observed Count': observed?.organicCompetitors.length,
    'Observed • Paid Competitors JSON': observed ? boundedJson(observed.paidCompetitors, JSON_CAPS.competitors) : undefined,
    'Observed • Paid Competitors Observed Count': observed?.paidCompetitors.length,
    'Observed • AI Countries JSON': observed ? boundedJson(observed.aiCountries, JSON_CAPS.aiCountries) : undefined,
    'Observed • AI Countries Observed Count': observed?.aiCountries.length,
    'Observed • AI by LLM JSON': observed ? boundedJson(observed.aiByLlm, JSON_CAPS.aiByLlm) : undefined,
    'Observed • AI by LLM Observed Count': observed?.aiByLlm.length,
    'Observed • AI Top Cited Sources JSON': observed ? boundedJson(observed.aiTopCitedSources, JSON_CAPS.aiCitedSources) : undefined,
    'Observed • AI Top Cited Sources Observed Count': observed?.aiTopCitedSources.length,
    'Observed • SERP Codes JSON': observed ? boundedJson(observed.rawSerpCodes, JSON_CAPS.serpCodes) : undefined,
    'Observed • SERP Codes Observed Count': observed?.rawSerpCodes.length,
    'Observed • Moz Top Pages JSON': observed ? boundedJson(observed.mozTopPagesObserved, JSON_CAPS.mozSummaries) : undefined,
    'Observed • Moz Top Pages Observed Count': observed?.mozTopPagesObserved.length,
    ...evidence,
    'Calculated • At': calculated?.calculatedAt,
    'Calculated • Inputs JSON': calculated ? boundedJson(calculated.inputs, JSON_CAPS.inputs) : undefined,
    'Calculated • Organic Traffic 30d Movement': calculated?.organicTraffic30DayMovement,
    'Calculated • Organic Traffic 12m Movement': calculated?.organicTraffic12MonthMovement,
    'Calculated • Non-brand Share': calculated?.nonBrandShare,
    'Calculated • AI Benchmark Gap': calculated?.aiBenchmarkGap,
    'Calculated • Tracked Set Traffic Share': calculated?.trackedSetTrafficShare,
    'Calculated • Organic Competitors JSON': calculated ? boundedJson(calculated.organicCompetitors, JSON_CAPS.competitors) : undefined,
    'Calculated • Paid Competitors JSON': calculated ? boundedJson(calculated.paidCompetitors, JSON_CAPS.competitors) : undefined,
    'Calculated • AI Countries JSON': calculated ? boundedJson(calculated.aiCountries, JSON_CAPS.aiCountries) : undefined,
    'Calculated • AI Countries Observed Count': calculated?.aiCountriesObservedCount,
    'Calculated • Moz Domain Authority': calculated?.mozDomainAuthority.normalized,
    'Calculated • Moz Spam Score': calculated?.mozSpamScore.normalized,
    'Calculated • Moz Top Pages JSON': calculated ? boundedJson(calculated.mozTopPages, JSON_CAPS.mozSummaries) : undefined,
    'Calculated • Moz Top Pages Observed Count': calculated?.mozTopPagesObservedCount,
    'Calculated • Top Keyword Sample Count': calculated?.topKeywordSampleCount,
    'Calculated • Compact Organic Trend JSON': calculated ? boundedJson(calculated.compactOrganicTrend, JSON_CAPS.compactTrend) : undefined,
    'Calculated • Landing Page Portfolio JSON': calculated ? boundedJson(calculated.landingPagePortfolio, JSON_CAPS.portfolio) : undefined,
    'Calculated • Paid Activity Present': calculated?.paidActivityPresent,
    // Truncation issues lead so the issue cap never hides them.
    'Quality • Issues JSON': boundedJson([...storageIssues, ...company.qualityIssues].map(issueSummary), MAX_QUALITY_ISSUES),
    'Workflow • Evidence Fingerprint': company.evidenceFingerprint,
    'Workflow • Last Successful Refresh At': company.lastSuccessfulRefreshAt,
    'Workflow • Next Insight Due At': company.nextAgentEnrichmentDueAt ?? company.nextInsightDueAt,
  };
}

function storedClaims(claims: BattlecardClaims): BattlecardClaims {
  const collections = [[claims.observedThemes, 'observed'], [claims.inferredClaims, 'inferred'], [claims.recommendations, 'inferred']] as const;
  for (const [collection, classification] of collections) {
    if (collection.some((claim) => claim.classification !== classification)) throw new TypeError(`${classification} claim collection contains another classification`);
    if (collection.length > JSON_CAPS.claims) throw new TypeError('claim collection exceeds Airtable cap');
    for (const claim of collection) {
      if (claim.evidenceRefs.length === 0) throw new TypeError('claim requires at least one evidence ref');
      if (claim.evidenceRefs.length > JSON_CAPS.evidenceRefs) throw new TypeError('claim evidence refs exceed Airtable cap');
    }
  }
  return {observedThemes: claims.observedThemes, inferredClaims: claims.inferredClaims, recommendations: claims.recommendations, ...(claims.overallConfidence ? {overallConfidence: claims.overallConfidence} : {})};
}

function jsonField(value: unknown, label: string): string {
  // The message never echoes the value: claims and evidence refs may be private.
  if (!fitsJsonField(value)) throw new TypeError(`${label} cannot retain evidence within Airtable JSON byte budget`);
  return json(value);
}

/** Replaces the published battlecard. Claims are stored whole; an oversized battlecard is rejected, never truncated. */
export function toBattlecardFields(battlecard: PublishedBattlecard): AirtableFields {
  return {
    [COMPANY_ROW_FIELDS.battlecard]: jsonField(storedClaims(battlecard), 'battlecard'),
    [COMPANY_ROW_FIELDS.battlecardId]: battlecard.insightId,
    [COMPANY_ROW_FIELDS.battlecardHarness]: battlecard.agentHarness,
    [COMPANY_ROW_FIELDS.battlecardModel]: battlecard.model,
    [COMPANY_ROW_FIELDS.battlecardSkillVersion]: battlecard.skillVersion,
    [COMPANY_ROW_FIELDS.battlecardFingerprint]: battlecard.evidenceFingerprint,
    [COMPANY_ROW_FIELDS.battlecardWorkflowVersion]: battlecard.workflowVersion,
    [COMPANY_ROW_FIELDS.battlecardRunId]: battlecard.runId,
    [COMPANY_ROW_FIELDS.battlecardGeneratedAt]: battlecard.generatedAt,
  };
}

/** Writes the pending candidate and its review state. Reviewer fields pass through unchanged when supplied. */
export function toReviewFields(review: {status: ReviewStatus; candidate: ReviewCandidate; reviewerNotes?: string | null; reviewerIdentity?: string | null; reviewedAt?: string | null}): AirtableFields {
  const {candidate} = review;
  if (candidate.reviewReasons.length > JSON_CAPS.reviewReasons) throw new TypeError('review reasons exceed Airtable cap');
  const stored: ReviewCandidate = {
    ...storedClaims(candidate), reviewReasons: [...new Set(candidate.reviewReasons)].sort(), evidenceFingerprint: candidate.evidenceFingerprint,
    agentHarness: candidate.agentHarness, model: candidate.model, skillVersion: candidate.skillVersion, workflowVersion: candidate.workflowVersion, runId: candidate.runId, generatedAt: candidate.generatedAt,
  };
  return {
    [COMPANY_ROW_FIELDS.reviewCandidate]: jsonField(stored, 'review candidate'),
    [COMPANY_ROW_FIELDS.reviewStatus]: review.status,
    [COMPANY_ROW_FIELDS.reviewNotes]: review.reviewerNotes,
    [COMPANY_ROW_FIELDS.reviewIdentity]: review.reviewerIdentity,
    [COMPANY_ROW_FIELDS.reviewAt]: review.reviewedAt,
  };
}

function text(fields: AirtableFields, name: string): string | undefined {
  const value = fields[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function unreadable(section: StorageSection, field: string): DataQualityIssue {
  return {code: 'unreadable_stored_json', message: `${field} is not valid stored ${section} data`, sourcePath: `storage.${section}`, summary: `${field} unreadable; treated as missing`};
}

type Parsed<T> = {value?: T; issue?: DataQualityIssue};

/** Absent stays absent. Present but unparseable becomes a data-quality issue and no value, never an empty default. */
function parseJsonField<T>(fields: AirtableFields, field: string, section: StorageSection, schema: z.ZodType<T>): Parsed<T> {
  const raw = fields[field];
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw !== 'string') return {issue: unreadable(section, field)};
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return {issue: unreadable(section, field)}; }
  const result = schema.safeParse(parsed);
  return result.success ? {value: result.data} : {issue: unreadable(section, field)};
}

function parseBattlecard(fields: AirtableFields): Parsed<PublishedBattlecard> {
  const claims = parseJsonField(fields, COMPANY_ROW_FIELDS.battlecard, 'battlecard', BattlecardClaimsSchema);
  if (!claims.value) return claims.issue ? {issue: claims.issue} : {};
  const result = PublishedBattlecardSchema.safeParse({
    ...claims.value, insightId: text(fields, COMPANY_ROW_FIELDS.battlecardId), agentHarness: text(fields, COMPANY_ROW_FIELDS.battlecardHarness),
    model: text(fields, COMPANY_ROW_FIELDS.battlecardModel), skillVersion: text(fields, COMPANY_ROW_FIELDS.battlecardSkillVersion),
    evidenceFingerprint: text(fields, COMPANY_ROW_FIELDS.battlecardFingerprint), workflowVersion: text(fields, COMPANY_ROW_FIELDS.battlecardWorkflowVersion),
    runId: text(fields, COMPANY_ROW_FIELDS.battlecardRunId), generatedAt: text(fields, COMPANY_ROW_FIELDS.battlecardGeneratedAt),
  });
  return result.success ? {value: result.data} : {issue: unreadable('battlecard', COMPANY_ROW_FIELDS.battlecard)};
}

function parseReview(fields: AirtableFields): Parsed<CompanyReview> {
  const candidate = parseJsonField(fields, COMPANY_ROW_FIELDS.reviewCandidate, 'review', ReviewCandidateSchema);
  const rawStatus = text(fields, COMPANY_ROW_FIELDS.reviewStatus);
  const status = rawStatus === undefined ? undefined : ReviewStatusSchema.safeParse(rawStatus);
  const review: CompanyReview = {
    ...(status?.success ? {status: status.data} : {}), ...(candidate.value ? {candidate: candidate.value} : {}),
    ...(text(fields, COMPANY_ROW_FIELDS.reviewNotes) ? {reviewerNotes: text(fields, COMPANY_ROW_FIELDS.reviewNotes)} : {}),
    ...(text(fields, COMPANY_ROW_FIELDS.reviewIdentity) ? {reviewerIdentity: text(fields, COMPANY_ROW_FIELDS.reviewIdentity)} : {}),
    ...(text(fields, COMPANY_ROW_FIELDS.reviewAt) ? {reviewedAt: text(fields, COMPANY_ROW_FIELDS.reviewAt)} : {}),
  };
  const issue = candidate.issue ?? (status && !status.success ? unreadable('review', COMPANY_ROW_FIELDS.reviewStatus) : undefined);
  return {...(Object.keys(review).length ? {value: review} : {}), ...(issue ? {issue} : {})};
}

/** Parses one Companies record. A malformed JSON field never throws and never hides the rest of the company. */
export function parseCompanyRecord(record: AirtableRecord): CompanyRow {
  const fields = Object.fromEntries(Object.entries(record.fields).filter(([name]) => !OWNED_FIELDS.has(name)));
  const keywords = parseJsonField(record.fields, COMPANY_ROW_FIELDS.keywords, 'keywords', z.array(CuratedKeywordSchema));
  const paidAds = parseJsonField(record.fields, COMPANY_ROW_FIELDS.paidAds, 'paid_ads', z.array(StoredPaidAdSchema));
  const battlecard = parseBattlecard(record.fields);
  const review = parseReview(record.fields);
  const keywordsObservedAt = text(record.fields, COMPANY_ROW_FIELDS.keywordsAt);
  return {
    recordId: record.id, fields, keywords: keywords.value ?? [], ...(keywordsObservedAt ? {keywordsObservedAt} : {}), paidAds: paidAds.value ?? [],
    ...(battlecard.value ? {battlecard: battlecard.value} : {}), ...(review.value ? {review: review.value} : {}),
    storageIssues: [keywords.issue, paidAds.issue, battlecard.issue, review.issue].filter((issue): issue is DataQualityIssue => issue !== undefined),
  };
}

/** The stable company ID of a parsed row, when it has one. */
export function companyIdOf(row: CompanyRow): string | undefined {
  return text(row.fields, 'Identity • Company ID');
}
