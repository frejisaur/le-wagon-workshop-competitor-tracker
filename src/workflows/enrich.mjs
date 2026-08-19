import {randomUUID} from 'node:crypto';

import {normalizeDomain} from '../domain/normalize.mjs';
import {runDomainOverview as liveRunDomainOverview} from '../apify/run-domain-overview.mjs';
import {toCompanyRefreshRecord, validateDomainOverviewRecord} from '../refresh/provider-record.mjs';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const defaultRunId = () => `railway-${randomUUID()}`;

function chunks(values, size) {
  return Array.from({length: Math.ceil(values.length / size)}, (_, index) => values.slice(index * size, (index + 1) * size));
}

async function attemptBatch(runDomainOverview, options, maxAttempts) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runDomainOverview(options);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(Math.min(2_000, 100 * (2 ** (attempt - 1))));
    }
  }
}

export async function runEnrichment({
  batchSize = 25,
  maxAttempts = 2,
  timeoutMs = 15 * 60_000,
  dependencies = {},
} = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('batchSize must be between 1 and 100');
  const repository = dependencies.repository;
  if (!repository) throw new Error('refresh repository is required');
  const now = dependencies.now || (() => new Date());
  const runId = (dependencies.createRunId || defaultRunId)();
  const runDomainOverview = dependencies.runDomainOverview || liveRunDomainOverview;
  const startedAt = now().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Railway refresh timed out')), timeoutMs);
  const errors = [];
  let companies = [];
  let terminalStatus = 'failed';
  let succeeded = 0;
  let cacheInvalidated = false;
  try {
    companies = await repository.listActiveCompanies();
    await repository.updateRailwayStatus({runId, status: 'running', processed: 0, succeeded: 0, failed: 0, errors: [], startedAt});
    const successful = [];
    const failed = [];
    for (const batch of chunks(companies, batchSize)) {
      let response;
      try {
        response = await attemptBatch(runDomainOverview, {
          domains: batch.map((company) => company.canonicalDomain), timeoutMs, signal: controller.signal,
        }, maxAttempts);
      } catch {
        for (const company of batch) {
          failed.push(company);
          errors.push({companyId: company.companyId, code: 'apify_batch_failed'});
        }
        continue;
      }
      const observations = new Map();
      for (const raw of response.items || []) {
        const observation = validateDomainOverviewRecord(raw);
        if (observation.ok) observations.set(observation.value.canonicalDomain, observation);
      }
      for (const company of batch) {
        const observation = observations.get(normalizeDomain(company.canonicalDomain));
        if (!observation) {
          failed.push(company);
          errors.push({companyId: company.companyId, code: 'provider_validation_failed'});
          continue;
        }
        successful.push(toCompanyRefreshRecord({
          company, observation, observedAt: now().toISOString(), datasetId: response.datasetId,
        }));
      }
    }
    try {
      if (successful.length) await repository.upsertCompanies(successful);
    } catch {
      const writeFailed = new Set(successful.map((record) => record.companyId));
      succeeded = 0;
      for (const company of companies.filter((company) => writeFailed.has(company.companyId))) {
        failed.push(company);
        errors.push({companyId: company.companyId, code: 'airtable_write_failed'});
      }
    }
    if (!errors.some((error) => error.code === 'airtable_write_failed')) succeeded = successful.length;
    if (failed.length) await repository.markCompaniesFailed(failed);
    terminalStatus = succeeded === companies.length ? 'succeeded' : succeeded > 0 ? 'partial' : 'failed';
    const finishedAt = now().toISOString();
    await repository.updateRailwayStatus({
      runId, status: terminalStatus, processed: companies.length, succeeded, failed: companies.length - succeeded,
      errors, startedAt, finishedAt,
    });
    await repository.invalidateCache();
    cacheInvalidated = true;
    return {runId, status: terminalStatus, processed: companies.length, succeeded, failed: companies.length - succeeded, cacheInvalidated, errors};
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (terminalStatus === 'failed' && companies.length) {
      // The terminal System update above normally records this state. This fallback only prevents a stuck running run.
      await repository.updateRailwayStatus({
        runId, status: 'failed', processed: companies.length, succeeded, failed: companies.length - succeeded,
        errors, startedAt, finishedAt: now().toISOString(),
      }).catch(() => {});
    }
  }
}
