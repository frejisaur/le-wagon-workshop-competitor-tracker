import {readFileSync} from 'node:fs';
import Papa from 'papaparse';
import {describe, expect, it, vi} from 'vitest';
import {ApifyClient} from '@/lib/apify/client';
import {loadCompletedRuns, parseRunIds} from '@/lib/apify/completed-runs';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {shapeDashboardSnapshot} from '@/lib/api/shape-landscape';
import {actorInput} from '@/lib/apify/run-domain-overview';
import {exportApolloCsv} from '@/lib/workflows/apollo-export';
import {verifyDashboard} from '@/lib/workflows/verify-dashboard';
import {runEnrichment} from '@/lib/workflows/enrich';

const observedAt = '2026-09-12T02:03:04.000Z';
const items = JSON.parse(readFileSync('tests/fixtures/providers/semrush-sample.json', 'utf8'));
const domains = ['alpha.example', 'existing.example'];
const records = [items[0], {...items[1], domain: domains[1], organic_keywords: null}];
const source = 'Company Name,Website,Apollo Account Id,Apollo Record Id,Comment\r\n"Alpha, Inc",https://www.alpha.example,acct-alpha,,"First\nline"\r\nNo website,,,,\r\nSecond,existing.example,acct-1,,"Quoted ""note"""';

function provider(overrides = {}, results = records, input = actorInput(domains)) {
  const metadata = {id: 'A', actId: 'actor', status: 'SUCCEEDED', defaultDatasetId: 'datasetA', defaultKeyValueStoreId: 'storeA', finishedAt: observedAt, ...overrides};
  return new ApifyClient({token: 'fixture', fetch: async (url, init) => {
    expect(init?.method).toBe('GET');
    const path = new URL(String(url)).pathname;
    if (path.endsWith('/acts/pro100chok~semrush-scraper')) return Response.json({data: {id: 'actor'}});
    if (path.endsWith('/actor-runs/A')) return Response.json({data: metadata});
    if (path.endsWith('/storeA/records/INPUT')) return Response.json(input);
    if (path.endsWith('/datasets/datasetA/items')) return Response.json(results, {headers: {
      'X-Apify-Pagination-Offset': '0', 'X-Apify-Pagination-Limit': '1000', 'X-Apify-Pagination-Count': String(results.length), 'X-Apify-Pagination-Total': String(results.length),
    }});
    throw new Error('unexpected request');
  }});
}

describe('completed Actor run ingestion and saved CSV', () => {
  it('rejects invalid IDs, wrong Actor, status, settings and mismatched domain partitions', async () => {
    for (const value of ['', 'A,A', 'A/evil']) expect(() => parseRunIds(value)).toThrow();
    for (const client of [provider({actId: 'other'}), provider({status: 'RUNNING'}), provider({id: 'B'}),
      provider({}, records, {...actorInput(domains), include_moz: true}), provider({}, records, actorInput(['other.example']))]) {
      await expect(loadCompletedRuns(client, ['A'], domains, new AbortController().signal)).rejects.toThrow();
    }
  });

  it('preserves the failed row, retries from identical provenance, and exports the persisted dashboard values', async () => {
    const repo = FixtureCompetitorRepository.fromSnapshot('tests/fixtures/airtable/base-snapshot.json');
    const original = repo.toSnapshot();
    const run = (client = provider()) => runEnrichment({repository: repo, runIdFactory: () => 'apify-A', maxAttempts: 1,
      completedRuns: (expected, signal) => loadCompletedRuns(client, ['A'], expected, signal)});
    const baseWrite = repo.writeCompanyEvidence.bind(repo);
    const writer = vi.spyOn(repo, 'writeCompanyEvidence').mockImplementation((company, fingerprint) => {
      if (company.identity.canonicalDomain === domains[1]) throw new Error('interrupted');
      return baseWrite(company, fingerprint);
    });
    expect(await run()).toMatchObject({status: 'partial', succeeded: 1, failed: 1});
    expect(repo.toSnapshot().companies[1]).toEqual(original.companies[1]);
    writer.mockRestore();
    expect(await run()).toMatchObject({status: 'succeeded', succeeded: 2});
    const snapshot = await repo.getDashboardSnapshot();
    const before = exportApolloCsv(source, snapshot);
    const {landscape, companies} = shapeDashboardSnapshot(snapshot);
    expect(landscape.status).toBe('succeeded');
    const [alpha] = snapshot.companies;
    const api = companies.get('company-alpha')!;
    expect(alpha.fields['Observed • Raw Ref']).toBe('https://api.apify.com/v2/datasets/datasetA/items?offset=0&limit=1');
    expect(api.kpis.authorityScore).toMatchObject({value: records[0].authority_score, observedAt});
    expect(api.kpis.organicTraffic.value).toBe(records[0].organic_traffic);
    const serve = (detail: unknown): typeof fetch => async url => Response.json(String(url).endsWith('/api/dashboard') ? landscape : detail);
    await expect(verifyDashboard('https://dashboard.example', snapshot, {fetch: serve(api), attempts: 1})).resolves.toEqual(landscape.freshness);
    await expect(verifyDashboard('https://dashboard.example', snapshot, {fetch: serve({...api, enrichedAt: observedAt.replace('2026', '2020')}), attempts: 1})).rejects.toThrow('dashboard_snapshot_mismatch');
    const csv = Papa.parse<Record<string,string>>(before.csv, {header: true}).data;
    expect(csv[0]).toMatchObject({'Company Name': 'Alpha, Inc', Comment: 'First\nline', 'Paid Traffic': '0', 'Observation Time': observedAt,
      'Organic Traffic': String(api.kpis.organicTraffic.value), 'Authority Score': String(api.kpis.authorityScore.value)});
    expect(csv[1]).toMatchObject({'Match Status': 'missing_apollo_website', 'Paid Traffic': '', 'Observation Time': ''});
    expect(csv[2]).toMatchObject({'Organic Keywords': '', Comment: 'Quoted "note"'});
    expect(await run()).toMatchObject({status: 'succeeded'});
    expect(exportApolloCsv(source, await repo.getDashboardSnapshot())).toEqual(before);
    expect(repo.toSnapshot().companies.map(row => row.id)).toEqual(original.companies.map(row => row.id));
    expect(repo.toSnapshot().system[0].fields['Refresh • Run ID']).toBe('apify-A');
    const previous = repo.toSnapshot().companies[1];
    expect(await run(provider({}, [records[0]]))).toMatchObject({status: 'partial', failed: 1});
    expect(repo.toSnapshot().companies[1]).toEqual(previous);
    expect(await run(provider({finishedAt: '2020-01-01T00:00:00.000Z'}))).toMatchObject({status: 'failed'});
    expect(repo.toSnapshot().companies[1]).toEqual(previous);
  });

  it('explains conflicting Apollo domains and stored identities while retaining original cells', async () => {
    const repo = FixtureCompetitorRepository.fromSnapshot('tests/fixtures/airtable/base-snapshot.json');
    const csv = source.replace('acct-1', 'wrong-account') + '\r\nOther,alpha.example,,,';
    const exported = exportApolloCsv(csv, await repo.getDashboardSnapshot());
    expect(Papa.parse<Record<string,string>>(exported.csv, {header: true}).data.map(row => row['Match Status']))
      .toEqual(['duplicate_apollo_domain', 'missing_apollo_website', 'stored_identity_conflict', 'duplicate_apollo_domain']);
  });
});
