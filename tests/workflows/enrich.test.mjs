import assert from 'node:assert/strict';
import test from 'node:test';

import {runEnrichment} from '../../src/workflows/enrich.mjs';

const companies = [
  {recordId: 'rec-alpha', companyId: 'company-alpha', canonicalDomain: 'alpha.example'},
  {recordId: 'rec-beta', companyId: 'company-beta', canonicalDomain: 'beta.example'},
  {recordId: 'rec-gamma', companyId: 'company-gamma', canonicalDomain: 'gamma.example'},
];

function providerItem(domain, traffic = 100) {
  return {
    domain,
    database: 'worldwide',
    authority_score: 42,
    backlinks: 1000,
    referring_domains: 20,
    follow_backlinks: 700,
    nofollow_backlinks: 200,
    organic_traffic: traffic,
    total_traffic: traffic,
    organic_keywords: 10,
    organic_traffic_cost_usd: 5,
    organic_competitors_count: 3,
    paid_traffic: 0,
    paid_keywords: 0,
    paid_traffic_cost_usd: 0,
    paid_competitors_count: 0,
    ai_visibility: 2,
    ai_visibility_benchmark: 1,
    ai_mentions: 4,
    ai_cited_pages: 1,
    top_country: 'us',
    top_country_traffic: traffic,
  };
}

function memoryRepository(callOrder = []) {
  const persisted = [];
  return {
    async listActiveCompanies() { return companies; },
    async updateRailwayStatus(status) { callOrder.push(`system:${status.status}`); },
    async upsertCompanies(records) {
      callOrder.push('airtable:writes');
      persisted.push(...records);
    },
    async markCompaniesFailed() {},
    async invalidateCache() { callOrder.push('cache:invalidate'); },
    persistedCompanyIds() { return persisted.map((record) => record.companyId); },
  };
}

test('retries one failed Apify batch and retains successful companies', async () => {
  const repository = memoryRepository();
  const calls = [];
  const report = await runEnrichment({
    batchSize: 2,
    maxAttempts: 2,
    timeoutMs: 5_000,
    dependencies: {
      repository,
      runDomainOverview: async ({domains}) => {
        calls.push(domains);
        if (domains.includes('gamma.example')) throw new Error('provider payload must stay private');
        return {items: domains.map((domain) => providerItem(domain)), datasetId: 'dataset-1'};
      },
      now: () => new Date('2026-08-18T15:00:00.000Z'),
      createRunId: () => 'railway-test-run',
    },
  });

  assert.deepEqual(report, {
    runId: 'railway-test-run', status: 'partial', processed: 3, succeeded: 2, failed: 1,
    cacheInvalidated: true,
    errors: [{companyId: 'company-gamma', code: 'apify_batch_failed'}],
  });
  assert.deepEqual(repository.persistedCompanyIds(), ['company-alpha', 'company-beta']);
  assert.deepEqual(calls, [
    ['alpha.example', 'beta.example'], ['gamma.example'], ['gamma.example'],
  ]);
});

test('invalidates only after completed Airtable writes and terminal System update', async () => {
  const callOrder = [];
  const repository = memoryRepository(callOrder);

  await runEnrichment({
    dependencies: {
      repository,
      runDomainOverview: async ({domains}) => ({
        items: domains.map((domain) => providerItem(domain)), datasetId: 'dataset-1',
      }),
      now: () => new Date('2026-08-18T15:00:00.000Z'),
      createRunId: () => 'railway-test-run',
    },
  });

  assert.deepEqual(callOrder, [
    'system:running', 'airtable:writes', 'system:succeeded', 'cache:invalidate',
  ]);
});

test('rejects malformed provider records without passing raw objects to persistence', async () => {
  const repository = memoryRepository();
  const report = await runEnrichment({
    dependencies: {
      repository,
      runDomainOverview: async () => ({items: [{domain: 'alpha.example', organic_traffic: 'not-a-number'}]}),
      now: () => new Date('2026-08-18T15:00:00.000Z'),
      createRunId: () => 'railway-test-run',
    },
  });

  assert.equal(report.status, 'failed');
  assert.equal(report.succeeded, 0);
  assert.deepEqual(repository.persistedCompanyIds(), []);
  assert.deepEqual(report.errors, [
    {companyId: 'company-alpha', code: 'provider_validation_failed'},
    {companyId: 'company-beta', code: 'provider_validation_failed'},
    {companyId: 'company-gamma', code: 'provider_validation_failed'},
  ]);
});
