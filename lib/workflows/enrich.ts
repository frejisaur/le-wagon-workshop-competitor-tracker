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

export type ProviderBatchResult = {items: unknown[]; datasetId: string};
type DomainOverviewPort = (domains: string[], options: {signal: AbortSignal; timeoutMs: number}) => Promise<ProviderBatchResult | unknown[]>;
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
// 10 aligns one domain batch with Airtable's documented mutation batch; three
// attempts and a two-minute request ceiling fit a 90-minute workshop safely.
const MAX_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_UNEXPECTED_DATASET_ERRORS = 10;

function validPositiveInteger(value: number | undefined, fallback: number, name: string, maximum: number): number {
  const actual = value ?? fallback;
  if (!Number.isInteger(actual) || actual < 1 || actual > maximum) throw new TypeError(`${name} must be an integer from 1 to ${maximum}`);
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

function activeCompanies(snapshot: DashboardSnapshot): {companies: ActiveCompany[]; failures: EnrichmentError[]} {
  type RosterCandidate = ActiveCompany | {failure: EnrichmentError};
  const candidates: RosterCandidate[] = snapshot.companies.flatMap<RosterCandidate>((record) => {
    const companyId = record.fields['Identity • Company ID'];
    const sourceDomain = record.fields['Identity • Canonical Domain'];
    const canonicalDomain = typeof sourceDomain === 'string' ? normalizeDomain(sourceDomain) : null;
    // The fixture and V1 schema have no lifecycle column. Explicit false is the
    // only inactive value; absence stays active for backward compatibility.
    const active = record.fields['Workflow • Active'] !== false && record.fields['Lifecycle • Active'] !== false;
    if (!active) return [];
    if (typeof companyId !== 'string' || !companyId) return [{failure: {stage: 'validation' as const, code: 'roster_company_id_missing'}}];
    if (!canonicalDomain) return [{failure: {companyId, stage: 'validation' as const, code: 'roster_domain_invalid'}}];
    return [{companyId, canonicalDomain, fields: record.fields as Record<string, unknown>}];
  });
  const duplicateDomains = new Set<string>();
  const seenDomains = new Set<string>();
  for (const item of candidates) {
    if ('failure' in item) continue;
    if (seenDomains.has(item.canonicalDomain)) duplicateDomains.add(item.canonicalDomain);
    seenDomains.add(item.canonicalDomain);
  }
  const companies: ActiveCompany[] = [];
  const failures: EnrichmentError[] = [];
  for (const item of candidates) {
    if ('failure' in item) { failures.push(item.failure); continue; }
    if (duplicateDomains.has(item.canonicalDomain)) failures.push({companyId: item.companyId, canonicalDomain: item.canonicalDomain, stage: 'validation', code: 'roster_duplicate_domain'});
    else companies.push(item);
  }
  return {companies: companies.sort((left, right) => left.canonicalDomain.localeCompare(right.canonicalDomain) || left.companyId.localeCompare(right.companyId)), failures: failures.sort((left, right) => `${left.canonicalDomain ?? ''}\0${left.companyId ?? ''}\0${left.code}`.localeCompare(`${right.canonicalDomain ?? ''}\0${right.companyId ?? ''}\0${right.code}`))};
}

function stringField(fields: Record<string, unknown>, name: string): string | undefined {
  return typeof fields[name] === 'string' ? fields[name] : undefined;
}

function storedJson<T>(fields: Record<string, unknown>, name: string, fallback: T): T {
  const raw = fields[name];
  if (typeof raw !== 'string') return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** The actor deliberately requests `include_moz:false`; absent Moz is not an authoritative empty refresh. */
function preserveMozWhenOmitted(evidence: ReturnType<typeof transformSemrushCompany>, record: SemrushDomainOverview, fields: Record<string, unknown>): void {
  if (record.moz) return;
  const observed = evidence.company.observed;
  const calculated = evidence.company.calculated;
  const rawAuthority = fields['Observed • Moz Domain Authority Raw'];
  const rawSpam = fields['Observed • Moz Spam Score Raw'];
  if (typeof rawAuthority === 'string' || rawAuthority === null) observed.mozDomainAuthorityRaw = rawAuthority;
  if (typeof rawSpam === 'string' || rawSpam === null) observed.mozSpamScoreRaw = rawSpam;
  observed.mozTopPagesObserved = storedJson(fields, 'Observed • Moz Top Pages JSON', observed.mozTopPagesObserved);
  const authority = fields['Calculated • Moz Domain Authority'];
  const spam = fields['Calculated • Moz Spam Score'];
  if (typeof authority === 'number' || authority === null) calculated.mozDomainAuthority = {raw: observed.mozDomainAuthorityRaw, normalized: authority};
  if (typeof spam === 'number' || spam === null) calculated.mozSpamScore = {raw: observed.mozSpamScoreRaw, normalized: spam};
  calculated.mozTopPages = storedJson(fields, 'Calculated • Moz Top Pages JSON', calculated.mozTopPages);
  const observedCount = fields['Calculated • Moz Top Pages Observed Count'];
  if (typeof observedCount === 'number' && Number.isInteger(observedCount) && observedCount >= 0) calculated.mozTopPagesObservedCount = observedCount;
}

function companyWrite(company: ActiveCompany, record: SemrushDomainOverview, refreshedAt: string, rawRef?: string, trackedSetTotalTraffic?: number | null, completeCoverage = false): {write: CompanyWrite; keywords: ReturnType<typeof transformSemrushCompany>['keywords']; paidAds: ReturnType<typeof transformSemrushCompany>['paidAds']} {
  const evidence = transformSemrushCompany(record, {
    companyId: company.companyId,
    identity: {
      canonicalDomain: company.canonicalDomain,
      apolloAccountId: stringField(company.fields, 'Observed • Apollo Account ID') ?? '',
      apolloRecordId: stringField(company.fields, 'Observed • Apollo Record ID') ?? '',
    },
    observedAt: refreshedAt,
    calculatedAt: refreshedAt,
    rawRef,
    trackedSetTotalTraffic: completeCoverage ? trackedSetTotalTraffic : null,
  });
  preserveMozWhenOmitted(evidence, record, company.fields);
  if (!completeCoverage) evidence.qualityIssues.push({code: 'tracked_set_coverage_incomplete', message: 'Tracked-set traffic share omitted because the complete active roster was not validated', sourcePath: 'refresh.coverage', summary: 'incomplete validated roster coverage'});
  return {write: {
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
  }, keywords: evidence.keywords, paidAds: evidence.paidAds};
}

function matchingFailure(result: WriteResult, identity: string): string | null {
  return result.results.find((item) => item.identity === identity)?.error ?? (result.failed > 0 ? 'write_failed' : null);
}

function deriveStatus(succeeded: number, failed: number): EnrichmentStatus {
  if (failed === 0) return 'succeeded';
  return succeeded > 0 ? 'partial' : 'failed';
}

function terminalSystem(runId: string, status: EnrichmentStatus, report: Pick<EnrichmentReport, 'processed' | 'succeeded' | 'failed' | 'errors'>, finishedAt: string, previousLastSuccessful: string | null | undefined): SystemWireInput {
  return {
    systemId: SYSTEM_ID,
    lastRunFinishedAt: finishedAt,
    // An unreadable startup snapshot means the previous value is unknown. Omit
    // it so the Airtable PATCH preserves the existing timestamp; known null is
    // still an explicit null.
    ...(status === 'succeeded' ? {lastSuccessfulRunAt: finishedAt} : previousLastSuccessful === undefined ? {} : {lastSuccessfulRunAt: previousLastSuccessful}),
    status,
    processedCompanies: report.processed,
    succeededCompanies: report.succeeded,
    failedCompanies: report.failed,
    errorSummary: report.errors.length ? report.errors.map((error) => error.code).sort().join(',').slice(0, 300) : null,
    railwayWorkflowVersion: '1.0.0',
    railwayRunId: runId,
  };
}

type IndexedRecord = {record: SemrushDomainOverview; rawRef?: string};

function datasetItemRef(datasetId: string, offset: number): string | undefined {
  if (!datasetId) return undefined;
  return `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?offset=${offset}&limit=1`;
}

function indexedRecords(items: unknown[], expected: Map<string, ActiveCompany>, errors: EnrichmentError[], datasetId?: string): Map<string, IndexedRecord> {
  const records = new Map<string, IndexedRecord>();
  const poisoned = new Set<string>();
  let unexpected = 0;
  for (const [itemOffset, item] of items.entries()) {
    const rawDomain = item && typeof item === 'object' && typeof (item as {domain?: unknown}).domain === 'string'
      ? normalizeDomain((item as {domain: string}).domain)
      : null;
    try {
      const validated = parseSemrushPayload([item]);
      const parsed = validated.records[0];
      const domain = normalizeDomain(parsed.domain);
      if (!domain) continue;
      const company = expected.get(domain);
      if (!company) {
        if (unexpected < MAX_UNEXPECTED_DATASET_ERRORS) errors.push({stage: 'validation', code: 'unexpected_dataset_item'});
        unexpected += 1;
        continue;
      }
      if (poisoned.has(domain)) continue;
      for (const issue of validated.issues) {
        if (issue.section === 'organic' || issue.section === 'paid') errors.push({companyId: company.companyId, canonicalDomain: domain, stage: 'validation', code: `malformed_${issue.section}_module`});
      }
      if (records.has(domain)) {
        errors.push({companyId: company.companyId, canonicalDomain: domain, stage: 'validation', code: 'duplicate_dataset_item'});
        records.delete(domain);
        poisoned.add(domain);
      } else records.set(domain, {record: parsed, rawRef: datasetItemRef(datasetId ?? '', itemOffset)});
    } catch {
      const company = rawDomain ? expected.get(rawDomain) : undefined;
      if (company) errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'validation', code: 'invalid_provider_record'});
      else if (unexpected < MAX_UNEXPECTED_DATASET_ERRORS) {
        errors.push({stage: 'validation', code: 'unexpected_dataset_item'});
        unexpected += 1;
      }
    }
  }
  return records;
}

/** Deterministic Railway metric refresh. It never invokes or changes the agent workflow. */
export async function runEnrichment(options: EnrichmentOptions): Promise<EnrichmentReport> {
  const batchSize = validPositiveInteger(options.batchSize, 10, 'batchSize', MAX_BATCH_SIZE);
  const maxAttempts = validPositiveInteger(options.maxAttempts, 2, 'maxAttempts', MAX_ATTEMPTS);
  const timeoutMs = validPositiveInteger(options.timeoutMs, 60_000, 'timeoutMs', MAX_TIMEOUT_MS);
  const retryDelayMs = options.retryDelayMs ?? 250;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > MAX_RETRY_DELAY_MS) throw new TypeError(`retryDelayMs must be an integer from 0 to ${MAX_RETRY_DELAY_MS}`);
  const now = options.now ?? (() => new Date());
  const runId = options.runIdFactory?.() ?? `railway-${randomUUID()}`;
  const report: EnrichmentReport = {runId, status: 'failed', processed: 0, succeeded: 0, failed: 0, cacheInvalidated: false, errors: []};
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  else options.signal?.addEventListener('abort', forwardAbort, {once: true});
  let persistenceFailed = false;
  // Only the first intended terminal publication authorizes cache invalidation.
  // A recovery write merely clears a potentially stale `running` state.
  let intendedTerminalPublished = false;
  let fatalStartupFailure = false;
  let previousLastSuccessful: string | null | undefined;

  try {
    const initial = await options.repository.getDashboardSnapshot();
    const storedLastSuccessful = initial.system.find((record) => record.fields['Identity • System ID'] === SYSTEM_ID)?.fields['Workflow • Last Successful Run At'];
    // A readable snapshot makes an absent/malformed value a known explicit
    // null. Only a failed snapshot read leaves the prior value unknown.
    previousLastSuccessful = typeof storedLastSuccessful === 'string' ? storedLastSuccessful : null;
    const roster = activeCompanies(initial);
    const companies = roster.companies;
    report.errors.push(...roster.failures);
    report.processed = companies.length + roster.failures.length;
    const running = await options.repository.updateSystem({
      systemId: SYSTEM_ID, lastRunStartedAt: iso(now), status: 'running', processedCompanies: companies.length,
      succeededCompanies: 0, failedCompanies: 0, errorSummary: null, railwayWorkflowVersion: '1.0.0', railwayRunId: runId,
    });
    if (running.failed > 0) throw new Error('system_start_failed');

    for (const batch of split(companies, batchSize)) {
      const expected = new Map(batch.map((company) => [company.canonicalDomain, company]));
      let provider: ProviderBatchResult | undefined;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const result = await options.runDomainOverview(batch.map((company) => company.canonicalDomain), {signal: controller.signal, timeoutMs});
          provider = Array.isArray(result) ? {items: result, datasetId: ''} : result;
          break;
        } catch (error) {
          if (attempt + 1 === maxAttempts) {
            for (const company of batch) report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'provider', code: safeErrorCode(error)});
          } else if (retryDelayMs > 0) await (options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))))(retryDelayMs * (2 ** attempt));
        }
      }
      if (!provider) continue;
      const datasetErrors: EnrichmentError[] = [];
      const parsed = indexedRecords(provider.items, expected, datasetErrors, provider.datasetId);
      report.errors.push(...datasetErrors);
      const completeTrackedSetCoverage = report.processed === batch.length && parsed.size === batch.length;
      const trackedSetTotalTraffic = completeTrackedSetCoverage
        ? [...parsed.values()].reduce<number | null>((total, value) => total === null || typeof value.record.total_traffic !== 'number' || !Number.isFinite(value.record.total_traffic) ? null : total + value.record.total_traffic, 0)
        : null;
      for (const company of batch) {
        const indexed = parsed.get(company.canonicalDomain);
        if (!indexed) {
          if (!datasetErrors.some((error) => error.companyId === company.companyId)) report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'validation', code: 'dataset_item_missing'});
          continue;
        }
        const refreshedAt = iso(now);
        let write: CompanyWrite;
        let keywords: ReturnType<typeof transformSemrushCompany>['keywords'];
        let paidAds: ReturnType<typeof transformSemrushCompany>['paidAds'];
        try {
          ({write, keywords, paidAds} = companyWrite(company, indexed.record, refreshedAt, indexed.rawRef, trackedSetTotalTraffic, completeTrackedSetCoverage));
          if (!indexed.record.organic) write.qualityIssues.push({code: 'malformed_organic_module', message: 'Organic module omitted after provider validation failure; existing keyword evidence retained', sourcePath: 'organic', summary: 'organic module omitted'});
          if (!indexed.record.paid) write.qualityIssues.push({code: 'malformed_paid_module', message: 'Paid module omitted after provider validation failure; existing paid-ad evidence retained', sourcePath: 'paid', summary: 'paid module omitted'});
        } catch {
          report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'validation', code: 'transform_failed'});
          continue;
        }
        let companyResult: WriteResult;
        try {
          companyResult = await options.repository.upsertCompanies([write]);
        } catch {
          persistenceFailed = true;
          report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'company', code: 'company_write_failed'});
          continue;
        }
        const companyFailure = matchingFailure(companyResult, company.companyId);
        if (companyFailure) {
          persistenceFailed = true;
          report.errors.push({companyId: company.companyId, canonicalDomain: company.canonicalDomain, stage: 'company', code: 'company_write_failed'});
          continue;
        }
        let keywordResult: WriteResult;
        let paidResult: WriteResult;
        try {
          keywordResult = indexed.record.organic ? await options.repository.replaceKeywords(company.companyId, keywords) : {succeeded: 0, failed: 0, results: []};
        } catch {
          keywordResult = {succeeded: 0, failed: 1, results: [{identity: company.companyId, error: 'keyword_write_failed'}]};
        }
        try {
          // Replace the complete paid-ad snapshot only after it has crossed the
          // provider validation and domain transform boundaries. The repository
          // writes every incoming record before it deletes obsolete rows.
          paidResult = indexed.record.paid ? await options.repository.replacePaidAds(company.companyId, paidAds) : {succeeded: 0, failed: 0, results: []};
        } catch {
          paidResult = {succeeded: 0, failed: 1, results: [{identity: company.companyId, error: 'paid_ad_write_failed'}]};
        }
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
    fatalStartupFailure = true;
    if (report.errors.every((error) => error.stage !== 'system')) report.errors.push({stage: 'system', code: 'system_start_failed'});
    report.failed = Math.max(report.failed, report.processed - report.succeeded);
    report.status = 'failed';
  } finally {
    controller.abort();
    options.signal?.removeEventListener('abort', forwardAbort);
    report.failed = Math.max(0, report.processed - report.succeeded);
    report.status = fatalStartupFailure ? 'failed' : deriveStatus(report.succeeded, report.failed);
    const terminal = terminalSystem(runId, report.status, report, iso(now), previousLastSuccessful);
    try {
      const result = await options.repository.updateSystem(terminal);
      if (result.failed > 0) throw new Error('terminal_system_write_failed');
      intendedTerminalPublished = true;
    } catch {
      report.errors.push({stage: 'system', code: 'terminal_system_write_failed'});
      report.status = 'failed';
      try {
        await options.repository.updateSystem(terminalSystem(runId, 'failed', report, iso(now), previousLastSuccessful));
      } catch {}
    }
    if (intendedTerminalPublished && report.succeeded > 0 && !persistenceFailed && options.cache) {
      try {
        await options.cache.invalidate();
        report.cacheInvalidated = true;
      } catch {
        report.errors.push({stage: 'cache', code: 'cache_invalidation_failed'});
        report.status = 'failed';
        report.cacheInvalidated = false;
        try {
          await options.repository.updateSystem(terminalSystem(runId, 'failed', report, iso(now), previousLastSuccessful));
        } catch {}
      }
    }
  }
  return report;
}
