import {describe, expect, it} from 'vitest';
import {AirtableCompetitorRepository} from '@/lib/airtable/repository';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import type {AirtableClient} from '@/lib/airtable/client';
import type {AirtableFields, AirtableRecord, AirtableTable} from '@/lib/airtable/types';
import type {CuratedPaidAd} from '@/lib/domain/metrics';

function paidAd(id: string, companyId = 'company-alpha', observedAt = '2026-03-03T00:00:00.000Z'): CuratedPaidAd {
  return {
    observed: {classification: 'observed', source: 'semrush', observedAt, database: 'us', keyword: id, title: 'Sanitized title', description: 'Sanitized description', visibleUrl: 'alpha.example', landingUrl: `https://alpha.example/${id}`, position: 1, previousPosition: null, volume: null, cpcUsd: null, keywordDifficulty: null, competition: null, traffic: null, trafficSharePct: null, trafficCostUsd: null},
    calculated: {classification: 'calculated', inputs: ['companyId'], calculatedAt: observedAt, companyId, paidAdId: id, normalizedLandingUrl: `https://alpha.example/${id}`},
  };
}

type FakeState = {companies: AirtableRecord[]; paidAds: AirtableRecord[]; operations: string[]; failWrites?: boolean};

function productionRepository(state: FakeState): AirtableCompetitorRepository {
  const client = {
    list: async (table: AirtableTable, options?: {filterByFormula?: string}) => {
      if (table === 'Companies') return structuredClone(state.companies);
      if (table !== 'Paid Ads') return [];
      const companyId = options?.filterByFormula?.match(/='([^']+)'/)?.[1];
      return structuredClone(companyId ? state.paidAds.filter((record) => record.fields['Identity • Company ID'] === companyId) : state.paidAds);
    },
    create: async (table: AirtableTable, writes: Array<{fields: AirtableFields}>) => {
      state.operations.push(`create:${table}`);
      if (state.failWrites) throw new Error('write failed');
      const records = writes.map((write, index) => ({id: `rec-created-${index}`, fields: structuredClone(write.fields)}));
      if (table === 'Paid Ads') state.paidAds.push(...records);
      return records;
    },
    update: async (table: AirtableTable, writes: Array<{id?: string; fields: AirtableFields}>) => {
      state.operations.push(`update:${table}`);
      if (state.failWrites) throw new Error('write failed');
      for (const write of writes) {
        const record = state.paidAds.find((item) => item.id === write.id);
        if (record) record.fields = {...record.fields, ...structuredClone(write.fields)};
      }
      return writes.map((write) => ({id: write.id!, fields: {}}));
    },
    delete: async (table: AirtableTable, recordIds: string[]) => {
      state.operations.push(`delete:${table}:${recordIds.join(',')}`);
      if (table === 'Paid Ads') state.paidAds = state.paidAds.filter((record) => !recordIds.includes(record.id));
      return recordIds.map((id) => ({id, fields: {}}));
    },
  } as unknown as AirtableClient;
  return new AirtableCompetitorRepository(client);
}

function stateWithPaidAds(paidAds: AirtableRecord[]): FakeState {
  return {companies: [{id: 'rec-company-alpha', fields: {'Identity • Company ID': 'company-alpha'}}], paidAds, operations: []};
}

describe('CompetitorStore.replacePaidAds', () => {
  it('writes a complete scoped replacement before deleting only obsolete paid ads and preserves retained chronology', async () => {
    const state = stateWithPaidAds([
      {id: 'rec-retained', fields: {'Identity • Paid Ad ID': 'ad-retained', 'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha'], 'Observed • First Observed At': '2025-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2025-01-01T00:00:00.000Z'}},
      {id: 'rec-obsolete', fields: {'Identity • Paid Ad ID': 'ad-obsolete', 'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha']}},
      {id: 'rec-beta', fields: {'Identity • Paid Ad ID': 'ad-beta', 'Identity • Company ID': 'company-beta', 'Identity • Company Link': ['rec-company-beta']}},
    ]);
    const repository = productionRepository(state);

    await expect(repository.replacePaidAds('company-alpha', [paidAd('ad-retained'), paidAd('ad-new')])).resolves.toMatchObject({succeeded: 2, failed: 0});

    expect(state.operations).toEqual(['create:Paid Ads', 'update:Paid Ads', 'delete:Paid Ads:rec-obsolete']);
    expect(state.paidAds.map((record) => record.id).sort()).toEqual(['rec-beta', 'rec-created-0', 'rec-retained'].sort());
    expect(state.paidAds.find((record) => record.id === 'rec-retained')?.fields).toMatchObject({'Observed • First Observed At': '2025-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});

    state.operations.length = 0;
    await expect(repository.replacePaidAds('company-alpha', [paidAd('ad-retained'), paidAd('ad-new')])).resolves.toMatchObject({succeeded: 2, failed: 0});
    expect(state.operations).toEqual(['update:Paid Ads']);
  });

  it('supports an empty replacement without deleting records from another company', async () => {
    const state = stateWithPaidAds([
      {id: 'rec-alpha', fields: {'Identity • Paid Ad ID': 'ad-alpha', 'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha']}},
      {id: 'rec-beta', fields: {'Identity • Paid Ad ID': 'ad-beta', 'Identity • Company ID': 'company-beta', 'Identity • Company Link': ['rec-company-beta']}},
    ]);

    await expect(productionRepository(state).replacePaidAds('company-alpha', [])).resolves.toMatchObject({succeeded: 0, failed: 0});
    expect(state.operations).toEqual(['delete:Paid Ads:rec-alpha']);
    expect(state.paidAds.map((record) => record.id)).toEqual(['rec-beta']);
  });

  it('fails closed before mutation for ambiguous companies, mismatched or duplicate incoming identities, duplicate stored identities, and missing stored links', async () => {
    const cases: Array<{name: string; state: FakeState; ads: CuratedPaidAd[]; error: string}> = [
      {name: 'ambiguous company', state: {companies: [{id: 'rec-one', fields: {'Identity • Company ID': 'company-alpha'}}, {id: 'rec-two', fields: {'Identity • Company ID': 'company-alpha'}}], paidAds: [], operations: []}, ads: [], error: 'duplicate_company_records'},
      {name: 'mismatched incoming company', state: stateWithPaidAds([]), ads: [paidAd('ad-one', 'company-beta')], error: 'paid_ad_company_mismatch'},
      {name: 'duplicate incoming identity', state: stateWithPaidAds([]), ads: [paidAd('ad-one'), paidAd('ad-one')], error: 'duplicate_incoming_paid_ad_identity'},
      {name: 'duplicate stored identity', state: stateWithPaidAds([{id: 'rec-one', fields: {'Identity • Paid Ad ID': 'ad-one', 'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha']}}, {id: 'rec-two', fields: {'Identity • Paid Ad ID': 'ad-one', 'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha']}}]), ads: [paidAd('ad-one')], error: 'duplicate_existing_paid_ad_identity'},
      {name: 'missing stored link', state: stateWithPaidAds([{id: 'rec-one', fields: {'Identity • Paid Ad ID': 'ad-one', 'Identity • Company ID': 'company-alpha'}}]), ads: [paidAd('ad-one')], error: 'paid_ad_company_link_mismatch'},
    ];

    for (const testCase of cases) {
      const result = await productionRepository(testCase.state).replacePaidAds('company-alpha', testCase.ads);
      expect(result, testCase.name).toMatchObject({succeeded: 0, failed: 1, results: [{identity: 'company-alpha', error: testCase.error}]});
      expect(testCase.state.operations, testCase.name).toEqual([]);
    }
  });

  it('keeps old scoped records when an incoming write fails', async () => {
    const state = stateWithPaidAds([{id: 'rec-old', fields: {'Identity • Paid Ad ID': 'ad-old', 'Identity • Company ID': 'company-alpha', 'Identity • Company Link': ['rec-company-alpha']}}]);
    state.failWrites = true;

    const result = await productionRepository(state).replacePaidAds('company-alpha', [paidAd('ad-new')]);

    expect(result).toMatchObject({succeeded: 0, failed: 1});
    expect(state.operations).toEqual(['create:Paid Ads']);
    expect(state.paidAds.map((record) => record.id)).toEqual(['rec-old']);
  });

  it('matches the production replacement contract in the sanitized fixture repository', async () => {
    const repository = FixtureCompetitorRepository.fromSnapshot(`${process.cwd()}/tests/fixtures/airtable/base-snapshot.json`);
    await repository.upsertPaidAds([paidAd('ad-retained', 'company-alpha', '2025-01-01T00:00:00.000Z'), paidAd('ad-obsolete')]);

    await expect(repository.replacePaidAds('company-alpha', [paidAd('ad-retained', 'company-alpha', '2026-03-03T00:00:00.000Z')])).resolves.toMatchObject({succeeded: 1, failed: 0});
    const ads = (await repository.getDashboardSnapshot()).paidAds;
    expect(ads).toHaveLength(1);
    expect(ads[0].fields).toMatchObject({'Identity • Paid Ad ID': 'ad-retained', 'Observed • First Observed At': '2025-01-01T00:00:00.000Z', 'Observed • Last Observed At': '2026-03-03T00:00:00.000Z'});

    await repository.replacePaidAds('company-alpha', []);
    expect((await repository.getDashboardSnapshot()).paidAds).toEqual([]);
  });
});
