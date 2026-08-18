import type {CuratedKeyword, CuratedPaidAd, DataQualityIssue} from '@/lib/domain/metrics';
import type {AirtableFields, CompanyWrite, InsightWireInput, ReviewWireInput, SystemWireInput} from './types';

const MAX_QUALITY_ISSUES = 25;
const MAX_SUMMARY_LENGTH = 300;

function boundedText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY_LENGTH);
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function issueSummary(issue: DataQualityIssue): {code: DataQualityIssue['code']; sourcePath: string; summary: string} {
  return {code: issue.code, sourcePath: boundedText(issue.sourcePath), summary: boundedText(issue.summary)};
}

/** Maps only validated curated evidence; raw provider records never cross this boundary. */
export function toAirtableCompanyFields(company: CompanyWrite): AirtableFields {
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
    'Observed • Source': observed.source,
    'Observed • At': observed.observedAt,
    'Observed • Database': observed.database,
    'Observed • Raw Ref': observed.rawRef,
    'Observed • Domain': observed.domain,
    'Observed • Authority Score': observed.authorityScore,
    'Observed • Backlinks': observed.backlinks,
    'Observed • Referring Domains': observed.referringDomains,
    'Observed • Follow Backlinks': observed.followBacklinks,
    'Observed • No-follow Backlinks': observed.noFollowBacklinks,
    'Observed • Organic Traffic': observed.organicTraffic,
    'Observed • Total Traffic': observed.totalTraffic,
    'Observed • Organic Keywords': observed.organicKeywords,
    'Observed • Organic Traffic Cost USD': observed.organicTrafficCostUsd,
    'Observed • Paid Traffic': observed.paidTraffic,
    'Observed • Paid Keywords': observed.paidKeywords,
    'Observed • Paid Traffic Cost USD': observed.paidTrafficCostUsd,
    'Observed • AI Visibility': observed.aiVisibility,
    'Observed • AI Visibility Benchmark': observed.aiVisibilityBenchmark,
    'Observed • AI Mentions': observed.aiMentions,
    'Observed • AI Cited Pages': observed.aiCitedPages,
    'Observed • Top Country': observed.topCountry,
    'Observed • Top Country Traffic': observed.topCountryTraffic,
    'Observed • Moz Domain Authority Raw': observed.mozDomainAuthorityRaw,
    'Observed • Moz Spam Score Raw': observed.mozSpamScoreRaw,
    'Observed • Organic Competitors JSON': json(observed.organicCompetitors),
    'Observed • Paid Competitors JSON': json(observed.paidCompetitors),
    'Observed • AI Countries JSON': json(observed.aiCountries),
    'Observed • AI by LLM JSON': json(observed.aiByLlm),
    'Observed • SERP Codes JSON': json(observed.rawSerpCodes),
    'Observed • Moz Top Pages JSON': json(observed.mozTopPagesObserved),
    'Calculated • At': calculated.calculatedAt,
    'Calculated • Inputs JSON': json(calculated.inputs),
    'Calculated • Organic Traffic 30d Movement': calculated.organicTraffic30DayMovement,
    'Calculated • Organic Traffic 12m Movement': calculated.organicTraffic12MonthMovement,
    'Calculated • Non-brand Share': calculated.nonBrandShare,
    'Calculated • AI Benchmark Gap': calculated.aiBenchmarkGap,
    'Calculated • Tracked Set Traffic Share': calculated.trackedSetTrafficShare,
    'Calculated • Organic Competitors JSON': json(calculated.organicCompetitors),
    'Calculated • Paid Competitors JSON': json(calculated.paidCompetitors),
    'Calculated • AI Countries JSON': json(calculated.aiCountries),
    'Calculated • AI Countries Observed Count': calculated.aiCountriesObservedCount,
    'Calculated • Moz Domain Authority': calculated.mozDomainAuthority.normalized,
    'Calculated • Moz Spam Score': calculated.mozSpamScore.normalized,
    'Calculated • Moz Top Pages JSON': json(calculated.mozTopPages),
    'Calculated • Moz Top Pages Observed Count': calculated.mozTopPagesObservedCount,
    'Calculated • Top Keyword Sample Count': calculated.topKeywordSampleCount,
    'Calculated • Compact Organic Trend JSON': json(calculated.compactOrganicTrend),
    'Calculated • Landing Page Portfolio JSON': json(calculated.landingPagePortfolio),
    'Calculated • Paid Activity Present': calculated.paidActivityPresent,
    'Quality • Issues JSON': json(company.qualityIssues.slice(0, MAX_QUALITY_ISSUES).map(issueSummary)),
    'Workflow • Evidence Fingerprint': company.evidenceFingerprint,
    'Workflow • Last Successful Refresh At': company.lastSuccessfulRefreshAt,
    'Workflow • Next Insight Due At': company.nextInsightDueAt,
  };
}

export function toAirtableKeywordFields(keyword: CuratedKeyword): AirtableFields {
  const {observed, calculated} = keyword;
  return {
    'Identity • Keyword ID': calculated.keywordId,
    'Identity • Company ID': calculated.companyId,
    'Observed • Source': observed.source, 'Observed • At': observed.observedAt, 'Observed • Database': observed.database,
    'Observed • Keyword': observed.keyword, 'Observed • Landing URL': observed.landingUrl, 'Observed • Position': observed.position,
    'Observed • Previous Position': observed.previousPosition, 'Observed • Position Difference': observed.positionDifference,
    'Observed • Volume': observed.volume, 'Observed • CPC USD': observed.cpcUsd, 'Observed • Keyword Difficulty': observed.keywordDifficulty,
    'Observed • Competition': observed.competition, 'Observed • Traffic': observed.traffic, 'Observed • Traffic Share Pct': observed.trafficSharePct,
    'Observed • Traffic Cost USD': observed.trafficCostUsd, 'Observed • Intents JSON': json(observed.intents),
    'Observed • SERP Codes JSON': json(observed.rawSerpCodes), 'Observed • Results': observed.results,
    'Calculated • Normalized Landing URL': calculated.normalizedLandingUrl, 'Calculated • At': calculated.calculatedAt,
  };
}

export function toAirtablePaidAdFields(ad: CuratedPaidAd): AirtableFields {
  const {observed, calculated} = ad;
  return {
    'Identity • Paid Ad ID': calculated.paidAdId, 'Identity • Company ID': calculated.companyId,
    'Observed • Source': observed.source, 'Observed • At': observed.observedAt, 'Observed • Database': observed.database,
    'Observed • Keyword': observed.keyword, 'Observed • Title': observed.title, 'Observed • Description': observed.description,
    'Observed • Visible URL': observed.visibleUrl, 'Observed • Landing URL': observed.landingUrl, 'Observed • Position': observed.position,
    'Observed • Previous Position': observed.previousPosition, 'Observed • Volume': observed.volume, 'Observed • CPC USD': observed.cpcUsd,
    'Observed • Keyword Difficulty': observed.keywordDifficulty, 'Observed • Competition': observed.competition,
    'Observed • Traffic': observed.traffic, 'Observed • Traffic Share Pct': observed.trafficSharePct, 'Observed • Traffic Cost USD': observed.trafficCostUsd,
    'Calculated • Normalized Landing URL': calculated.normalizedLandingUrl, 'Calculated • At': calculated.calculatedAt,
  };
}

export function toAirtableInsightFields(insight: InsightWireInput): AirtableFields {
  return {'Identity • Insight ID': insight.insightId, 'Identity • Company ID': insight.companyId, 'Inferred • Observed Themes JSON': json(insight.observedThemes), 'Inferred • Search Strengths JSON': json(insight.searchStrengths), 'Inferred • Vulnerabilities JSON': json(insight.vulnerabilities), 'Inferred • Paid Message Summary': insight.paidMessageSummary, 'Inferred • AI Search Summary': insight.aiSearchSummary, 'Inferred • Recommended Response JSON': json(insight.recommendedResponse), 'Inferred • Evidence Refs JSON': json(insight.evidenceRefs), 'Inferred • Confidence': insight.confidence, 'Workflow • Agent Harness': insight.agentHarness, 'Workflow • Model': insight.model, 'Workflow • Skill Version': insight.skillVersion, 'Workflow • Evidence Fingerprint': insight.evidenceFingerprint, 'Workflow • Version': insight.workflowVersion, 'Workflow • Run ID': insight.runId, 'Workflow • Generated At': insight.generatedAt};
}

export function toAirtableReviewFields(review: ReviewWireInput): AirtableFields {
  return {'Identity • Company ID': review.companyId, 'Inferred • Candidate Themes JSON': json(review.candidateThemes), 'Inferred • Summary': review.summary, 'Inferred • Recommendations JSON': json(review.recommendations), 'Inferred • Evidence Refs JSON': json(review.evidenceRefs), 'Inferred • Confidence': review.confidence, 'Inferred • Review Reasons JSON': json(review.reviewReasons), 'Workflow • Evidence Fingerprint': review.evidenceFingerprint, 'Workflow • Agent Harness': review.agentHarness, 'Workflow • Model': review.model, 'Workflow • Skill Version': review.skillVersion, 'Workflow • Version': review.workflowVersion, 'Workflow • Run ID': review.runId, 'Workflow • Generated At': review.generatedAt, 'Review • Status': review.status, 'Review • Notes': review.reviewerNotes, 'Review • Identity': review.reviewerIdentity, 'Review • At': review.reviewedAt};
}

export function toAirtableSystemFields(system: SystemWireInput): AirtableFields {
  return {'Identity • System ID': system.systemId, 'Workflow • Last Run Started At': system.lastRunStartedAt, 'Workflow • Last Run Finished At': system.lastRunFinishedAt, 'Workflow • Last Successful Run At': system.lastSuccessfulRunAt, 'Workflow • Status': system.status, 'Workflow • Processed Companies': system.processedCompanies, 'Workflow • Succeeded Companies': system.succeededCompanies, 'Workflow • Failed Companies': system.failedCompanies, 'Workflow • Error Summary': system.errorSummary, 'Workflow • Cache Version': system.cacheVersion, 'Railway • Workflow Version': system.railwayWorkflowVersion, 'Railway • Run ID': system.railwayRunId, 'Agent • Last Run At': system.lastAgentRunAt, 'Agent • Skill Version': system.agentSkillVersion, 'Agent • Processed Companies': system.agentProcessedCompanies, 'Agent • Review Count': system.agentReviewCount, 'Agent • Error Summary': system.agentErrorSummary};
}
