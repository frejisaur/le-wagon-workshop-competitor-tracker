import assert from 'node:assert/strict';
import test from 'node:test';

import {getRefreshEnv, parseDotEnv} from '../../src/config/env.mjs';

test('parses quoted table names and preserves token separators', () => {
  assert.deepEqual(
    parseDotEnv([
      '# local credentials',
      'AIRTABLE_PAT=patExample.secret=value',
      'AIRTABLE_BASE_ID=appExample',
      'AIRTABLE_PAID_ADS_TABLE="Paid Ads"',
      '',
    ].join('\n')),
    {
      AIRTABLE_PAT: 'patExample.secret=value',
      AIRTABLE_BASE_ID: 'appExample',
      AIRTABLE_PAID_ADS_TABLE: 'Paid Ads',
    },
  );
});

test('reports refresh preflight variable names without returning partial secret values', () => {
  assert.deepEqual(
    getRefreshEnv({APIFY_TOKEN: 'apify-secret', AIRTABLE_PAT: 'pat-secret'}),
    {present: ['APIFY_TOKEN', 'AIRTABLE_PAT'], missing: ['AIRTABLE_BASE_ID'], values: null},
  );
});
