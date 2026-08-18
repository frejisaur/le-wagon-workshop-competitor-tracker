import {randomUUID} from 'node:crypto';
import {buildEvidencePackage} from '@/lib/agents/evidence/build-package';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';
import type {CompanyWrite, CompetitorStore, DashboardSnapshot, SystemWireInput, WriteResult} from '@/lib/airtable/types';
import type {SemrushDomainOverview} from '@/lib/schemas/semrush';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {normalizeDomain} from '@/lib/transforms/normalize';
import {transformSemrushCompany} from '@/lib/transforms/semrush-to-domain';

export type EnrichmentStatus = 'succeeded' | 'partial' | 'failed';
export type EnrichmentError = {
  companyId?: string;
  canonicalDomain?: string;
  stage: 'provider' | 'validation' | 'company' | 'keywords' | 'paid_ads' | 'fingerprint' | 'system' | 'cache';
  code: string;
};
export type EnrichmentReport = {
  runId: string;
  status: EnrichmentStatus;
  processed: number;
  succeeded: number;
  failed: number;
  cacheInvalidated: boolean;
  errors: EnrichmentError[];
};

type DomainOverviewPort = (domains: string[], options: {signal: AbortSignal; timeoutMs: number}) => Promise<unknown[]>;
type CachePort = {invalidate: () => Promise<void>};
export type EnrichmentOptions = {
  repository: CompetitorStore;
  /** Server-only boundary; the workflow never receives raw client credentials. */
  runDomainOverview: DomainOverviewPort;
  /** Task 10 supplies the HTTP cache adapter; Task 9 depends only on this port. */
  cache?: CachePort;
  batchSize?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
  now?: () => Date;
  runIdFactory?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
};

type ActiveCompany = {companyId: string; canonicalDomain: string; fields: Record<string, unknown>};

const SYSTEM_ID = 'system';

function validPositiveInteger(value: number | undefined, fallback: number, name: string): number {
  const actual = value ?? fallback;
  if (!Number.isInteger(actual) || actual < 1) throw new TypeError(`${name} must be a positive integer`);
  return actual;
}

function iso(now: () => Date): string {
  return now().toISOString();
}

function safeErrorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'operation_aborted';
  if (error instanceof Error && /timeout/i.test(error.message)) return 'provider_timeout';
  return 'provider_failed';
}

function split<T>(items: T[], size: number): T[][] {
  return Array.from({length: Math.ceil(items.length / size)}, (_, index) => items.slice(index * size, (index + 1) * size));
}

function activeCompanies(snapshot: DashboardSnapshot): ActiveCompany[] {
  const seen = new Set<string>();
  return snapshot.companies.flatMap((record) => {
    const companyId = record.fields['Identity • Company ID'];
    const sourceDomain = record.fields['Identity • Canonical Domain'];
    const canonicalDomain = typeof sourceDomain === 'string' ? normalizeDomain(sourceDomain) : null;
    // The fixture and V1 schema have no lifecycle column. Explicit false is the
    // only inactive value; absence stays active for backward compatibility.
    const active = record.fields['Workflow • Active'] !== false && record.fields['Lifecycle • Active'] !== false;
    if (!active || typeof companyId !== 'string' || !canonicalDomain || seen.has(canonicalDomain)) return [];
    seen.add(canonicalDomain);
    return [{companyId, canonicalDomain, fields: record.fields as Record<string, unknown>}];
  }).sort((left, right) => left.canonicalDomain.localeCompare(right.canonicalDomain) || left.companyId.localeCompare(right.companyId));
}

function stringField(fields: Record<string, unknown>, name: string): string | undefined {
  return typeof fields[name] === 'string' ? fields[name] : undefined;
}

function companyWrite(company: ActiveCompany, record: SemrushDomainOverview, refreshedAt: string): CompanyWrite {
  const evidence = transformSemrushCompany(record, {
    companyId: company.companyId,
    identity: {
      canonicalDomain: company.canonicalDomain,
      apolloAccountId: stringField(company.fields, 'Observed • Apollo Account ID') ?? '',
      apolloRecordId: stringField(company.fields, 'Observed • Apollo Record ID') ?? '',
    },
    observedAt: refreshedAt,
    calculatedAt: refreshedAt,
    rawRef: undefined,
  });
  return {
    companyId: company.companyId,
    identity: evidence.company.identity,
    observed: evidence.company.observed,
    calculated: evidence.company.calculated!,
    displayName: stringField(company.fields, 'Observed • Display Name'),
    segment: stringField(company.fields, 'Observed • Segment'),
    apolloWebsite: stringField(company.fields, 'Observed • Apollo Website'),
    apifyDomain: stringField(company.fields, 'Observed • Apify Domain'),
    apolloAccountStage: stringField(company.fields, 'Observed • Apollo Account Stage'),
    apolloLists: stringField(company.fields, 'Observed • Apollo Lists'),
    apolloEmployees: stringField(company.fields, 'Observed • Apollo Employees'),
    apolloIndustry: stringField(company.fields, 'Observed • Apollo Industry'),
    apolloCompanyCountry: stringField(company.fields, 'Observed • Apollo Company Country'),
    qualityIssues: evidence.qualityIssues,
    // Invalidate before dependent writes. A failed retry never leaves an old
    // fingerprint claiming that changed evidence is current.
    evidenceFingerprint: null,
    nextAgentEnrichmentDueAt: refreshedAt,
  };
}

function matchingFailure(result: WriteResult, identity: string): string | null {
  return result.results.find((item) => item.identity === identity)?.error ?? (result.failed > 0 ? 'write_failed' : null);
}

function deriveStatus(succeeded: number, failed: number): EnrichmentStatus {
  if (failed === 0) return 'succeeded';
  return succeeded > 0 ? 'partial' : 'failed';
}

function terminalSystem(runId: string, status: EnrichmentStatus, report: Pick<EnrichmentReport, 'processed' | 'succeeded' | 'failed' | 'errors'>, finishedAt: string): SystemWireInput {
  return {
    systemId: SYSTEM_ID,
    lastRunFinishedAt: finishedAt,
    ...(status === 'succeeded' ? {lastSuccessfulRunAt: finishedAt} : {}),
    status,
    processedCompanies: report.processed,
    succeededCompanies: report.succeeded,
    failedCompanies: report.failed,
    errorSummary: report.errors.length ? report.errors.map((error) => error.code).sort().join(',').slice(0, 300) : null,
    railwayWorkflowVersion: '1.0.0',
    railwayRunId: runId,
  };
}

function indexedRecords(items: unknown[], expected: Map<string, ActiveCompany>, errors: EnrichmentError[]): Map<string, SemrushDomainOverview> {
  const records = new Map<string, SemrushDomainOverview>();
  for (const item of items) {
    const rawDomain = item && typeof item === 'object' && typeof (item as {domain?: unknown}).domain === 'string'
      ? normalizeDomain((item as {domain: string}).domain)
      : null;
    try {
      const parsed = parseSemrushPayload([item]).records[0];
      const domain = normalizeDomain(parsed.domain);
      if (!domain) continue;
      const company = expected.get(domain);
      if (!company) continue; // An actor may return an adjacent, unrequested domain; it is not persisted.
      if (records.has(domain)) {
        errors.push({companyId: company.companyId, canonicalDomain: domain, stage: 'validation', code: 'duplicate_dataset_item'});
        records.delete(domain);
      } else records.set(domain, parsed);
    } catch {
      const company = rawDomain ? expected.get(rawDomain) : undefined;
      if (company) errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'validation', code: 'invalid_provider_record'});
    }
  }
  return records;
}

/** Deterministic Railway metric refresh. It never invokes or changes the agent workflow. */
export async function runEnrichment(options: EnrichmentOptions): Promise<EnrichmentReport> {
  const batchSize = validPositiveInteger(options.batchSize, 10, 'batchSize');
  const maxAttempts = validPositiveInteger(options.maxAttempts, 2, 'maxAttempts');
  const timeoutMs = validPositiveInteger(options.timeoutMs, 60_000, 'timeoutMs');
  const retryDelayMs = options.retryDelayMs ?? 250;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) throw new TypeError('retryDelayMs must be a non-negative integer');
  const now = options.now ?? (() => new Date());
  const runId = options.runIdFactory?.() ?? `railway-${randomUUID()}`;
  const report: EnrichmentReport = {runId, status: 'failed', processed: 0, succeeded: 0, failed: 0, cacheInvalidated: false, errors: []};
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  else options.signal?.addEventListener('abort', forwardAbort, {once: true});
  let persistenceFailed = false;
  let terminalUpdated = false;

  try {
    const initial = await options.repository.getDashboardSnapshot();
    const companies = activeCompanies(initial);
    report.processed = companies.length;
    const running = await options.repository.updateSystem({
      systemId: SYSTEM_ID, lastRunStartedAt: iso(now), status: 'running', processedCompanies: companies.length,
      succeededCompanies: 0, failedCompanies: 0, errorSummary: null, railwayWorkflowVersion: '1.0.0', railwayRunId: runId,
    });
    if (running.failed > 0) throw new Error('system_start_failed');

    for (const batch of split(companies, batchSize)) {
      const expected = new Map(batch.map((company) => [company.canonicalDomain, company]));
      let items: unknown[] | undefined;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          items = await options.runDomainOverview(batch.map((company) => company.canonicalDomain), {signal: controller.signal, timeoutMs});
          break;
        } catch (error) {
          if (attempt + 1 === maxAttempts) {
            for (const company of batch) report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'provider', code: safeErrorCode(error)});
          } else if (retryDelayMs > 0) await (options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))))(retryDelayMs * (2 ** attempt));
        }
      }
      if (!items) continue;
      const datasetErrors: EnrichmentError[] = [];
      const parsed = indexedRecords(items, expected, datasetErrors);
      report.errors.push(...datasetErrors);
      for (const company of batch) {
        const record = parsed.get(company.canonicalDomain);
        if (!record) {
          if (!datasetErrors.some((error) => error.companyId === company.companyId)) report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'validation', code: 'dataset_item_missing'});
          continue;
        }
        const refreshedAt = iso(now);
        let write: CompanyWrite;
        try {
          write = companyWrite(company, record, refreshedAt);
        } catch {
          report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'validation', code: 'transform_failed'});
          continue;
        }
        const companyResult = await options.repository.upsertCompanies([write]);
        const companyFailure = matchingFailure(companyResult, company.companyId);
        if (companyFailure) {
          persistenceFailed = true;
          report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'company', code: 'company_write_failed'});
          continue;
        }
        const transformed = transformSemrushCompany(record, {companyId: company.companyId, identity: write.identity, observedAt: refreshedAt, calculatedAt: refreshedAt});
        const keywordResult = await options.repository.replaceKeywords(company.companyId, transformed.keywords);
        const paidResult = await options.repository.upsertPaidAds(transformed.paidAds);
        const keywordFailure = keywordResult.failed > 0;
        const paidFailure = paidResult.failed > 0;
        if (keywordFailure || paidFailure) {
          persistenceFailed = true;
          if (keywordFailure) report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'keywords', code: 'keyword_write_failed'});
          if (paidFailure) report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'paid_ads', code: 'paid_ad_write_failed'});
          continue;
        }
        try {
          const snapshot = await options.repository.getDashboardSnapshot();
          const storedCompany = snapshot.companies.find((candidate) => candidate.fields['Identity • Company ID'] === company.companyId);
          if (!storedCompany) throw new Error('company_missing_after_write');
          const pkg = buildEvidencePackage({company: storedCompany, keywords: snapshot.keywords.filter((keyword) => keyword.fields['Identity • Company ID'] === company.companyId), paidAds: snapshot.paidAds.filter((ad) => ad.fields['Identity • Company ID'] === company.companyId), publishedInsight: snapshot.publishedInsights.find((insight) => insight.fields['Identity • Company ID'] === company.companyId), review: snapshot.reviews.find((review) => review.fields['Identity • Company ID'] === company.companyId)});
          const fingerprinted = await options.repository.upsertCompanies([{...write, evidenceFingerprint: fingerprintEvidence(pkg), lastSuccessfulRefreshAt: refreshedAt, nextAgentEnrichmentDueAt: refreshedAt}]);
          if (fingerprinted.failed > 0) throw new Error('fingerprint_write_failed');
          report.succeeded += 1;
        } catch {
          persistenceFailed = true;
          report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'fingerprint', code: 'fingerprint_update_failed'});
        }
      }
    }
    report.failed = report.processed - report.succeeded;
    report.status = deriveStatus(report.succeeded, report.failed);
  } catch {
    if (report.errors.every((error) => error.stage !== 'system')) report.errors.push({stage: 'system', code: 'system_start_failed'});
    report.failed = Math.max(report.failed, report.processed - report.succeeded);
    report.status = 'failed';
  } finally {
    controller.abort();
    options.signal?.removeEventListener('abort', forwardAbort);
    report.failed = Math.max(0, report.processed - report.succeeded);
    report.status = deriveStatus(report.succeeded, report.failed);
    const terminal = terminalSystem(runId, report.status, report, iso(now));
    try {
      const result = await options.repository.updateSystem(terminal);
      if (result.failed > 0) throw new Error('terminal_system_write_failed');
      terminalUpdated = true;
    } catch {
      report.errors.push({stage: 'system', code: 'terminal_system_write_failed'});
      report.status = 'failed';
      try {
        const recovery = await options.repository.updateSystem(terminalSystem(runId, 'failed', report, iso(now)));
        terminalUpdated = recovery.failed === 0;
      } catch {
        terminalUpdated = false;
      }
    }
    if (terminalUpdated && report.succeeded > 0 && !persistenceFailed && options.cache) {
      try {
        await options.cache.invalidate();
        report.cacheInvalidated = true;
      } catch {
        report.errors.push({stage: 'cache', code: 'cache_invalidation_failed'});
        report.status = 'failed';
        report.cacheInvalidated = false;
      }
    }
  }
  return report;
}
