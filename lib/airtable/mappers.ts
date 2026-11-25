import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';
import {MAX_AIRTABLE_JSON_BYTES, paidAdObservationRange} from './company-row';
import type {AirtableFields, ClaimWire, InsightWireInput, ReviewWireInput, SystemWireInput} from './types';


const JSON_CAPS = {
  competitors: 10,
  aiCountries: 25,
  aiByLlm: 4,
  aiCitedSources: 10,
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

export function toAirtableKeywordFields(keyword: CuratedKeyword, companyAirtableRecordId: string): AirtableFields {
  const {observed, calculated} = keyword;
  return {
    'Identity • Keyword ID': calculated.keywordId,
    'Identity • Company ID': calculated.companyId,
    'Identity • Company Link': [companyAirtableRecordId],
    'Observed • Source': observed.source, 'Observed • At': observed.observedAt, 'Observed • Database': observed.database, 'Observed • Raw Ref': observed.rawRef,
    'Observed • Keyword': observed.keyword, 'Observed • Landing URL': observed.landingUrl, 'Observed • Position': observed.position,
    'Observed • Previous Position': observed.previousPosition, 'Observed • Position Difference': observed.positionDifference,
    'Observed • Volume': observed.volume, 'Observed • CPC USD': observed.cpcUsd, 'Observed • Keyword Difficulty': observed.keywordDifficulty,
    'Observed • Competition': observed.competition, 'Observed • Traffic': observed.traffic, 'Observed • Traffic Share Pct': observed.trafficSharePct,
    'Observed • Traffic Cost USD': observed.trafficCostUsd, 'Observed • Intents JSON': boundedJson(observed.intents, JSON_CAPS.intents),
    'Observed • SERP Codes JSON': boundedJson(observed.rawSerpCodes, JSON_CAPS.serpCodes), 'Observed • Results': observed.results,
    'Calculated • Normalized Landing URL': calculated.normalizedLandingUrl, 'Calculated • At': calculated.calculatedAt,
  };
}

export function toAirtablePaidAdFields(ad: CuratedPaidAd, companyAirtableRecordId: string, storedFirstAt?: string, storedLastAt?: string): AirtableFields {
  const {observed, calculated} = ad;
  const observationRange = paidAdObservationRange(observed.observedAt, storedFirstAt, storedLastAt);
  return {
    'Identity • Paid Ad ID': calculated.paidAdId, 'Identity • Company ID': calculated.companyId, 'Identity • Company Link': [companyAirtableRecordId],
    'Observed • Source': observed.source, 'Observed • At': observed.observedAt, 'Observed • Database': observed.database, 'Observed • Raw Ref': observed.rawRef,
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
  return {'Identity • Insight ID': insight.insightId, 'Identity • Company ID': insight.companyId, 'Identity • Company Link': [companyAirtableRecordId], 'Observed • Themes JSON': observedThemes.json, 'Observed • Themes Claim Count': observedThemes.originalCount, 'Observed • Themes Claims Retained Count': observedThemes.retainedCount, 'Inferred • Claims JSON': inferredClaims.json, 'Inferred • Claims Claim Count': inferredClaims.originalCount, 'Inferred • Claims Retained Count': inferredClaims.retainedCount, 'Inferred • Recommendations JSON': recommendations.json, 'Inferred • Recommendations Claim Count': recommendations.originalCount, 'Inferred • Recommendations Claims Retained Count': recommendations.retainedCount,
    // Explicitly clear retired free-form prose on every replacement. Airtable PATCH otherwise preserves legacy values.
    'Inferred • Summary': null, 'Inferred • Paid Message Summary': null, 'Inferred • AI Search Summary': null,
    'Inferred • Overall Confidence': insight.overallConfidence, 'Workflow • Agent Harness': insight.agentHarness, 'Workflow • Model': insight.model, 'Workflow • Skill Version': insight.skillVersion, 'Workflow • Evidence Fingerprint': insight.evidenceFingerprint, 'Workflow • Version': insight.workflowVersion, 'Workflow • Run ID': insight.runId, 'Workflow • Generated At': insight.generatedAt};
}

export function toAirtableReviewFields(review: ReviewWireInput, companyAirtableRecordId: string): AirtableFields {
  const observedThemes = classifiedClaims(review.observedThemes, 'observed');
  const inferredClaims = classifiedClaims(review.inferredClaims, 'inferred');
  const recommendations = classifiedClaims(review.recommendations, 'inferred');
  return {'Identity • Company ID': review.companyId, 'Identity • Company Link': [companyAirtableRecordId], 'Observed • Themes JSON': observedThemes.json, 'Observed • Themes Claim Count': observedThemes.originalCount, 'Observed • Themes Claims Retained Count': observedThemes.retainedCount, 'Inferred • Claims JSON': inferredClaims.json, 'Inferred • Claims Claim Count': inferredClaims.originalCount, 'Inferred • Claims Retained Count': inferredClaims.retainedCount, 'Inferred • Recommendations JSON': recommendations.json, 'Inferred • Recommendations Claim Count': recommendations.originalCount, 'Inferred • Recommendations Claims Retained Count': recommendations.retainedCount, 'Inferred • Overall Confidence': review.overallConfidence, 'Inferred • Review Reasons JSON': boundedJson(review.reviewReasons, JSON_CAPS.reviewReasons), 'Workflow • Evidence Fingerprint': review.evidenceFingerprint, 'Workflow • Agent Harness': review.agentHarness, 'Workflow • Model': review.model, 'Workflow • Skill Version': review.skillVersion, 'Workflow • Version': review.workflowVersion, 'Workflow • Run ID': review.runId, 'Workflow • Generated At': review.generatedAt, 'Review • Status': review.status, 'Review • Notes': review.reviewerNotes, 'Review • Identity': review.reviewerIdentity, 'Review • At': review.reviewedAt};
}

export function toAirtableSystemFields(system: SystemWireInput): AirtableFields {
  return {'Identity • System ID': system.systemId, 'Workflow • Last Run Started At': system.lastRunStartedAt, 'Workflow • Last Run Finished At': system.lastRunFinishedAt, ...(system.lastSuccessfulRunAt === undefined ? {} : {'Workflow • Last Successful Run At': system.lastSuccessfulRunAt}), 'Workflow • Status': system.status, 'Workflow • Processed Companies': system.processedCompanies, 'Workflow • Succeeded Companies': system.succeededCompanies, 'Workflow • Failed Companies': system.failedCompanies, 'Workflow • Error Summary': system.errorSummary, 'Workflow • Cache Version': system.cacheVersion, 'Refresh • Workflow Version': system.refreshWorkflowVersion, 'Refresh • Run ID': system.refreshRunId, 'Agent • Last Run At': system.lastAgentRunAt, 'Agent • Skill Version': system.agentSkillVersion, 'Agent • Processed Companies': system.agentProcessedCompanies, 'Agent • Review Count': system.agentReviewCount, 'Agent • Error Summary': system.agentErrorSummary};
}
