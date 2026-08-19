import {describe, expect, it} from 'vitest';
import {AIRTABLE_SCHEMA, ensureAirtableSchema} from '@/lib/airtable/schema';
import {runAirtableSchemaCli} from '@/jobs/setup-airtable-schema';

describe('Airtable schema bootstrap', () => {
  it('defines the six serving tables with company links and typed evidence fields', () => {
    expect(AIRTABLE_SCHEMA.map((table) => table.name)).toEqual([
      'Companies', 'Keywords', 'Paid Ads', 'GTM Insights', 'Insight Reviews', 'System',
    ]);

    const companies = AIRTABLE_SCHEMA[0];
    expect(companies.fields[0]).toEqual({name: 'Identity • Company ID', type: 'singleLineText'});
    expect(companies.fields).toContainEqual({name: 'Observed • Organic Traffic', type: 'number', options: {precision: 0}});
    expect(companies.fields).toContainEqual({name: 'Calculated • Paid Activity Present', type: 'checkbox', options: {color: 'greenBright', icon: 'check'}});

    for (const table of AIRTABLE_SCHEMA.slice(1, 5)) {
      expect(table.fields).toContainEqual({name: 'Identity • Company Link', type: 'multipleRecordLinks', linkedTable: 'Companies'});
    }
  });

  it('creates only missing tables and fields without deleting or renaming existing schema', async () => {
    const requests: Array<{method: string; url: string; body?: unknown}> = [];
    let tables = [{
      id: 'tbl-companies',
      name: 'Companies',
      fields: [{id: 'fld-company', name: 'Identity • Company ID', type: 'singleLineText'}],
    }];

    const fetch: typeof globalThis.fetch = async (input, init = {}) => {
      const url = String(input);
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({method, url, body});
      if (method === 'GET') return Response.json({tables});
      if (url.endsWith('/tables')) {
        const created = {id: `tbl-${body.name}`, name: body.name, fields: body.fields.map((field: {name: string; type: string}) => ({id: `fld-${field.name}`, ...field}))};
        tables = [...tables, created];
        return Response.json(created);
      }
      const tableId = url.split('/').at(-2);
      const table = tables.find((candidate) => candidate.id === tableId)!;
      table.fields.push({id: `fld-${body.name}`, ...body});
      return Response.json(table.fields.at(-1));
    };

    const result = await ensureAirtableSchema({baseId: 'app-test', apiToken: 'secret', fetch});

    expect(result.createdTables).toEqual(['Keywords', 'Paid Ads', 'GTM Insights', 'Insight Reviews', 'System']);
    expect(result.createdFields.Companies).toBeGreaterThan(1);
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
    expect(requests.every((request) => !String(JSON.stringify(request.body)).includes('secret'))).toBe(true);
  });

  it('returns a sanitized schema summary without credential values', async () => {
    const result = await runAirtableSchemaCli({
      env: {
        AIRTABLE_PAT: 'do-not-print-token',
        AIRTABLE_BASE_ID: 'do-not-print-base',
        AIRTABLE_COMPANIES_TABLE: 'Companies',
        AIRTABLE_KEYWORDS_TABLE: 'Keywords',
        AIRTABLE_PAID_ADS_TABLE: 'Paid Ads',
        AIRTABLE_GTM_INSIGHTS_TABLE: 'GTM Insights',
        AIRTABLE_INSIGHT_REVIEWS_TABLE: 'Insight Reviews',
        AIRTABLE_SYSTEM_TABLE: 'System',
      },
      ensure: async () => ({createdTables: ['Companies'], createdFields: {Companies: 72}}),
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({status: 'succeeded', createdTables: 1, createdFields: 72});
    expect(result.stdout).not.toContain('do-not-print');
  });
});
