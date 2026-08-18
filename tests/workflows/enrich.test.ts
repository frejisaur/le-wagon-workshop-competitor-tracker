import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {CompetitorStore, WriteResult} from '@/lib/airtable/types';
import {parseSemrushPayload} from '@/lib/schemas/semrush';
import {runEnrichment} from '@/lib/workflows/enrich';

const fixtures = resolve(process.cwd(), 'tests/fixtures');
const providerRecords = parseSemrushPayload(JSON.parse(readFileSync(resolve(fixtures, 'providers/semrush-sample.json'), 'utf8'))).records;

function repository() {
  return FixtureCompetitorRepository.fromSnapshot(resolve(fixtures, 'airtable/base-snapshot.json'));
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
});
