import {createHash} from 'node:crypto';
import type {
  CompactOrganicTrendPoint,
  CuratedAiCountry,
  CuratedCompanyEvidence,
  CuratedCompetitor,
  CuratedKeyword,
  CuratedPaidAd,
  CuratedMozTopPage,
  DataQualityIssue,
} from '@/lib/domain/metrics';
import type {CompanyIdentityResolution} from '@/lib/domain/company';
import type {SemrushDomainOverview} from '@/lib/schemas/semrush';
import {buildLandingPagePortfolio, calculateBenchmarkGap, calculateMovement, calculateMovementMonths, calculateNonBrandShare, calculateTrackedSetShare, parseIsoCalendarDate} from './calculations';
import {normalizeDomain, normalizeUrl} from './normalize';
import {parseCompactNumber} from './parse-provider-number';

export type TransformSemrushContext = {
  companyId: string;
  identity: CompanyIdentityResolution;
  observedAt: string;
  calculatedAt: string;
  rawRef?: string;
  trackedSetTotalTraffic?: number | null;
};

function toCuratedOrganicCompetitor(value: NonNullable<SemrushDomainOverview['organic']>['competitors'][number]): CuratedCompetitor {
  return {
    domain: value.domain, commonKeywords: value.common_keywords, competitionLevel: value.competition_level,
    organicKeywords: value.organic_keywords, organicTraffic: value.organic_traffic, organicTrafficCostUsd: value.organic_traffic_cost_usd,
    paidKeywords: value.paid_keywords, paidTraffic: null, paidTrafficCostUsd: null, serpFeatureKeywords: value.serp_feature_keywords,
    serpFeatureTraffic: value.serp_feature_traffic, totalTraffic: value.total_traffic, totalTrafficCostUsd: value.total_traffic_cost_usd,
  };
}

function toCuratedPaidCompetitor(value: NonNullable<SemrushDomainOverview['paid']>['competitors'][number]): CuratedCompetitor {
  return {
    domain: value.domain, commonKeywords: value.common_keywords, competitionLevel: value.competition_level,
    organicKeywords: value.organic_keywords, organicTraffic: null, organicTrafficCostUsd: null, paidKeywords: value.paid_keywords,
    paidTraffic: value.ad_traffic, paidTrafficCostUsd: value.ad_traffic_cost_usd, serpFeatureKeywords: null,
    serpFeatureTraffic: null, totalTraffic: null, totalTrafficCostUsd: null,
  };
}

function isSelfCompetitor(domain: string | null, canonicalDomain: string): boolean {
  return domain !== null && normalizeDomain(domain) === canonicalDomain;
}

type ProviderTrendPoint = NonNullable<SemrushDomainOverview['organic']>['trend_global_monthly'][number];
type ValidTrendPoint = ProviderTrendPoint & {timestamp: number};

function addInvalidTrendIssue(issues: DataQualityIssue[], sourcePath: string): void {
  if (issues.filter((issue) => issue.code === 'invalid_trend_date').length >= 10) return;
  issues.push({code: 'invalid_trend_date', message: 'Trend point omitted because its date is not an ISO calendar date', sourcePath, summary: 'invalid ISO calendar date omitted'});
}

function validatedTrendPoints(points: ProviderTrendPoint[], sourcePath: string, issues: DataQualityIssue[]): ValidTrendPoint[] {
  return points.flatMap((point, index) => {
    const parsedDate = parseIsoCalendarDate(point.date);
    if (!parsedDate) {
      addInvalidTrendIssue(issues, `${sourcePath}[${index}].date`);
      return [];
    }
    return [{...point, date: parsedDate.isoDate, timestamp: parsedDate.timestamp}];
  });
}

function compactTrend(points: ValidTrendPoint[]): CompactOrganicTrendPoint[] {
  return [...points]
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-24)
    .map((point) => ({
      date: point.date,
      organicTraffic: point.organic_traffic,
      organicKeywords: point.organic_keywords,
      organicTrafficCostUsd: point.organic_traffic_cost_usd,
      brandedTraffic: point.branded_traffic,
      nonBrandTraffic: point.non_branded_traffic,
      paidTraffic: point.paid_traffic,
      paidKeywords: point.paid_keywords,
      paidTrafficCostUsd: point.paid_traffic_cost_usd,
      serpFeatureTraffic: point.serp_feature_traffic,
    }));
}

function requiresHttpLandingUrl(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;
  return normalizeUrl(value);
}

function observedMetadata(context: TransformSemrushContext, database: string) {
  return {classification: 'observed' as const, source: 'semrush' as const, observedAt: context.observedAt, database, rawRef: context.rawRef};
}

function calculatedMetadata(context: TransformSemrushContext, inputs: string[]) {
  return {classification: 'calculated' as const, inputs, calculatedAt: context.calculatedAt};
}

function positiveFinite(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function keywordProjection(record: SemrushDomainOverview, context: TransformSemrushContext, issues: DataQualityIssue[]): CuratedKeyword[] {
  const result: CuratedKeyword[] = [];
  const identities = new Set<string>();
  for (const [index, keyword] of (record.organic?.top_keywords ?? []).entries()) {
    if (!keyword.keyword || !keyword.url) continue;
    const normalizedLandingUrl = normalizeUrl(keyword.url);
    if (!normalizedLandingUrl) {
      issues.push({code: 'invalid_keyword_landing_url', message: 'Keyword landing URL is not a public http/https URL', sourcePath: `organic.top_keywords[${index}].url`, summary: keyword.url});
      continue;
    }
    const keywordId = `${context.companyId}\u0000${keyword.keyword}\u0000${normalizedLandingUrl}`;
    if (identities.has(keywordId)) {
      issues.push({code: 'duplicate_keyword_identity', message: 'Repeated keyword identity omitted after the first provider-ranked observation', sourcePath: `organic.top_keywords[${index}]`, summary: 'repeated company, keyword, and normalized landing URL'});
      continue;
    }
    identities.add(keywordId);
    result.push({
      observed: {
        keyword: keyword.keyword, landingUrl: keyword.url, position: keyword.position, previousPosition: keyword.previous_position,
        positionDifference: keyword.position_difference, volume: keyword.volume, cpcUsd: keyword.cpc_usd,
        keywordDifficulty: keyword.keyword_difficulty, competition: keyword.competition, traffic: keyword.traffic,
        trafficSharePct: keyword.traffic_share_pct, trafficCostUsd: keyword.traffic_cost_usd, intents: keyword.intents,
        rawSerpCodes: keyword.serp_features_codes, results: keyword.results, ...observedMetadata(context, record.database),
      },
      calculated: {
        companyId: context.companyId, keywordId,
        normalizedLandingUrl, ...calculatedMetadata(context, ['companyId', `semrush.organic.top_keywords[${index}]`]),
      },
    });
  }
  return result;
}

function paidAdProjection(record: SemrushDomainOverview, context: TransformSemrushContext, issues: DataQualityIssue[]): CuratedPaidAd[] {
  return (record.paid?.top_ads ?? []).flatMap((ad, index) => {
    if (!ad.url) return [];
    const normalizedLandingUrl = normalizeUrl(ad.url);
    if (!normalizedLandingUrl) {
      issues.push({code: 'invalid_paid_ad_landing_url', message: 'Paid ad landing URL is not a public http/https URL', sourcePath: `paid.top_ads[${index}].url`, summary: ad.url});
      return [];
    }
    const identityInput = [context.companyId, ad.keyword ?? '', ad.title ?? '', ad.description ?? '', normalizedLandingUrl].join('\u0000');
    return [{
      observed: {
        keyword: ad.keyword, title: ad.title, description: ad.description, visibleUrl: ad.visible_url, landingUrl: ad.url,
        position: ad.position, previousPosition: ad.previous_position, volume: ad.volume, cpcUsd: ad.cpc_usd,
        keywordDifficulty: ad.keyword_difficulty, competition: ad.competition, traffic: ad.traffic,
        trafficSharePct: ad.traffic_share_pct, trafficCostUsd: ad.traffic_cost_usd, ...observedMetadata(context, record.database),
      },
      calculated: {
        companyId: context.companyId, paidAdId: createHash('sha256').update(identityInput).digest('hex'), normalizedLandingUrl,
        ...calculatedMetadata(context, ['companyId', `semrush.paid.top_ads[${index}]`]),
      },
    }];
  });
}

/** Converts an already validated Semrush observation into compact observed and calculated domain evidence. */
export function transformSemrushCompany(record: SemrushDomainOverview, context: TransformSemrushContext): CuratedCompanyEvidence {
  if (!context.companyId?.trim()) throw new TypeError('companyId is required to create child identities');
  const issues: DataQualityIssue[] = [];
  const canonicalDomain = context.identity.canonicalDomain;
  const organic = record.organic;
  const paid = record.paid;
  const dailyTrend = validatedTrendPoints(organic?.trend_global_daily ?? [], 'organic.trend_global_daily', issues);
  const monthlyTrend = validatedTrendPoints(organic?.trend_global_monthly ?? [], 'organic.trend_global_monthly', issues);
  const keywords = keywordProjection(record, context, issues);
  const paidAds = paidAdProjection(record, context, issues);
  const mozTopPagesObserved = (record.moz?.top_pages ?? []).map((page) => ({url: page.url, pageAuthority: page.page_authority}));
  const mozTopPages: CuratedMozTopPage[] = [];
  for (const [index, page] of (record.moz?.top_pages ?? []).entries()) {
    const normalizedUrl = requiresHttpLandingUrl(page.url);
    if (normalizedUrl) mozTopPages.push({url: page.url, normalizedUrl, pageAuthority: page.page_authority});
    else issues.push({code: 'suspicious_moz_top_page', message: 'Moz top-page value is not a displayable http/https landing URL', sourcePath: `moz.top_pages[${index}].url`, summary: page.url});
  }
  const aiCountriesObserved = record.ai_search?.by_country ?? [];
  const aiCountries: CuratedAiCountry[] = aiCountriesObserved.map((country) => ({country: country.country, mentions: country.mentions, visibility: country.visibility}));
  const latestDaily = [...dailyTrend].sort((left, right) => left.timestamp - right.timestamp).at(-1);
  const rawSerpCodes = (organic?.top_keywords ?? []).flatMap((keyword) => keyword.serp_features_codes);
  const observed = {
    domain: record.domain, authorityScore: record.authority_score, backlinks: record.backlinks,
    referringDomains: record.referring_domains, followBacklinks: record.follow_backlinks, noFollowBacklinks: record.nofollow_backlinks,
    organicTraffic: record.organic_traffic, totalTraffic: record.total_traffic, organicKeywords: record.organic_keywords,
    organicTrafficCostUsd: record.organic_traffic_cost_usd, paidTraffic: record.paid_traffic, paidKeywords: record.paid_keywords,
    paidTrafficCostUsd: record.paid_traffic_cost_usd, aiVisibility: record.ai_visibility, aiVisibilityBenchmark: record.ai_visibility_benchmark,
    aiMentions: record.ai_mentions, aiCitedPages: record.ai_cited_pages, topCountry: record.top_country, topCountryTraffic: record.top_country_traffic,
    mozDomainAuthorityRaw: record.moz_domain_authority, mozSpamScoreRaw: record.moz_spam_score,
    organicCompetitors: (organic?.competitors ?? []).map(toCuratedOrganicCompetitor),
    paidCompetitors: (paid?.competitors ?? []).map(toCuratedPaidCompetitor), aiCountries,
    aiByLlm: (record.ai_search?.by_llm ?? []).map((llm) => ({llm: llm.llm, llmCode: llm.llm_code, mentions: llm.mentions, selfMentions: llm.self_mentions, citedPages: llm.cited_pages})),
    aiTopCitedSources: (record.ai_search?.top_cited_sources ?? []).map((source) => ({domain: source.domain, mentions: source.mentions})),
    rawSerpCodes, mozTopPagesObserved, ...observedMetadata(context, record.database),
  };
  const calculated = {
    organicTraffic30DayMovement: calculateMovement(dailyTrend.map((point) => ({date: point.date, value: point.organic_traffic})), 30),
    organicTraffic12MonthMovement: calculateMovementMonths(monthlyTrend.map((point) => ({date: point.date, value: point.organic_traffic})), 12),
    nonBrandShare: calculateNonBrandShare(latestDaily?.branded_traffic, latestDaily?.non_branded_traffic),
    aiBenchmarkGap: calculateBenchmarkGap(record.ai_visibility, record.ai_visibility_benchmark),
    trackedSetTrafficShare: calculateTrackedSetShare(record.total_traffic, context.trackedSetTotalTraffic),
    organicCompetitors: (organic?.competitors ?? []).filter((competitor) => !isSelfCompetitor(competitor.domain, canonicalDomain)).map(toCuratedOrganicCompetitor),
    paidCompetitors: (paid?.competitors ?? []).filter((competitor) => !isSelfCompetitor(competitor.domain, canonicalDomain)).map(toCuratedPaidCompetitor),
    aiCountries: aiCountries.filter((country) => country.mentions !== 0 || country.visibility !== 0), aiCountriesObservedCount: aiCountries.length,
    mozDomainAuthority: parseCompactNumber(record.moz_domain_authority), mozSpamScore: parseCompactNumber(record.moz_spam_score),
    mozTopPages, mozTopPagesObservedCount: mozTopPagesObserved.length, topKeywordSampleCount: organic?.top_keywords.length ?? 0,
    compactOrganicTrend: compactTrend(monthlyTrend),
    landingPagePortfolio: buildLandingPagePortfolio(keywords.map((keyword) => ({keyword: keyword.observed.keyword, url: keyword.observed.landingUrl, traffic: keyword.observed.traffic}))),
    paidActivityPresent: positiveFinite(record.paid_traffic) || positiveFinite(record.paid_keywords) || positiveFinite(record.paid_traffic_cost_usd) || paidAds.length > 0
      ? true
      : !paid || paid.top_ads.length > 0 || record.paid_traffic !== 0 || record.paid_keywords !== 0 || record.paid_traffic_cost_usd !== 0
        ? null
        : false,
    ...calculatedMetadata(context, ['semrush.organic.trend_global_daily', 'semrush.organic.trend_global_monthly', 'semrush.ai_visibility', 'semrush.ai_visibility_benchmark', 'transform-context.trackedSetTotalTraffic']),
  };
  return {company: {companyId: context.companyId, identity: context.identity, observed, calculated}, keywords, paidAds, qualityIssues: issues};
}
