import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {CompetitorStore, WriteResult} from '@/lib/airtable/types';
import {buildEvidencePackage} from '@/lib/agents/evidence/build-package';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {transformSemrushCompany} from '@/lib/transforms/semrush-to-domain';
import {runEnrichment} from '@/lib/workflows/enrich';

const fixtures = resolve(process.cwd(), 'tests/fixtures');
const providerRecords = parseSemrushPayload(JSON.parse(readFileSync(resolve(fixtures, 'providers/semrush-sample.json'), 'utf8'))).records;

function repository() {
  return FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/base-snapshot.json'));
}

function alphaPaidAds(observedAt = '2026-08-01T00:00:00.000Z') {
  const paidRecord = structuredClone(providerRecords[1]);
  paidRecord.domain = 'alpha.example';
  return transformSemrushCompany(paidRecord, {
    companyId: 'company-alpha',
    identity: {canonicalDomain: 'alpha.example', apolloAccountId: 'acct-alpha', apolloRecordId: ''},
    observedAt,
    calculatedAt: observedAt,
  }).paidAds;
}

function dependencies(store: CompetitorStore, runDomainOverview: (domains: string[]) => Promise<unknown[]> = async () => providerRecords) {
  const callOrder: string[] = [];
  const wrapped = Object.create(store) as CompetitorStore;
  wrapped.updateSystem = async (input) => {
    callOrder.push(`system:${input.status}`);
    return store.updateSystem(input);
  };
  return {
    callOrder,
    dependencies: {
      repository: wrapped,
      runDomainOverview: async (domains: string[]) => {
        callOrder.push(`apify:${domains.join(',')}`);
        return runDomainOverview(domains);
      },
      cache: {invalidate: async () => { callOrder.push('cache:invalidate'); }},
      now: () => new Date('2026-08-18T12:00:00.000Z'),
      runIdFactory: () => 'railway-run-1',
    },
  };
}

describe('runEnrichment', () => {
  it('persists validated partial successes independently in canonical-domain order and updates only Railway status', async () => {
    const store = repository();
    const batchCalls: string[][] = [];
    const {dependencies: deps} = dependencies(store, async (domains) => {
      batchCalls.push(domains);
      if (domains.includes('existing.example')) throw new Error('provider unavailable');
      return providerRecords;
    });

    const report = await runEnrichment({batchSize: 1, maxAttempts: 1, timeoutMs: 100, ...deps});
    const snapshot = await store.getDashboardSnapshot();
    const alpha = snapshot.companies.find((record) => record.fields['Identity • Company ID'] === 'company-alpha');

    expect(batchCalls).toEqual([['alpha.example'], ['existing.example']]);
    expect(report).toMatchObject({runId: 'railway-run-1', status: 'partial', processed: 2, succeeded: 1, failed: 1, cacheInvalidated: true});
    expect(alpha?.fields['Workflow • Evidence Fingerprint']).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.publishedInsights).toEqual([]);
    expect(snapshot.reviews).toEqual([]);
  });

  it('retries failed batches, validates every dataset item, and never persists raw provider objects', async () => {
    const store = repository();
    let attempts = 0;
    const {dependencies: deps} = dependencies(store, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary failure');
      return [providerRecords[0], {domain: 'existing.example', unexpected: 'raw payload'}];
    });

    const report = await runEnrichment({batchSize: 2, maxAttempts: 2, retryDelayMs: 0, timeoutMs: 100, ...deps});
    const snapshot = await store.getDashboardSnapshot();
    const stored = snapshot.companies.find((record) => record.fields['Identity • Company ID'] === 'company-alpha');

    expect(attempts).toBe(2);
    expect(report).toMatchObject({status: 'partial', processed: 2, succeeded: 1, failed: 1});
    expect(report.errors).toContainEqual(expect.objectContaining({companyId: 'company-existing', code: 'invalid_provider_record'}));
    expect(JSON.stringify(stored)).not.toContain('raw payload');
  });

  it('does not invalidate on failed persistence or terminal System updates and retries terminal cleanup', async () => {
    const store = repository();
    const invalidate = vi.fn(async () => {});
    let terminalWrites = 0;
    const failing = Object.create(store) as CompetitorStore;
    failing.upsertCompanies = async (companies) => ({succeeded: 0, failed: companies.length, results: companies.map((company) => ({identity: company.companyId, error: 'write_failed'}))}) satisfies WriteResult;
    failing.updateSystem = async (input) => {
      if (input.status !== 'running') {
        terminalWrites += 1;
        if (terminalWrites === 1) throw new Error('terminal write failed');
      }
      return store.updateSystem(input);
    };

    const report = await runEnrichment({repository: failing, runDomainOverview: async () => [providerRecords[0]], cache: {invalidate}, now: () => new Date('2026-08-18T12:00:00.000Z'), runIdFactory: () => 'railway-run-2'});
    const system = (await store.getDashboardSnapshot()).system[0];

    expect(report).toMatchObject({status: 'failed', cacheInvalidated: false});
    expect(invalidate).not.toHaveBeenCalled();
    expect(terminalWrites).toBe(2);
    expect(system.fields['Workflow • Status']).toBe('failed');
  });

  it('does not invalidate cache after a failed intended terminal publication even when failed-state recovery succeeds', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    const invalidate = vi.fn(async () => {});
    const statuses: string[] = [];
    let terminalWrites = 0;
    const failing = Object.create(store) as CompetitorStore;
    failing.updateSystem = async (input) => {
      statuses.push(input.status);
      if (input.status !== 'running' && terminalWrites++ === 0) return {succeeded: 0, failed: 1, results: [{identity: 'system', error: 'unavailable'}]};
      return store.updateSystem(input);
    };

    const report = await runEnrichment({repository: failing, runDomainOverview: async () => [providerRecords[0]], cache: {invalidate}});

    expect(report).toMatchObject({status: 'failed', cacheInvalidated: false});
    expect(statuses).toEqual(['running', 'succeeded', 'failed']);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('orders running, writes, terminal System transition, then cache invalidation', async () => {
    const store = repository();
    const {callOrder, dependencies: deps} = dependencies(store, async () => [providerRecords[0]]);
    await runEnrichment({batchSize: 2, ...deps});

    expect(callOrder).toEqual(['system:running', 'apify:alpha.example,existing.example', 'system:partial', 'cache:invalidate']);
  });

  it('never overwrites agent workflow fields and does not invalidate an all-failed provider refresh', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    const invalidate = vi.fn(async () => {});
    const report = await runEnrichment({repository: store, runDomainOverview: async () => { throw new Error('offline'); }, cache: {invalidate}, maxAttempts: 1, now: () => new Date('2026-08-18T12:00:00.000Z'), runIdFactory: () => 'railway-run-3'});
    const system = (await store.getDashboardSnapshot()).system[0];

    expect(report).toMatchObject({status: 'failed', succeeded: 0, failed: 1, cacheInvalidated: false});
    expect(invalidate).not.toHaveBeenCalled();
    expect(system.fields).toMatchObject({
      'Railway • Run ID': 'railway-run-3',
      'Agent • Last Run At': '2026-08-01T00:00:00.000Z',
      'Agent • Skill Version': '1.0.0',
      'Agent • Processed Companies': 4,
      'Agent • Review Count': 2,
      'Agent • Error Summary': 'agent preserved',
    });
  });

  it('keeps startup failures failed instead of recomputing them as succeeded', async () => {
    const store = repository();
    const failing = Object.create(store) as CompetitorStore;
    failing.getDashboardSnapshot = async () => { throw new Error('snapshot unavailable'); };
    const report = await runEnrichment({repository: failing, runDomainOverview: async () => providerRecords, runIdFactory: () => 'railway-startup-snapshot'});
    const system = (await store.getDashboardSnapshot()).system[0];

    expect(report.status).toBe('failed');
    expect(system.fields).toMatchObject({'Workflow • Status': 'failed', 'Railway • Run ID': 'railway-startup-snapshot'});
    expect(system.fields).not.toHaveProperty('Workflow • Last Successful Run At');
  });

  it('omits an unknown last-successful timestamp after snapshot startup failure and preserves fixture state', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    const sentinel = '2026-08-01T00:00:00.000Z';
    await store.updateSystem({systemId: 'system', lastSuccessfulRunAt: sentinel, status: 'succeeded', processedCompanies: 1, succeededCompanies: 1, failedCompanies: 0});
    const inputs: Array<Record<string, unknown>> = [];
    const failing = Object.create(store) as CompetitorStore;
    failing.getDashboardSnapshot = async () => { throw new Error('snapshot unavailable'); };
    failing.updateSystem = async (input) => {
      inputs.push(input);
      return store.updateSystem(input);
    };

    const report = await runEnrichment({repository: failing, runDomainOverview: async () => providerRecords});
    const system = (await store.getDashboardSnapshot()).system[0];

    expect(report.status).toBe('failed');
    expect(inputs).toEqual([expect.not.objectContaining({lastSuccessfulRunAt: expect.anything()})]);
    expect(inputs[0]).not.toHaveProperty('lastSuccessfulRunAt');
    expect(system.fields['Workflow • Last Successful Run At']).toBe(sentinel);
  });

  it('keeps a running-System write failure failed and still attempts a non-running terminal state', async () => {
    const store = repository();
    const statuses: string[] = [];
    const failing = Object.create(store) as CompetitorStore;
    failing.updateSystem = async (input) => {
      statuses.push(input.status);
      if (input.status === 'running') return {succeeded: 0, failed: 1, results: [{identity: 'system', error: 'unavailable'}]};
      return store.updateSystem(input);
    };
    const report = await runEnrichment({repository: failing, runDomainOverview: async () => providerRecords});

    expect(report.status).toBe('failed');
    expect(statuses).toEqual(['running', 'failed']);
  });

  it('reconciles System to failed after cache rejection without advancing last-successful time', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    const statuses: string[] = [];
    const wrapped = Object.create(store) as CompetitorStore;
    wrapped.updateSystem = async (input) => { statuses.push(input.status); return store.updateSystem(input); };
    const report = await runEnrichment({repository: wrapped, runDomainOverview: async () => [providerRecords[0]], cache: {invalidate: async () => { throw new Error('cache unavailable'); }}, now: () => new Date('2026-08-18T12:00:00.000Z')});
    const system = (await store.getDashboardSnapshot()).system[0];

    expect(report).toMatchObject({status: 'failed', cacheInvalidated: false});
    expect(statuses).toEqual(['running', 'succeeded', 'failed']);
    expect(system.fields).toMatchObject({'Workflow • Status': 'failed', 'Workflow • Last Successful Run At': null});
  });

  it('permanently poisons duplicate dataset domains, bounds unexpected-item audits, and persists none', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    const unexpected = Array.from({length: 12}, (_, index) => ({...providerRecords[0], domain: `unexpected-${index}.example`}));
    const report = await runEnrichment({repository: store, runDomainOverview: async () => [providerRecords[0], providerRecords[0], providerRecords[0], ...unexpected]});

    expect(report).toMatchObject({status: 'failed', succeeded: 0, failed: 1});
    expect(report.errors.filter((error) => error.code === 'duplicate_dataset_item')).toHaveLength(1);
    expect(report.errors.filter((error) => error.code === 'unexpected_dataset_item')).toHaveLength(10);
    expect(JSON.stringify(report.errors)).not.toContain('unexpected-');
  });

  it('continues later companies after a thrown store operation and leaves the partially written company fingerprint invalid', async () => {
    const store = repository();
    const failing = Object.create(store) as CompetitorStore;
    let calls = 0;
    failing.upsertCompanies = async (companies) => {
      calls += 1;
      if (calls === 1) throw new Error('store unavailable');
      return store.upsertCompanies(companies);
    };
    const existing = structuredClone(providerRecords[0]);
    existing.domain = 'existing.example';
    const report = await runEnrichment({repository: failing, batchSize: 1, runDomainOverview: async (domains) => domains[0] === 'alpha.example' ? [providerRecords[0]] : [existing]});
    const snapshot = await store.getDashboardSnapshot();
    const alpha = snapshot.companies.find((record) => record.fields['Identity • Company ID'] === 'company-alpha');
    const existingCompany = snapshot.companies.find((record) => record.fields['Identity • Company ID'] === 'company-existing');

    expect(report).toMatchObject({status: 'partial', succeeded: 1, failed: 1});
    expect(alpha?.fields['Workflow • Evidence Fingerprint']).toBe('fixture-fingerprint-alpha');
    expect(existingCompany?.fields['Workflow • Evidence Fingerprint']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('replaces empty paid-ad evidence before fingerprinting the freshly prepared package', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    await store.replacePaidAds('company-alpha', alphaPaidAds());
    const noAds = structuredClone(providerRecords[0]);
    noAds.paid = {...noAds.paid!, top_ads: []};
    const report = await runEnrichment({repository: store, runDomainOverview: async () => [noAds], now: () => new Date('2026-08-18T12:00:00.000Z')});
    const snapshot = await store.getDashboardSnapshot();
    const company = snapshot.companies[0];
    const expected = fingerprintEvidence(buildEvidencePackage({company, keywords: snapshot.keywords, paidAds: snapshot.paidAds, publishedInsight: undefined, review: undefined}));

    expect(report.status).toBe('succeeded');
    expect(snapshot.paidAds).toEqual([]);
    expect(company.fields['Workflow • Evidence Fingerprint']).toBe(expected);
  });

  it('does not delete old paid ads or mark evidence current when the replacement write fails', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    await store.replacePaidAds('company-alpha', alphaPaidAds());
    const failing = Object.create(store) as CompetitorStore;
    failing.replacePaidAds = async () => ({succeeded: 0, failed: 1, results: [{identity: 'company-alpha', error: 'paid_ad_write_failed'}]});
    const noAds = structuredClone(providerRecords[0]);
    noAds.paid = {...noAds.paid!, top_ads: []};

    const report = await runEnrichment({repository: failing, runDomainOverview: async () => [noAds]});
    const snapshot = await store.getDashboardSnapshot();

    expect(report).toMatchObject({status: 'failed', succeeded: 0, failed: 1});
    expect(snapshot.paidAds).toHaveLength(1);
    expect(snapshot.companies[0].fields['Workflow • Evidence Fingerprint']).toBeNull();
  });

  it('deletes paid ads only for the refreshed company', async () => {
    const store = repository();
    await store.replacePaidAds('company-alpha', alphaPaidAds());
    const otherPaidRecord = structuredClone(providerRecords[1]);
    otherPaidRecord.domain = 'existing.example';
    const otherAds = transformSemrushCompany(otherPaidRecord, {
      companyId: 'company-existing',
      identity: {canonicalDomain: 'existing.example', apolloAccountId: 'acct-existing', apolloRecordId: ''},
      observedAt: '2026-08-01T00:00:00.000Z',
      calculatedAt: '2026-08-01T00:00:00.000Z',
    }).paidAds;
    await store.replacePaidAds('company-existing', otherAds);
    const noAds = structuredClone(providerRecords[0]);
    noAds.paid = {...noAds.paid!, top_ads: []};

    await runEnrichment({repository: store, runDomainOverview: async () => [noAds]});
    const snapshot = await store.getDashboardSnapshot();

    expect(snapshot.paidAds.filter((record) => record.fields['Identity • Company ID'] === 'company-alpha')).toEqual([]);
    expect(snapshot.paidAds.filter((record) => record.fields['Identity • Company ID'] === 'company-existing')).toHaveLength(otherAds.length);
  });

  it('converges to the same paid-ad snapshot and fingerprint when a failed replacement is retried', async () => {
    const store = FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/refresh-system-snapshot.json'));
    await store.replacePaidAds('company-alpha', alphaPaidAds());
    const failing = Object.create(store) as CompetitorStore;
    failing.replacePaidAds = async () => ({succeeded: 0, failed: 1, results: [{identity: 'company-alpha', error: 'paid_ad_write_failed'}]});
    const noAds = structuredClone(providerRecords[0]);
    noAds.paid = {...noAds.paid!, top_ads: []};

    await runEnrichment({repository: failing, runDomainOverview: async () => [noAds], now: () => new Date('2026-08-18T12:00:00.000Z')});
    const retry = await runEnrichment({repository: store, runDomainOverview: async () => [noAds], now: () => new Date('2026-08-18T12:00:00.000Z')});
    const snapshot = await store.getDashboardSnapshot();
    const company = snapshot.companies[0];
    const expected = fingerprintEvidence(buildEvidencePackage({company, keywords: snapshot.keywords, paidAds: snapshot.paidAds, publishedInsight: undefined, review: undefined}));

    expect(retry).toMatchObject({status: 'succeeded', succeeded: 1, failed: 0});
    expect(snapshot.paidAds).toEqual([]);
    expect(company.fields['Workflow • Evidence Fingerprint']).toBe(expected);
  });

  it('rejects non-integer or above-cap workflow controls', async () => {
    const store = repository();
    const base = {repository: store, runDomainOverview: async () => providerRecords};
    await expect(runEnrichment({...base, batchSize: 11})).rejects.toThrow('batchSize');
    await expect(runEnrichment({...base, maxAttempts: Number.NaN})).rejects.toThrow('maxAttempts');
    await expect(runEnrichment({...base, timeoutMs: 1.5})).rejects.toThrow('timeoutMs');
    await expect(runEnrichment({...base, timeoutMs: 120_001})).rejects.toThrow('timeoutMs');
  });
});
