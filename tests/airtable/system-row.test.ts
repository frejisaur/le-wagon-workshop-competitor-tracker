import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {FixtureCompetitorRepository} from '@/lib/airtable/fixture-repository';
import {selectSystemRecord, toAirtableSystemFields} from '@/lib/airtable/system-row';
import type {SystemWireInput} from '@/lib/airtable/types';

describe('System row codec', () => {
  it('omits an unknown last-successful timestamp from production System fields and preserves it in fixture PATCH parity', async () => {
    const failed: SystemWireInput = {systemId: 'system', status: 'failed', processedCompanies: 0, succeededCompanies: 0, failedCompanies: 0};
    const fields = toAirtableSystemFields(failed);
    const repository = FixtureCompetitorRepository.fromSnapshot(resolve(process.cwd(), 'tests/fixtures/airtable/refresh-system-snapshot.json'));
    const sentinel = '2026-08-01T00:00:00.000Z';
    await repository.updateSystem({...failed, status: 'succeeded', lastSuccessfulRunAt: sentinel});
    await repository.updateSystem(failed);

    expect(fields).not.toHaveProperty('Workflow • Last Successful Run At');
    expect((await repository.getDashboardSnapshot()).system).toEqual({recordId: 'rec-system', systemId: 'system', status: 'failed', lastSuccessfulRunAt: sentinel});
    expect(repository.toSnapshot().system[0].fields).toMatchObject({'Agent • Error Summary': 'agent preserved', 'Agent • Processed Companies': 4});
  });

  it('selects the canonical System row and reads malformed values as absent', () => {
    expect(selectSystemRecord([])).toBeNull();
    expect(selectSystemRecord([
      {id: 'rec-other', fields: {'Identity • System ID': 'other', 'Workflow • Status': 'succeeded'}},
      {id: 'rec-system', fields: {'Identity • System ID': 'system', 'Workflow • Status': 'exploded', 'Workflow • Last Successful Run At': 42}},
    ])).toEqual({recordId: 'rec-system', systemId: 'system'});
    expect(selectSystemRecord([{id: 'rec-only', fields: {'Workflow • Status': 'partial'}}])).toEqual({recordId: 'rec-only', status: 'partial'});
  });

  it('uses a sanitized two-table fixture snapshot only and rejects retired tables', () => {
    const path = resolve(process.cwd(), 'tests/fixtures/airtable/base-snapshot.json');
    const before = readFileSync(path, 'utf8');
    const snapshot = JSON.parse(before) as Record<string, unknown>;
    expect(Object.keys(snapshot).sort()).toEqual(['companies', 'system']);
    expect(JSON.stringify(snapshot)).not.toMatch(/token|authorization|apollo-accounts-semrush-scraper/i);
    const repository = FixtureCompetitorRepository.fromSnapshot(path);
    expect(repository.resolveCompanyIdentity({apolloAccountId: 'acct-alpha', canonicalDomain: 'other.example'}))
      .resolves.toEqual({companyId: 'company-alpha', source: 'apollo_account_id'});
    expect(readFileSync(path, 'utf8')).toBe(before);

    const directory = mkdtempSync(join(tmpdir(), 'retired-tables-'));
    try {
      const retired = join(directory, 'six-table.json');
      writeFileSync(retired, JSON.stringify({companies: [], keywords: [], reviews: [], system: []}));
      expect(() => FixtureCompetitorRepository.fromSnapshot(retired)).toThrow('Fixture snapshot has unsupported tables: keywords, reviews');
    } finally {
      rmSync(directory, {recursive: true});
    }
  });
});
