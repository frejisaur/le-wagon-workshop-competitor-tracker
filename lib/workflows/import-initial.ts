import {datasetItemRef} from '@/lib/apify/constants';
import {randomUUID} from 'node:crypto';
import type {CompanyPersistenceWrite, CompanyWrite, CompetitorStore, RecordResult, UnenrichedCompanyWrite} from '@/lib/airtable/types';
import type {ApolloRow} from '@/lib/schemas/apollo';
import type {SemrushDomainOverview} from '@/lib/schemas/semrush';
import {joinRoster, type JoinedRosterCompany} from '@/lib/transforms/join-roster';
import {transformSemrushCompany} from '@/lib/transforms/semrush-to-domain';

export type ImportCompanyError = {
  canonicalDomain: string;
  companyId?: string;
  stage: 'validation' | 'identity' | 'company' | 'enrichment';
  message: string;
};

export type ImportReport = {
  runId: string;
  accepted: number;
  unenriched: number;
  rejected: number;
  apifyOnly: number;
  succeeded: number;
  failed: number;
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
  datasetId?: string;
};

type PreparedCompany = {
  joined: JoinedRosterCompany;
  companyId: string;
  write: CompanyPersistenceWrite;
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  return `initial-import-${Date.now()}`;
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

function toUnenrichedWrite(joined: JoinedRosterCompany, companyId: string, dueAt: string): UnenrichedCompanyWrite {
  return {
    companyId,
    ...apolloWriteFields(joined),
    qualityIssues: [],
    evidenceFingerprint: null,
    nextAgentEnrichmentDueAt: dueAt,
  };
}

function recordError(errors: ImportCompanyError[], joined: JoinedRosterCompany, stage: ImportCompanyError['stage'], message: string, companyId?: string): void {
  errors.push({canonicalDomain: joined.canonicalDomain, companyId, stage, message});
}

function resultError(result: RecordResult | undefined, fallback: string): string {
  return result?.error ?? fallback;
}

/**
 * Imports already-validated provider data. Identity lookup always precedes ID
 * assignment; each company, with its keyword and paid-ad snapshots, is one row write.
 */
export async function runInitialImport(options: InitialImportOptions): Promise<ImportReport> {
  const dryRun = options.dryRun === true;
  if (!dryRun && !options.repository) throw new TypeError('repository is required unless dryRun is true');
  const runId = options.runIdFactory?.() ?? defaultRunId();
  const observedAt = options.observedAt ?? nowIso();
  const calculatedAt = options.calculatedAt ?? observedAt;
  const join = joinRoster(options.apolloRows, options.semrushRecords, {observedAt, rawRef: options.rawRef});
  const errors: ImportCompanyError[] = join.rejections.map((rejection) => ({
    canonicalDomain: rejection.canonicalDomain ?? 'unresolved',
    stage: 'validation',
    message: rejection.code,
  }));
  const repository = options.repository;
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
      if (joined.semrush.records.length === 0) prepared.push({joined, companyId, write: toUnenrichedWrite(joined, companyId, observedAt)});
      else recordError(errors, joined, 'enrichment', 'multiple_current_semrush_observations_requires_selection', companyId);
      continue;
    }
    try {
      const transformed = transformSemrushCompany(semrush, {
        companyId,
        identity: joined.identity,
        observedAt,
        calculatedAt,
        rawRef: options.datasetId ? datasetItemRef(options.datasetId, options.semrushRecords.indexOf(semrush)) : options.rawRef,
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
          keywords: transformed.keywords,
          paidAds: transformed.paidAds,
          evidenceFingerprint: null,
          nextAgentEnrichmentDueAt: observedAt,
        },
      });
    } catch {
      recordError(errors, joined, 'enrichment', 'semrush_transform_failed', companyId);
    }
  }

  const baseReport = {
    runId,
    accepted: join.accepted.length,
    unenriched: join.unmatchedApollo.length,
    rejected: new Set(join.rejections.flatMap((rejection) => rejection.apolloIndex === undefined ? [] : [rejection.apolloIndex])).size,
    apifyOnly: join.apifyOnly.length,
    errors,
  };

  if (dryRun) {
    return {...baseReport, succeeded: 0, failed: errors.filter((error) => error.stage !== 'validation').length};
  }

  const companyWrites = await repository!.upsertCompanies(prepared.map((company) => company.write));
  const companyResultById = new Map(companyWrites.results.map((result) => [result.identity, result]));
  let succeeded = 0;
  let failed = errors.filter((error) => error.stage !== 'validation').length;

  for (const company of prepared) {
    const companyResult = companyResultById.get(company.companyId);
    if (!companyResult || companyResult.error) {
      recordError(errors, company.joined, 'company', resultError(companyResult, 'company_write_not_confirmed'), company.companyId);
      failed += 1;
      continue;
    }
    succeeded += 1;
  }
  return {...baseReport, succeeded, failed};
}
