import type {CompanyIdentityResolution} from '@/lib/domain/company';
import type {CuratedCompanyCalculated, CuratedCompanyObserved, CuratedKeyword, CuratedPaidAd, DataQualityIssue} from '@/lib/domain/metrics';
import type {CalculatedGroup, ObservedGroup} from '@/lib/domain/classification';

export const AIRTABLE_TABLES = {
  companies: 'Companies',
  keywords: 'Keywords',
  paidAds: 'Paid Ads',
  insights: 'GTM Insights',
  reviews: 'Insight Reviews',
  system: 'System',
} as const;

export type AirtableTable = (typeof AIRTABLE_TABLES)[keyof typeof AIRTABLE_TABLES];
export type AirtableFieldValue = string | number | boolean | null | string[];
export type AirtableFields = Record<string, AirtableFieldValue | undefined>;
export type AirtableRecord = {id: string; fields: AirtableFields; createdTime?: string};
export type AirtableWriteRecord = {id?: string; fields: AirtableFields};
export type AirtableListResponse = {records: AirtableRecord[]; offset?: string};
export type AirtableWriteResponse = {records: AirtableRecord[]};

export type CompanyWrite = {
  companyId: string;
  identity: CompanyIdentityResolution;
  displayName?: string;
  segment?: string;
  apolloWebsite?: string;
  apifyDomain?: string;
  observed: ObservedGroup<CuratedCompanyObserved>;
  calculated: CalculatedGroup<CuratedCompanyCalculated>;
  qualityIssues: DataQualityIssue[];
  evidenceFingerprint?: string;
  lastSuccessfulRefreshAt?: string;
  nextInsightDueAt?: string;
};

export type InsightWireInput = {
  insightId: string;
  companyId: string;
  observedThemes: string[];
  searchStrengths: string[];
  vulnerabilities: string[];
  paidMessageSummary?: string | null;
  aiSearchSummary?: string | null;
  recommendedResponse: string[];
  evidenceRefs: string[];
  confidence: 'high' | 'medium' | 'low';
  agentHarness: string;
  model: string;
  skillVersion: string;
  evidenceFingerprint: string;
  workflowVersion: string;
  runId: string;
  generatedAt: string;
};

export type ReviewStatus = 'needs_review' | 'approved' | 'rejected' | 'stale' | 'published';
export type ReviewWireInput = {
  companyId: string;
  candidateThemes: string[];
  summary: string;
  recommendations: string[];
  evidenceRefs: string[];
  confidence: 'high' | 'medium' | 'low';
  reviewReasons: string[];
  evidenceFingerprint: string;
  agentHarness: string;
  model: string;
  skillVersion: string;
  workflowVersion: string;
  runId: string;
  generatedAt: string;
  status: ReviewStatus;
  reviewerNotes?: string | null;
  reviewerIdentity?: string | null;
  reviewedAt?: string | null;
};

export type SystemWireInput = {
  systemId: string;
  lastRunStartedAt?: string | null;
  lastRunFinishedAt?: string | null;
  lastSuccessfulRunAt?: string | null;
  status: 'running' | 'partial' | 'succeeded' | 'failed';
  processedCompanies: number;
  succeededCompanies: number;
  failedCompanies: number;
  errorSummary?: string | null;
  cacheVersion?: string | null;
  railwayWorkflowVersion?: string | null;
  railwayRunId?: string | null;
  lastAgentRunAt?: string | null;
  agentSkillVersion?: string | null;
  agentProcessedCompanies?: number | null;
  agentReviewCount?: number | null;
  agentErrorSummary?: string | null;
};

export type RecordResult = {identity: string; recordId?: string; error?: string};
export type WriteResult = {succeeded: number; failed: number; results: RecordResult[]};

export type DashboardSnapshot = {
  companies: AirtableRecord[];
  keywords: AirtableRecord[];
  paidAds: AirtableRecord[];
  publishedInsights: AirtableRecord[];
};
export type DueInsightInput = {company: AirtableRecord; publishedInsight?: AirtableRecord; review?: AirtableRecord};

export interface CompetitorStore {
  resolveCompanyIdentity(identity: Pick<CompanyIdentityResolution, 'apolloAccountId' | 'canonicalDomain'>): Promise<{companyId: string; source: 'apollo_account_id' | 'canonical_domain'} | null>;
  upsertCompanies(companies: CompanyWrite[]): Promise<WriteResult>;
  replaceKeywords(companyId: string, keywords: CuratedKeyword[]): Promise<WriteResult>;
  upsertPaidAds(paidAds: CuratedPaidAd[]): Promise<WriteResult>;
  getDashboardSnapshot(): Promise<DashboardSnapshot>;
  getDueInsightInputs(): Promise<DueInsightInput[]>;
  upsertReview(review: ReviewWireInput): Promise<WriteResult>;
  upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult>;
  updateSystem(system: SystemWireInput): Promise<WriteResult>;
}
