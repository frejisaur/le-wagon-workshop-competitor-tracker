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

/** Table names are deployment configuration, not a hard-coded schema contract. */
export type AirtableTable = string;
export type AirtableTableMap = {[Key in keyof typeof AIRTABLE_TABLES]: AirtableTable};
export type AirtableFieldValue = string | number | boolean | null | string[];
export type AirtableFields = Record<string, AirtableFieldValue | undefined>;
export type AirtableRecord = {id: string; fields: AirtableFields; createdTime?: string};
export type AirtableWriteRecord = {id?: string; fields: AirtableFields};
export type AirtableListResponse = {records: AirtableRecord[]; offset?: string};
export type AirtableWriteResponse = {records: AirtableRecord[]};

export type CompanyWrite = {
  companyId: string;
  identity: CompanyIdentityResolution;
  /** All values below are observed Apollo roster values, never inferred labels. */
  displayName?: string;
  segment?: string;
  apolloWebsite?: string;
  apifyDomain?: string;
  apolloAccountStage?: string;
  apolloLists?: string;
  apolloEmployees?: string;
  apolloIndustry?: string;
  apolloCompanyCountry?: string;
  observed: ObservedGroup<CuratedCompanyObserved>;
  calculated: CalculatedGroup<CuratedCompanyCalculated>;
  qualityIssues: DataQualityIssue[];
  /** Null explicitly invalidates the previously published evidence fingerprint. */
  evidenceFingerprint?: string | null;
  lastSuccessfulRefreshAt?: string;
  nextInsightDueAt?: string;
  /** Explicit due timestamp for agent enrichment after observed evidence changes. */
  nextAgentEnrichmentDueAt?: string | null;
};

/** An accepted Apollo roster entry that has no validated Semrush observation. */
export type UnenrichedCompanyWrite = Omit<CompanyWrite, 'observed' | 'calculated'> & {
  observed?: never;
  calculated?: never;
};
export type CompanyPersistenceWrite = CompanyWrite | UnenrichedCompanyWrite;

/** A claim remains traceable to its evidence and never crosses observed/inferred layers. */
export type ClaimWire = {
  claimId: string;
  conclusion: string;
  classification: 'observed' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string;
  evidenceRefs: string[];
};

export type InsightWireInput = {
  insightId: string;
  companyId: string;
  observedThemes: ClaimWire[];
  inferredClaims: ClaimWire[];
  recommendations: ClaimWire[];
  overallConfidence?: 'high' | 'medium' | 'low';
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
  observedThemes: ClaimWire[];
  inferredClaims: ClaimWire[];
  recommendations: ClaimWire[];
  overallConfidence?: 'high' | 'medium' | 'low';
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
  reviews: AirtableRecord[];
  system: AirtableRecord[];
};
export type DueInsightInput = {company: AirtableRecord; publishedInsight?: AirtableRecord; review?: AirtableRecord};

export interface CompetitorStore {
  resolveCompanyIdentity(identity: Pick<CompanyIdentityResolution, 'apolloAccountId' | 'canonicalDomain'>): Promise<{companyId: string; source: 'apollo_account_id' | 'canonical_domain'} | null>;
  upsertCompanies(companies: CompanyPersistenceWrite[]): Promise<WriteResult>;
  replaceKeywords(companyId: string, keywords: CuratedKeyword[]): Promise<WriteResult>;
  /** Atomically-at-delete-boundary replaces one company's observed paid-ad snapshot. */
  replacePaidAds(companyId: string, ads: CuratedPaidAd[]): Promise<WriteResult>;
  upsertPaidAds(paidAds: CuratedPaidAd[]): Promise<WriteResult>;
  getDashboardSnapshot(): Promise<DashboardSnapshot>;
  getDueInsightInputs(): Promise<DueInsightInput[]>;
  upsertReview(review: ReviewWireInput): Promise<WriteResult>;
  upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult>;
  updateSystem(system: SystemWireInput): Promise<WriteResult>;
}
