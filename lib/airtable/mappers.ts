import type {CuratedKeyword, CuratedPaidAd, DataQualityIssue} from '@/lib/domain/metrics';
import type {AirtableFields, ClaimWire, CompanyPersistenceWrite, InsightWireInput, ReviewWireInput, SystemWireInput} from './types';

const MAX_QUALITY_ISSUES = 25;
const MAX_SUMMARY_LENGTH = 300;
export const MAX_AIRTABLE_JSON_BYTES = 90_000;

const JSON_CAPS = {
  competitors: 10,
  aiCountries: 25,
  aiByLlm: 4,
  mozSummaries: 10,
  compactTrend: 24,
  portfolio: 50,
  serpCodes: 100,
  intents: 20,
  inputs: 100,
  claims: 100,
  evidenceRefs: 100,
  reviewReasons: 25,
} as const;

function boundedText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_LENGTH);
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

/** Keeps structured JSON valid: whole tail items are removed, never character-truncated. */
function boundedJson<T>(items: T[], maxItems: number): string {
  const bounded = items.slice(0, maxItems);
  while (bounded.length > 0 && new TextEncoder().encode(json(bounded)).byteLength > MAX_AIRTABLE_JSON_BYTES) bounded.pop();
  return json(bounded);
}

export type StoredClaimWire = Omit<ClaimWire, 'evidenceRefs'> & {evidenceRefs: string[]; evidenceRefCount: number; evidenceRefsRetainedCount: number};
type StoredClaimCollection = {json: string; originalCount: number; retainedCount: number};

function byteLength(value: unknown): number {
  return new TextEncoder().encode(json(value)).byteLength;
}

function claimWithBoundedEvidence(claim: ClaimWire): StoredClaimWire {
  if (claim.evidenceRefs.length === 0) throw new TypeError('claim requires at least one evidence ref');
  if (claim.evidenceRefs.length > JSON_CAPS.evidenceRefs) throw new TypeError('claim evidence refs exceed Airtable cap');
  return {...claim, evidenceRefs: [...claim.evidenceRefs], evidenceRefCount: claim.evidenceRefs.length, evidenceRefsRetainedCount: claim.evidenceRefs.length};
}

function classifiedClaims(claims: ClaimWire[], classification: ClaimWire['classification']): StoredClaimCollection {
  if (claims.some((claim) => claim.classification !== classification)) throw new TypeError(`${classification} claim collection contains another classification`);
  if (claims.length > JSON_CAPS.claims) throw new TypeError('claim collection exceeds Airtable cap');
  const bounded = claims.map(claimWithBoundedEvidence);
  if (byteLength(bounded) > MAX_AIRTABLE_JSON_BYTES) throw new TypeError('claim cannot retain evidence within Airtable JSON byte budget');
  return {json: json(bounded), originalCount: claims.length, retainedCount: bounded.length};
}

function issueSummary(issue: DataQualityIssue): {code: DataQualityIssue['code']; sourcePath: string; summary: string} {
  return {code: issue.code, sourcePath: boundedText(issue.sourcePath), summary: boundedText(issue.summary)};
}

/** Maps only validated curated evidence; raw provider records never cross this boundary. */
export function toAirtableCompanyFields(company: CompanyPersistenceWrite): AirtableFields {
  const {observed, calculated} = company;
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
    'Observed • SERP Codes JSON': observed ? boundedJson(observed.rawSerpCodes, JSON_CAPS.serpCodes) : undefined,
    'Observed • SERP Codes Observed Count': observed?.rawSerpCodes.length,
    'Observed • Moz Top Pages JSON': observed ? boundedJson(observed.mozTopPagesObserved, JSON_CAPS.mozSummaries) : undefined,
    'Observed • Moz Top Pages Observed Count': observed?.mozTopPagesObserved.length,
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
    'Quality • Issues JSON': boundedJson(company.qualityIssues.map(issueSummary), MAX_QUALITY_ISSUES),
    'Workflow • Evidence Fingerprint': company.evidenceFingerprint,
    'Workflow • Last Successful Refresh At': company.lastSuccessfulRefreshAt,
    'Workflow • Next Insight Due At': company.nextAgentEnrichmentDueAt ?? company.nextInsightDueAt,
  };
}

export function toAirtableKeywordFields(keyword: CuratedKeyword, companyAirtableRecordId: string): AirtableFields {
  const {observed, calculated} = keyword;
  return {
    'Identity • Keyword ID': calculated.keywordId,
    'Identity • Company ID': calculated.companyId,
    'Identity • Company Link': [companyAirtableRecordId],
    'Observed • Source': observed.source, 'Observed • At': observed.observedAt, 'Observed • Database': observed.database,
    'Observed • Keyword': observed.keyword, 'Observed • Landing URL': observed.landingUrl, 'Observed • Position': observed.position,
    'Observed • Previous Position': observed.previousPosition, 'Observed • Position Difference': observed.positionDifference,
    'Observed • Volume': observed.volume, 'Observed • CPC USD': observed.cpcUsd, 'Observed • Keyword Difficulty': observed.keywordDifficulty,
    'Observed • Competition': observed.competition, 'Observed • Traffic': observed.traffic, 'Observed • Traffic Share Pct': observed.trafficSharePct,
    'Observed • Traffic Cost USD': observed.trafficCostUsd, 'Observed • Intents JSON': boundedJson(observed.intents, JSON_CAPS.intents),
    'Observed • SERP Codes JSON': boundedJson(observed.rawSerpCodes, JSON_CAPS.serpCodes), 'Observed • Results': observed.results,
    'Calculated • Normalized Landing URL': calculated.normalizedLandingUrl, 'Calculated • At': calculated.calculatedAt,
  };
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

export function toAirtablePaidAdFields(ad: CuratedPaidAd, companyAirtableRecordId: string, storedFirstAt?: string, storedLastAt?: string): AirtableFields {
  const {observed, calculated} = ad;
  const observationRange = paidAdObservationRange(observed.observedAt, storedFirstAt, storedLastAt);
  return {
    'Identity • Paid Ad ID': calculated.paidAdId, 'Identity • Company ID': calculated.companyId, 'Identity • Company Link': [companyAirtableRecordId],
    'Observed • Source': observed.source, 'Observed • At': observed.observedAt, 'Observed • Database': observed.database,
    'Observed • Keyword': observed.keyword, 'Observed • Title': observed.title, 'Observed • Description': observed.description,
    'Observed • Visible URL': observed.visibleUrl, 'Observed • Landing URL': observed.landingUrl, 'Observed • Position': observed.position,
    'Observed • Previous Position': observed.previousPosition, 'Observed • Volume': observed.volume, 'Observed • CPC USD': observed.cpcUsd,
    'Observed • Keyword Difficulty': observed.keywordDifficulty, 'Observed • Competition': observed.competition,
    'Observed • Traffic': observed.traffic, 'Observed • Traffic Share Pct': observed.trafficSharePct, 'Observed • Traffic Cost USD': observed.trafficCostUsd,
    'Observed • First Observed At': observationRange.firstObservedAt, 'Observed • Last Observed At': observationRange.lastObservedAt,
    'Calculated • Normalized Landing URL': calculated.normalizedLandingUrl, 'Calculated • At': calculated.calculatedAt,
  };
}

export function toAirtableInsightFields(insight: InsightWireInput, companyAirtableRecordId: string): AirtableFields {
  const observedThemes = classifiedClaims(insight.observedThemes, 'observed');
  const inferredClaims = classifiedClaims(insight.inferredClaims, 'inferred');
  const recommendations = classifiedClaims(insight.recommendations, 'inferred');
  return {'Identity • Insight ID': insight.insightId, 'Identity • Company ID': insight.companyId, 'Identity • Company Link': [companyAirtableRecordId], 'Observed • Themes JSON': observedThemes.json, 'Observed • Themes Claim Count': observedThemes.originalCount, 'Observed • Themes Claims Retained Count': observedThemes.retainedCount, 'Inferred • Claims JSON': inferredClaims.json, 'Inferred • Claims Claim Count': inferredClaims.originalCount, 'Inferred • Claims Retained Count': inferredClaims.retainedCount, 'Inferred • Recommendations JSON': recommendations.json, 'Inferred • Recommendations Claim Count': recommendations.originalCount, 'Inferred • Recommendations Claims Retained Count': recommendations.retainedCount, 'Inferred • Overall Confidence': insight.overallConfidence, 'Workflow • Agent Harness': insight.agentHarness, 'Workflow • Model': insight.model, 'Workflow • Skill Version': insight.skillVersion, 'Workflow • Evidence Fingerprint': insight.evidenceFingerprint, 'Workflow • Version': insight.workflowVersion, 'Workflow • Run ID': insight.runId, 'Workflow • Generated At': insight.generatedAt};
}

export function toAirtableReviewFields(review: ReviewWireInput, companyAirtableRecordId: string): AirtableFields {
  const observedThemes = classifiedClaims(review.observedThemes, 'observed');
  const inferredClaims = classifiedClaims(review.inferredClaims, 'inferred');
  const recommendations = classifiedClaims(review.recommendations, 'inferred');
  return {'Identity • Company ID': review.companyId, 'Identity • Company Link': [companyAirtableRecordId], 'Observed • Themes JSON': observedThemes.json, 'Observed • Themes Claim Count': observedThemes.originalCount, 'Observed • Themes Claims Retained Count': observedThemes.retainedCount, 'Inferred • Claims JSON': inferredClaims.json, 'Inferred • Claims Claim Count': inferredClaims.originalCount, 'Inferred • Claims Retained Count': inferredClaims.retainedCount, 'Inferred • Recommendations JSON': recommendations.json, 'Inferred • Recommendations Claim Count': recommendations.originalCount, 'Inferred • Recommendations Claims Retained Count': recommendations.retainedCount, 'Inferred • Overall Confidence': review.overallConfidence, 'Inferred • Review Reasons JSON': boundedJson(review.reviewReasons, JSON_CAPS.reviewReasons), 'Workflow • Evidence Fingerprint': review.evidenceFingerprint, 'Workflow • Agent Harness': review.agentHarness, 'Workflow • Model': review.model, 'Workflow • Skill Version': review.skillVersion, 'Workflow • Version': review.workflowVersion, 'Workflow • Run ID': review.runId, 'Workflow • Generated At': review.generatedAt, 'Review • Status': review.status, 'Review • Notes': review.reviewerNotes, 'Review • Identity': review.reviewerIdentity, 'Review • At': review.reviewedAt};
}

export function toAirtableSystemFields(system: SystemWireInput): AirtableFields {
  return {'Identity • System ID': system.systemId, 'Workflow • Last Run Started At': system.lastRunStartedAt, 'Workflow • Last Run Finished At': system.lastRunFinishedAt, 'Workflow • Last Successful Run At': system.lastSuccessfulRunAt, 'Workflow • Status': system.status, 'Workflow • Processed Companies': system.processedCompanies, 'Workflow • Succeeded Companies': system.succeededCompanies, 'Workflow • Failed Companies': system.failedCompanies, 'Workflow • Error Summary': system.errorSummary, 'Workflow • Cache Version': system.cacheVersion, 'Railway • Workflow Version': system.railwayWorkflowVersion, 'Railway • Run ID': system.railwayRunId, 'Agent • Last Run At': system.lastAgentRunAt, 'Agent • Skill Version': system.agentSkillVersion, 'Agent • Processed Companies': system.agentProcessedCompanies, 'Agent • Review Count': system.agentReviewCount, 'Agent • Error Summary': system.agentErrorSummary};
}
