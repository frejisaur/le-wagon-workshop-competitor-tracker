import assert from 'node:assert/strict';
import test from 'node:test';

import {AirtableRecordsClient, AirtableRefreshRepository} from '../../src/airtable/refresh-repository.mjs';

function response(body) {
  return new Response(JSON.stringify(body), {status: 200, headers: {'content-type': 'application/json'}});
}

test('updates existing Company records in Airtable batches without touching insight tables', async () => {
  const requests = [];
  const client = new AirtableRecordsClient({
    baseId: 'app-test',
    token: 'pat-test.secret',
    fetchFn: async (input, init) => {
      requests.push({input, init});
      return response({records: []});
    },
  });
  const repository = new AirtableRefreshRepository({client});
  const records = Array.from({length: 11}, (_, index) => ({
    recordId: `rec-${index}`, companyId: `company-${index}`, fields: {'Organic Traffic': index},
  }));

  await repository.upsertCompanies(records);

  assert.equal(requests.length, 2);
  assert.match(requests[0].input, /\/Companies$/);
  assert.equal(JSON.parse(requests[0].init.body).records.length, 10);
  assert.equal(JSON.parse(requests[1].init.body).records.length, 1);
  assert.equal(requests.some((request) => request.input.includes('GTM%20Insights')), false);
  assert.equal(requests.some((request) => request.init.headers.Authorization.includes('pat-test.secret')), true);
});
