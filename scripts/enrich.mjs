#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {AirtableRecordsClient, AirtableRefreshRepository} from '../src/airtable/refresh-repository.mjs';
import {normalizeDomain} from '../src/domain/normalize.mjs';
import {getRefreshEnv, parseDotEnv} from '../src/config/env.mjs';
import {runEnrichment} from '../src/workflows/enrich.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function fixtureRepository(snapshot) {
  const companies = snapshot.companies || [];
  return {
    async listActiveCompanies() { return companies; },
    async updateRailwayStatus() {},
    async upsertCompanies() {},
    async markCompaniesFailed() {},
    async invalidateCache() {},
  };
}

const fixturePath = option('--provider-fixture');
const fixtureStatePath = option('--fixture-state');
const localPath = resolve('.env.local');
const localEnvironment = existsSync(localPath) ? parseDotEnv(readFileSync(localPath, 'utf8')) : {};
const environment = {...localEnvironment, ...process.env};

let dependencies;
if (fixturePath || fixtureStatePath) {
  if (!fixturePath || !fixtureStatePath) {
    console.error('Fixture mode requires --provider-fixture and --fixture-state');
    process.exit(2);
  }
  const fixtureItems = JSON.parse(readFileSync(resolve(fixturePath), 'utf8'));
  const snapshot = JSON.parse(readFileSync(resolve(fixtureStatePath), 'utf8'));
  dependencies = {
    repository: fixtureRepository(snapshot),
    runDomainOverview: async ({domains}) => ({
      items: fixtureItems.filter((item) => domains.includes(normalizeDomain(item.domain))),
      datasetId: 'fixture-dataset',
    }),
  };
} else {
  const refreshEnv = getRefreshEnv(environment);
  if (refreshEnv.missing.length) {
    console.error(`Refresh preflight failed; missing: ${refreshEnv.missing.join(', ')}`);
    process.exit(2);
  }
  const client = new AirtableRecordsClient({
    baseId: refreshEnv.values.AIRTABLE_BASE_ID,
    token: refreshEnv.values.AIRTABLE_PAT,
  });
  dependencies = {
    repository: new AirtableRefreshRepository({
      client,
      companiesTable: environment.AIRTABLE_COMPANIES_TABLE || 'Companies',
      systemTable: environment.AIRTABLE_SYSTEM_TABLE || 'System',
    }),
  };
  dependencies.runDomainOverview = (options) => import('../src/apify/run-domain-overview.mjs').then(
    ({runDomainOverview}) => runDomainOverview({...options, token: refreshEnv.values.APIFY_TOKEN}),
  );
}

try {
  const report = await runEnrichment({dependencies});
  console.log(JSON.stringify({
    runId: report.runId,
    status: report.status,
    processed: report.processed,
    succeeded: report.succeeded,
    failed: report.failed,
    cacheInvalidated: report.cacheInvalidated,
  }));
  if (report.status === 'failed' || !report.cacheInvalidated) process.exitCode = 1;
} catch (error) {
  console.error(`Refresh failed: ${error?.name || 'unknown_error'}`);
  process.exitCode = 1;
}
