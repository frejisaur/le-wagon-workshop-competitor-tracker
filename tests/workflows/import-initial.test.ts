import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {CompetitorStore, WriteResult} from '@/lib/airtable/types';
import {parseApolloCsv} from '@/lib/schemas/apollo';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {runInitialImport} from '@/lib/workflows/import-initial';

const fixtures = resolve(process.cwd(), 'tests/fixtures');

function fixtureOptions(repository: FixtureCompetitorRepository) {
  return {
    repository,
    apolloRows: parseApolloCsv(readFileSync(resolve(fixtures, 'providers/apollo-sample.csv'), 'utf8')),
    semrushRecords: parseSemrushPayload(JSON.parse(readFileSync(resolve(fixtures, 'providers/semrush-sample.json'), 'utf8'))).records,
    idFactory: (canonicalDomain: string) => `company-${canonicalDomain.split('.')[0]}`,
    runIdFactory: () => 'run-fixture',
    observedAt: '2026-08-18T00:00:00.000Z',
  };
}

function fixtureRepository(): FixtureCompetitorRepository {
  return FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'import/existing-identities.json'));
}

describe('runInitialImport', () => {
  it('imports the fixture twice without changing company IDs or creating duplicates', async () => {
    const repository = fixtureRepository();
    const mintedDomains: string[] = [];
    const options = {...fixtureOptions(repository), idFactory: (canonicalDomain: string) => {
      mintedDomains.push(canonicalDomain);
      return `company-${canonicalDomain.split('.')[0]}`;
    }};

    const first = await runInitialImport(options);
    const second = await runInitialImport(options);

    expect(first.succeeded).toBe(2);
    expect(second.succeeded).toBe(2);
    expect(repository.companyIds()).toEqual(['company-alpha', 'company-beta']);
    expect(repository.counts()).toMatchObject({companies: 2, keywords: 3, paidAds: 1});
    expect(mintedDomains).toEqual(['alpha.example', 'beta.example']);
  });

  it('writes valid unmatched Apollo companies without Semrush metric groups', async () => {
    const repository = fixtureRepository();
    const options = fixtureOptions(repository);
    options.apolloRows.push({'Company Name': 'Gamma', Website: 'https://gamma.example', 'Apollo Account Id': 'acct-gamma', 'Apollo Record Id': 'rec-gamma'});

    const result = await runInitialImport(options);
    const gamma = (await repository.getDashboardSnapshot()).companies.find((company) => company.fields['Identity • Canonical Domain'] === 'gamma.example');

    expect(result).toMatchObject({accepted: 3, unenriched: 1, succeeded: 3, apifyOnly: 0});
    expect(gamma?.fields).toMatchObject({
      'Identity • Company ID': 'company-gamma',
      'Observed • Apollo Account ID': 'acct-gamma',
      'Observed • Organic Traffic': undefined,
      'Calculated • Tracked Set Traffic Share': undefined,
    });
  });

  it('rejects a conflicting same-batch Semrush domain without writing it as unenriched', async () => {
    const repository = fixtureRepository();
    const options = fixtureOptions(repository);
    options.semrushRecords.push({...options.semrushRecords[0], organic_traffic: 999});

    const result = await runInitialImport(options);

    expect(result).toMatchObject({accepted: 1, unenriched: 0, rejected: 2, succeeded: 1, failed: 0});
    expect(result.errors).toContainEqual(expect.objectContaining({canonicalDomain: 'alpha.example', stage: 'validation', message: 'conflicting_semrush_observation'}));
    expect(repository.companyIds()).toEqual(['company-beta']);
  });

  it('counts duplicate Apollo input rows once each despite multiple retained rejection reasons', async () => {
    const repository = fixtureRepository();
    const options = fixtureOptions(repository);
    options.apolloRows = [options.apolloRows[0], structuredClone(options.apolloRows[0])];

    const result = await runInitialImport(options);

    expect(result).toMatchObject({accepted: 0, rejected: 2, succeeded: 0});
    expect(result.errors.filter((error) => error.canonicalDomain === 'alpha.example').map((error) => error.message))
      .toEqual(expect.arrayContaining(['duplicate_apollo_domain', 'conflicting_apollo_source_identity']));
  });

  it('clears stale evidence fingerprints and schedules every imported company for enrichment now', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/base-snapshot.json'));

    await runInitialImport(fixtureOptions(repository));
    const alpha = (await repository.getDashboardSnapshot()).companies.find((company) => company.fields['Identity • Company ID'] === 'company-alpha');

    expect(alpha?.fields).toMatchObject({
      'Workflow • Evidence Fingerprint': null,
      'Workflow • Next Insight Due At': '2026-08-18T00:00:00.000Z',
    });
  });

  it('preflights the strict record budget before performing any writes', async () => {
    const repository = fixtureRepository();
    const result = await runInitialImport({...fixtureOptions(repository), recordBudgetCounts: {companies: 995, keywords: 0, paidAds: 0, insights: 0, reviews: 0, system: 0}});

    expect(result).toMatchObject({recordBudget: {total: 1_001, withinFreeLimit: false, failure: 'record_budget_exceeded'}, succeeded: 0, failed: 0});
    expect((await repository.getDashboardSnapshot()).companies).toEqual([]);
  });

  it('conservatively includes two keyword-delete batches for eleven current records', async () => {
    const noObsolete = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'import/existing-alpha-no-keywords.json'));
    const withObsolete = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'import/eleven-obsolete-keywords.json'));

    const baseline = await runInitialImport(fixtureOptions(noObsolete));
    const estimated = await runInitialImport({...fixtureOptions(withObsolete), dryRun: false});

    expect(baseline.recordBudget.estimatedWriteCalls).toBe(4);
    expect(estimated.recordBudget.estimatedWriteCalls).toBe(6);
    expect(estimated.recordBudget.estimatedWriteCalls - baseline.recordBudget.estimatedWriteCalls).toBe(2);
  });

  it('skips dependent writes for a company whose company upsert fails while preserving successes', async () => {
    const repository = fixtureRepository();
    const failingRepository: CompetitorStore = {
      resolveCompanyIdentity: repository.resolveCompanyIdentity.bind(repository),
      replaceKeywords: repository.replaceKeywords.bind(repository),
      replacePaidAds: repository.replacePaidAds.bind(repository),
      upsertPaidAds: repository.upsertPaidAds.bind(repository),
      getDashboardSnapshot: repository.getDashboardSnapshot.bind(repository),
      getDueInsightInputs: repository.getDueInsightInputs.bind(repository),
      upsertReview: repository.upsertReview.bind(repository),
      upsertPublishedInsight: repository.upsertPublishedInsight.bind(repository),
      updateSystem: repository.updateSystem.bind(repository),
      async upsertCompanies(companies) {
        const beta = companies.find((company) => company.identity.canonicalDomain === 'beta.example');
        const accepted = companies.filter((company) => company !== beta);
        const successful = await repository.upsertCompanies(accepted);
        return {
          succeeded: successful.succeeded,
          failed: beta ? 1 : 0,
          results: [...successful.results, ...(beta ? [{identity: beta.companyId, error: 'company_write_failed'}] : [])],
        } satisfies WriteResult;
      },
    };

    const result = await runInitialImport({...fixtureOptions(repository), repository: failingRepository});

    expect(result).toMatchObject({succeeded: 1, failed: 1});
    expect(result.errors).toContainEqual(expect.objectContaining({companyId: 'company-beta', stage: 'company', message: 'company_write_failed'}));
    expect(repository.counts()).toMatchObject({companies: 1, keywords: 3, paidAds: 0});
  });

  it('resolves persisted Apollo identities before minting an ID for only new companies', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/base-snapshot.json'));
    const mintedDomains: string[] = [];

    const result = await runInitialImport({...fixtureOptions(repository), idFactory: (canonicalDomain) => {
      mintedDomains.push(canonicalDomain);
      return `company-${canonicalDomain.split('.')[0]}`;
    }});

    expect(result.succeeded).toBe(2);
    expect(mintedDomains).toEqual(['beta.example']);
    expect(repository.companyIds()).toEqual(['company-alpha', 'company-beta', 'company-existing']);
  });

  it('supports a dry run without using the repository or minting company IDs', async () => {
    const repository = fixtureRepository();
    let factoryCalls = 0;

    const result = await runInitialImport({...fixtureOptions(repository), dryRun: true, idFactory: () => {
      factoryCalls += 1;
      return 'should-not-be-used';
    }});

    expect(result).toMatchObject({accepted: 2, rejected: 1, succeeded: 0, failed: 0});
    expect(factoryCalls).toBe(0);
    expect(repository.counts()).toMatchObject({companies: 0, keywords: 0, paidAds: 0});
  });

  it('does not discard distinct Semrush database observations into one company metric group', async () => {
    const repository = fixtureRepository();
    const options = fixtureOptions(repository);
    options.semrushRecords.push({...options.semrushRecords[0], database: 'ca'});

    const result = await runInitialImport(options);

    expect(result).toMatchObject({succeeded: 1, failed: 1});
    expect(result.errors).toContainEqual(expect.objectContaining({canonicalDomain: 'alpha.example', stage: 'enrichment', message: 'multiple_current_semrush_observations_requires_selection'}));
    expect(repository.companyIds()).toEqual(['company-beta']);
  });
});
