import {randomUUID} from 'node:crypto';
import {estimateRecordBudget, type RecordBudgetCounts} from '@/lib/airtable/record-budget';
import type {CompanyPersistenceWrite, CompanyWrite, CompetitorStore, DashboardSnapshot, RecordResult, UnenrichedCompanyWrite} from '@/lib/airtable/types';
import type {ApolloRow} from '@/lib/schemas/apollo';
import type {SemrushDomainOverview} from '@/lib/schemas/semrush';
import {joinRoster, type JoinedRosterCompany} from '@/lib/transforms/join-roster';
import {transformSemrushCompany} from '@/lib/transforms/semrush-to-domain';

export type ImportCompanyError = {
  canonicalDomain: string;
  companyId?: string;
  stage: 'identity' | 'company' | 'keywords' | 'paid_ads' | 'enrichment';
  message: string;
};

export type ImportRecordBudget = {
  current: RecordBudgetCounts;
  projected: RecordBudgetCounts;
  total: number;
  withinFreeLimit: boolean;
  estimatedWriteCalls: number;
  estimatedApiCalls: number;
  failure?: 'record_budget_exceeded';
};

export type ImportReport = {
  runId: string;
  accepted: number;
  unenriched: number;
  rejected: number;
  apifyOnly: number;
  succeeded: number;
  failed: number;
  recordBudget: ImportRecordBudget;
  errors: ImportCompanyError[];
};

export type InitialImportOptions = {
  /** Provider-boundary validated rows only; raw provider payloads are never accepted here. */
  apolloRows: ApolloRow[];
  /** Provider-boundary validated records only; raw provider payloads are never accepted here. */
  semrushRecords: SemrushDomainOverview[];
  /** Required unless dryRun is true. */
  repository?: CompetitorStore;
  dryRun?: boolean;
  idFactory?: (canonicalDomain: string) => string;
  runIdFactory?: () => string;
  observedAt?: string;
  calculatedAt?: string;
  rawRef?: string;
  /** Test-only override for a safe preflight without repository reads. */
  recordBudgetCounts?: RecordBudgetCounts;
};

type PreparedCompany = {
  joined: JoinedRosterCompany;
  companyId: string;
  write: CompanyPersistenceWrite;
  keywords: ReturnType<typeof transformSemrushCompany>['keywords'];
  paidAds: ReturnType<typeof transformSemrushCompany>['paidAds'];
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  return `initial-import-${Date.now()}`;
}

function emptyCounts(): RecordBudgetCounts {
  return {companies: 0, keywords: 0, paidAds: 0, insights: 0, reviews: 0, system: 0};
}

function snapshotCounts(snapshot: DashboardSnapshot): RecordBudgetCounts {
  return {
    companies: snapshot.companies.length,
    keywords: snapshot.keywords.length,
    paidAds: snapshot.paidAds.length,
    insights: snapshot.publishedInsights.length,
    reviews: snapshot.reviews.length,
    system: snapshot.system.length,
  };
}

function isPresentTraffic(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function selectedSemrushRecord(joined: JoinedRosterCompany): SemrushDomainOverview | undefined {
  return joined.semrush.records.length === 1 ? joined.semrush.records[0] : undefined;
}

function apolloWriteFields(joined: JoinedRosterCompany): Pick<CompanyWrite, 'identity' | 'displayName' | 'segment' | 'apolloWebsite' | 'apolloAccountStage' | 'apolloLists' | 'apolloEmployees' | 'apolloIndustry' | 'apolloCompanyCountry'> {
  const row = joined.apollo;
  return {
    identity: joined.identity,
    displayName: row['Company Name'],
    apolloWebsite: row.Website,
    apolloAccountStage: row['Account Stage'],
    apolloLists: row.Lists,
    apolloEmployees: row['# Employees'],
    apolloIndustry: row.Industry,
    apolloCompanyCountry: row['Company Country'],
  };
}

function toUnenrichedWrite(joined: JoinedRosterCompany, companyId: string): UnenrichedCompanyWrite {
  return {
    companyId,
    ...apolloWriteFields(joined),
    qualityIssues: [],
  };
}

function recordError(errors: ImportCompanyError[], joined: JoinedRosterCompany, stage: ImportCompanyError['stage'], message: string, companyId?: string): void {
  errors.push({canonicalDomain: joined.canonicalDomain, companyId, stage, message});
}

function resultError(result: RecordResult | undefined, fallback: string): string {
  return result?.error ?? fallback;
}

function projectCounts(current: RecordBudgetCounts, snapshot: DashboardSnapshot | undefined, prepared: PreparedCompany[]): RecordBudgetCounts {
  const existingCompanyIds = new Set(snapshot?.companies.map((company) => company.fields['Identity • Company ID']).filter((id): id is string => typeof id === 'string') ?? []);
  const replacedCompanyIds = new Set(prepared.filter((company) => company.write.observed).map((company) => company.companyId));
  const existingKeywordsByCompany = new Map<string, number>();
  for (const keyword of snapshot?.keywords ?? []) {
    const companyId = keyword.fields['Identity • Company ID'];
    if (typeof companyId === 'string') existingKeywordsByCompany.set(companyId, (existingKeywordsByCompany.get(companyId) ?? 0) + 1);
  }
  const existingPaidAdIds = new Set((snapshot?.paidAds ?? []).map((ad) => ad.fields['Identity • Paid Ad ID']).filter((id): id is string => typeof id === 'string'));
  const keywordsRemoved = [...replacedCompanyIds].reduce((sum, companyId) => sum + (existingKeywordsByCompany.get(companyId) ?? 0), 0);
  const keywordsAdded = prepared.reduce((sum, company) => sum + company.keywords.length, 0);
  const paidAdsAdded = prepared.flatMap((company) => company.paidAds).filter((ad) => !existingPaidAdIds.has(ad.calculated.paidAdId)).length;

  return {
    ...current,
    companies: current.companies + prepared.filter((company) => !existingCompanyIds.has(company.companyId)).length,
    keywords: current.keywords - keywordsRemoved + keywordsAdded,
    paidAds: current.paidAds + paidAdsAdded,
  };
}

function batches(count: number): number {
  return Math.ceil(count / 10);
}

function estimatedApiCalls(prepared: PreparedCompany[], accepted: number, dryRun: boolean): number {
  if (dryRun) return 0;
  const enriched = prepared.filter((company) => company.write.observed);
  const paidAds = enriched.flatMap((company) => company.paidAds);
  // Snapshot (six tables), identity lookups (at most two each), company lookup
  // and write batches, then dependent keyword/ad lookup and write batches.
  return 6 + accepted * 2 + prepared.length * 2 + batches(prepared.length)
    + enriched.length * 2 + enriched.reduce((sum, company) => sum + batches(company.keywords.length), 0)
    + (paidAds.length > 0 ? enriched.filter((company) => company.paidAds.length > 0).length + paidAds.length + batches(paidAds.length) : 0);
}

/**
 * Imports already-validated provider data. Identity lookup always precedes ID
 * assignment; persistence proceeds company, keyword, then paid-ad per company.
 */
export async function runInitialImport(options: InitialImportOptions): Promise<ImportReport> {
  const dryRun = options.dryRun === true;
  if (!dryRun && !options.repository) throw new TypeError('repository is required unless dryRun is true');
  const runId = options.runIdFactory?.() ?? defaultRunId();
  const observedAt = options.observedAt ?? nowIso();
  const calculatedAt = options.calculatedAt ?? observedAt;
  const join = joinRoster(options.apolloRows, options.semrushRecords, {observedAt, rawRef: options.rawRef});
  const errors: ImportCompanyError[] = [];
  const repository = options.repository;
  const snapshot = dryRun ? undefined : await repository!.getDashboardSnapshot();
  const current = options.recordBudgetCounts ?? (snapshot ? snapshotCounts(snapshot) : emptyCounts());
  const identities = new Map<string, string>();

  for (const joined of join.accepted) {
    if (dryRun) {
      identities.set(joined.canonicalDomain, `dry-run-${joined.canonicalDomain}`);
      continue;
    }
    try {
      const existing = await repository!.resolveCompanyIdentity(joined.identity);
      if (existing) identities.set(joined.canonicalDomain, existing.companyId);
      else {
        const companyId = (options.idFactory ?? (() => randomUUID()))(joined.canonicalDomain);
        if (!companyId.trim()) throw new TypeError('idFactory must return a non-empty company ID');
        identities.set(joined.canonicalDomain, companyId);
      }
    } catch {
      recordError(errors, joined, 'identity', 'company_identity_resolution_failed');
    }
  }

  const recordsWithTraffic = join.accepted
    .map(selectedSemrushRecord)
    .filter((record): record is SemrushDomainOverview => record !== undefined)
    .map((record) => record.total_traffic)
    .filter(isPresentTraffic);
  const trackedSetTotalTraffic = recordsWithTraffic.reduce((sum, traffic) => sum + traffic, 0);
  const prepared: PreparedCompany[] = [];
  for (const joined of join.accepted) {
    const companyId = identities.get(joined.canonicalDomain);
    if (!companyId) continue;
    const semrush = selectedSemrushRecord(joined);
    if (!semrush) {
      if (joined.semrush.records.length === 0) prepared.push({joined, companyId, write: toUnenrichedWrite(joined, companyId), keywords: [], paidAds: []});
      else recordError(errors, joined, 'enrichment', 'multiple_current_semrush_observations_requires_selection', companyId);
      continue;
    }
    try {
      const transformed = transformSemrushCompany(semrush, {
        companyId,
        identity: joined.identity,
        observedAt,
        calculatedAt,
        rawRef: options.rawRef,
        trackedSetTotalTraffic,
      });
      prepared.push({
        joined,
        companyId,
        write: {
          companyId,
          ...apolloWriteFields(joined),
          apifyDomain: semrush.domain,
          observed: transformed.company.observed,
          calculated: transformed.company.calculated,
          qualityIssues: transformed.qualityIssues,
        },
        keywords: transformed.keywords,
        paidAds: transformed.paidAds,
      });
    } catch {
      recordError(errors, joined, 'enrichment', 'semrush_transform_failed', companyId);
    }
  }

  const projected = projectCounts(current, snapshot, prepared);
  const estimate = estimateRecordBudget(projected);
  const estimatedWriteCalls = prepared.length + prepared.filter((company) => company.write.observed).length + prepared.filter((company) => company.paidAds.length > 0).length;
  const apiCalls = estimatedApiCalls(prepared, join.accepted.length, dryRun);
  const recordBudget: ImportRecordBudget = {
    ...estimate,
    current,
    projected,
    estimatedWriteCalls,
    estimatedApiCalls: apiCalls,
    ...(!estimate.withinFreeLimit ? {failure: 'record_budget_exceeded' as const} : {}),
  };
  const baseReport = {
    runId,
    accepted: join.accepted.length,
    unenriched: join.unmatchedApollo.length,
    rejected: join.rejections.filter((rejection) => rejection.provider === 'apollo').length,
    apifyOnly: join.apifyOnly.length,
    recordBudget,
    errors,
  };

  if (dryRun || !estimate.withinFreeLimit) {
    return {...baseReport, succeeded: 0, failed: errors.length};
  }

  const companyWrites = await repository!.upsertCompanies(prepared.map((company) => company.write));
  const companyResultById = new Map(companyWrites.results.map((result) => [result.identity, result]));
  let succeeded = 0;
  let failed = errors.length;

  for (const company of prepared) {
    const companyResult = companyResultById.get(company.companyId);
    if (!companyResult || companyResult.error) {
      recordError(errors, company.joined, 'company', resultError(companyResult, 'company_write_not_confirmed'), company.companyId);
      failed += 1;
      continue;
    }
    if (!company.write.observed) {
      succeeded += 1;
      continue;
    }
    const keywordResult = await repository!.replaceKeywords(company.companyId, company.keywords);
    if (keywordResult.failed > 0) {
      recordError(errors, company.joined, 'keywords', resultError(keywordResult.results.find((result) => result.error), 'keyword_write_failed'), company.companyId);
      failed += 1;
      continue;
    }
    if (company.paidAds.length > 0) {
      const paidAdResult = await repository!.upsertPaidAds(company.paidAds);
      if (paidAdResult.failed > 0) {
        recordError(errors, company.joined, 'paid_ads', resultError(paidAdResult.results.find((result) => result.error), 'paid_ad_write_failed'), company.companyId);
        failed += 1;
        continue;
      }
    }
    succeeded += 1;
  }
  return {...baseReport, succeeded, failed};
}
