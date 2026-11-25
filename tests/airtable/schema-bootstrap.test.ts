import {describe, expect, it} from 'vitest';
import {COMPANY_ROW_FIELDS, toCompanyFields} from '@/lib/airtable/company-row';
import {toAirtableSystemFields} from '@/lib/airtable/system-row';
import {AIRTABLE_SCHEMA, ensureAirtableSchema} from '@/lib/airtable/schema';
import {runAirtableSchemaCli} from '@/jobs/setup-airtable-schema';

describe('Airtable schema bootstrap', () => {
  it('defines two serving tables with typed evidence fields and no link fields', () => {
    expect(AIRTABLE_SCHEMA.map((table) => table.name)).toEqual(['Companies', 'System']);

    const [companies, system] = AIRTABLE_SCHEMA;
    expect(companies.fields[0]).toEqual({name: 'Identity • Company ID', type: 'singleLineText'});
    expect(companies.fields).toContainEqual({name: 'Observed • Organic Traffic', type: 'number', options: {precision: 0}});
    expect(companies.fields).toContainEqual({name: 'Calculated • Paid Activity Present', type: 'checkbox', options: {color: 'greenBright', icon: 'check'}});
    for (const name of ['Observed • Keywords JSON', 'Observed • Paid Ads JSON', 'Inferred • Battlecard JSON', 'Review • Candidate JSON', 'Review • Notes']) {
      expect(companies.fields).toContainEqual({name, type: 'multilineText'});
    }
    expect(AIRTABLE_SCHEMA.flatMap((table) => table.fields).map((field) => field.type)).not.toContain('multipleRecordLinks');
    for (const table of AIRTABLE_SCHEMA) expect(new Set(table.fields.map((field) => field.name)).size).toBe(table.fields.length);
    expect(system.fields[0]).toEqual({name: 'Identity • System ID', type: 'singleLineText'});
  });

  it('declares every field the Companies and System codecs write', () => {
    const declared = (index: number) => new Set(AIRTABLE_SCHEMA[index].fields.map((field) => field.name));
    const companyFields = declared(0);
    for (const name of Object.values(COMPANY_ROW_FIELDS)) expect(companyFields.has(name), name).toBe(true);
    for (const name of Object.keys(toCompanyFields({companyId: 'company-alpha', identity: {canonicalDomain: 'alpha.example', apolloAccountId: '', apolloRecordId: ''}, qualityIssues: []}))) expect(companyFields.has(name), name).toBe(true);
    const systemFields = declared(1);
    for (const name of Object.keys(toAirtableSystemFields({systemId: 'system', status: 'succeeded', processedCompanies: 0, succeededCompanies: 0, failedCompanies: 0, lastSuccessfulRunAt: null}))) expect(systemFields.has(name), name).toBe(true);
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

    expect(result.createdTables).toEqual(['System']);
    const replay = await ensureAirtableSchema({baseId: 'app-test', apiToken: 'secret', fetch});
    expect(replay).toEqual({createdTables: [], createdFields: {Companies: 0, System: 0}});
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
      },
      ensure: async () => ({createdTables: ['Companies'], createdFields: {Companies: 72}}),
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({status: 'succeeded', createdTables: 1, createdFields: 72});
    expect(result.stdout).not.toContain('do-not-print');
  });
});
