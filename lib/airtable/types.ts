import type {CompanyIdentityResolution} from '@/lib/domain/company';
import type {CuratedCompanyCalculated, CuratedCompanyObserved, CuratedKeyword, CuratedPaidAd, DataQualityIssue} from '@/lib/domain/metrics';
import type {CalculatedGroup, ObservedGroup} from '@/lib/domain/classification';
import type {CompanyRow, PublishedBattlecard, ReviewCandidate, ReviewStatus} from './company-row';

/** The serving base has exactly these two tables; their names are part of the schema contract. */
export const AIRTABLE_TABLES = {companies: 'Companies', system: 'System'} as const;

export type AirtableTable = (typeof AIRTABLE_TABLES)[keyof typeof AIRTABLE_TABLES];
export type AirtableFieldValue = string | number | boolean | null;
export type AirtableFields = Record<string, AirtableFieldValue | undefined>;
export type AirtableRecord = {id: string; fields: AirtableFields; createdTime?: string};
export type AirtableWriteRecord = {id?: string; fields: Record<string, AirtableFieldValue | {id: string}[] | undefined>};
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
  /** Complete keyword snapshot. Omitted when the organic module was not validated, which keeps the stored snapshot. */
  keywords?: CuratedKeyword[];
  /** Complete paid-ad snapshot. Omitted when the paid module was not validated, which keeps the stored snapshot. */
  paidAds?: CuratedPaidAd[];
};

/** An accepted Apollo roster entry that has no validated Semrush observation. */
export type UnenrichedCompanyWrite = Omit<CompanyWrite, 'observed' | 'calculated' | 'keywords' | 'paidAds'> & {
  observed?: never;
  calculated?: never;
  keywords?: never;
  paidAds?: never;
};
export type CompanyPersistenceWrite = CompanyWrite | UnenrichedCompanyWrite;

/** Replaces the one current published battlecard on the company row. */
export type InsightWireInput = PublishedBattlecard & {companyId: string};
/** Replaces the pending candidate on the company row. Omitted reviewer fields keep their Airtable values. */
export type ReviewWireInput = {
  companyId: string;
  status: ReviewStatus;
  candidate: ReviewCandidate;
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
  refreshWorkflowVersion?: string | null;
  refreshRunId?: string | null;
  lastAgentRunAt?: string | null;
  agentSkillVersion?: string | null;
  agentProcessedCompanies?: number | null;
  agentReviewCount?: number | null;
  agentErrorSummary?: string | null;
};

/** The parsed System row. Only the fields readers depend on are typed. */
export type SystemRecord = {recordId: string; systemId?: string; status?: SystemWireInput['status']; lastSuccessfulRunAt?: string};

export type RecordResult = {identity: string; recordId?: string; error?: string};
export type WriteResult = {succeeded: number; failed: number; results: RecordResult[]};

export type DashboardSnapshot = {companies: CompanyRow[]; system: SystemRecord | null};
/** Computes the evidence fingerprint of the row a write would produce. */
export type EvidenceFingerprinter = (row: CompanyRow) => string;

export interface CompetitorStore {
  resolveCompanyIdentity(identity: Pick<CompanyIdentityResolution, 'apolloAccountId' | 'canonicalDomain'>): Promise<{companyId: string; source: 'apollo_account_id' | 'canonical_domain'} | null>;
  /** Roster import: resolves or creates each company row; keyword and paid-ad snapshots ride on the same write. */
  upsertCompanies(companies: CompanyPersistenceWrite[]): Promise<WriteResult>;
  /**
   * Refresh: one PATCH to an existing company row carrying its metrics, keyword and paid-ad snapshots, merged
   * paid-ad first/last-observed history, and the fingerprint of the resulting row. It succeeds or leaves the row unchanged.
   */
  writeCompanyEvidence(company: CompanyWrite, fingerprint: EvidenceFingerprinter): Promise<WriteResult>;
  getDashboardSnapshot(): Promise<DashboardSnapshot>;
  upsertReview(review: ReviewWireInput): Promise<WriteResult>;
  upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult>;
  updateSystem(system: SystemWireInput): Promise<WriteResult>;
}
