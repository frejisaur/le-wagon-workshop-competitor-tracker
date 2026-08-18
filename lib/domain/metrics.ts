import type {CalculatedGroup, ObservedGroup} from './classification';
import type {ClassifiedCompany, CompanyIdentityResolution} from './company';

export type ProviderNumber = {raw: string | null; normalized: number | null};

export type CuratedCompetitor = {
  domain: string | null;
  commonKeywords: number | null;
  competitionLevel: number | null;
  organicKeywords: number | null;
  organicTraffic: number | null;
  organicTrafficCostUsd: number | null;
  paidKeywords: number | null;
  paidTraffic: number | null;
  paidTrafficCostUsd: number | null;
  serpFeatureKeywords: number | null;
  serpFeatureTraffic: number | null;
  totalTraffic: number | null;
  totalTrafficCostUsd: number | null;
};

export type CuratedAiCountry = {country: string | null; mentions: number | null; visibility: number | null};
export type CuratedAiLlm = {llm: string | null; llmCode: string | null; mentions: number | null; selfMentions: number | null; citedPages: number | null};
export type CuratedMozTopPage = {url: string; normalizedUrl: string; pageAuthority: number | null};
export type CuratedMozTopPageSummary = {url: string; pageAuthority: number | null};

export type LandingPagePortfolio = {
  normalizedLandingUrl: string;
  keywordCount: number;
  estimatedTraffic: number | null;
  keywords: string[];
};

export type CompactOrganicTrendPoint = {date: string; organicTraffic: number | null};

export type CuratedCompanyObserved = {
  domain: string;
  database: string;
  authorityScore: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  followBacklinks: number | null;
  noFollowBacklinks: number | null;
  organicTraffic: number | null;
  totalTraffic: number | null;
  organicKeywords: number | null;
  organicTrafficCostUsd: number | null;
  paidTraffic: number | null;
  paidKeywords: number | null;
  paidTrafficCostUsd: number | null;
  aiVisibility: number | null;
  aiVisibilityBenchmark: number | null;
  aiMentions: number | null;
  aiCitedPages: number | null;
  topCountry: string | null;
  topCountryTraffic: number | null;
  mozDomainAuthority: ProviderNumber;
  mozSpamScore: ProviderNumber;
  organicCompetitors: CuratedCompetitor[];
  paidCompetitors: CuratedCompetitor[];
  aiCountries: CuratedAiCountry[];
  aiCountriesObservedCount: number;
  aiByLlm: CuratedAiLlm[];
  rawSerpCodes: Array<string | number>;
  mozTopPages: CuratedMozTopPage[];
  mozTopPagesObserved: CuratedMozTopPageSummary[];
  mozTopPagesObservedCount: number;
  topKeywordSampleCount: number;
};

export type CuratedCompanyCalculated = {
  organicTraffic30DayMovement: number | null;
  organicTraffic12MonthMovement: number | null;
  nonBrandShare: number | null;
  aiBenchmarkGap: number | null;
  trackedSetTrafficShare: number | null;
  compactOrganicTrend: CompactOrganicTrendPoint[];
  landingPagePortfolio: LandingPagePortfolio[];
  paidActivityPresent: boolean;
};

export type CuratedKeyword = ObservedGroup<{
  keywordId: string;
  companyId: string | undefined;
  keyword: string;
  normalizedLandingUrl: string;
  landingUrl: string;
  position: number | null;
  previousPosition: number | null;
  positionDifference: number | null;
  volume: number | null;
  cpcUsd: number | null;
  keywordDifficulty: number | null;
  competition: number | null;
  traffic: number | null;
  trafficSharePct: number | null;
  trafficCostUsd: number | null;
  intents: string[];
  rawSerpCodes: Array<string | number>;
  results: number | null;
}>;

export type CuratedPaidAd = ObservedGroup<{
  paidAdId: string;
  companyId: string | undefined;
  keyword: string | null;
  title: string | null;
  description: string | null;
  visibleUrl: string | null;
  landingUrl: string;
  normalizedLandingUrl: string;
  position: number | null;
  previousPosition: number | null;
  volume: number | null;
  cpcUsd: number | null;
  keywordDifficulty: number | null;
  competition: number | null;
  traffic: number | null;
  trafficSharePct: number | null;
  trafficCostUsd: number | null;
}>;

export type DataQualityIssue = {
  code: 'suspicious_moz_top_page' | 'invalid_keyword_landing_url' | 'invalid_paid_ad_landing_url';
  message: string;
  sourcePath: string;
  summary: string;
};

export type CuratedCompanyEvidence = {
  company: ClassifiedCompany<CuratedCompanyObserved, CuratedCompanyCalculated> & {calculated: CuratedCompanyCalculatedGroup};
  keywords: CuratedKeyword[];
  paidAds: CuratedPaidAd[];
  qualityIssues: DataQualityIssue[];
};

export type CuratedCompanyObservedGroup = ObservedGroup<CuratedCompanyObserved>;
export type CuratedCompanyCalculatedGroup = CalculatedGroup<CuratedCompanyCalculated>;
export type CuratedCompanyIdentity = CompanyIdentityResolution;
