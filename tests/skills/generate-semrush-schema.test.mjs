import assert from 'node:assert/strict';
import test from 'node:test';

import {buildSchemaDocument} from '../../.agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs';

test('documents observed paths, types, coverage, cardinality, and formats', () => {
  const records = [
    {
      domain: 'alpha.example',
      enabled: false,
      metric: 10,
      only_null: null,
      organic: {
        top_keywords: [
          {keyword: 'alpha', cpc: '1.6k', share: '3%', url: 'https://alpha.example/page'},
        ],
      },
      tags: [],
    },
    {
      domain: 'beta.example',
      enabled: false,
      metric: null,
      only_null: null,
      organic: {
        top_keywords: [
          {keyword: 'beta', cpc: '2', share: null, url: 'https://beta.example/page'},
          {keyword: 'gamma', cpc: '2.5k', share: '4%', url: null},
        ],
      },
      tags: ['sample'],
    },
  ];

  const document = buildSchemaDocument(records, {
    sourceName: 'fixture.json',
    sourceBytes: 123,
    sourceSha256: 'abc123',
  });

  assert.match(document, /^# Observed Semrush Domain Overview schema/m);
  assert.match(document, /\| Records analyzed \| 2 \|/);
  assert.match(document, /\| Top-level fields \| 6 \|/);
  assert.match(document, /\| Scalar paths \| 9 \|/);
  assert.match(
    document,
    /\| `organic\.top_keywords` \| 2\/2 \| 2 \| 1 \| 1\.5 \| 2 \| object \|/,
  );
  assert.match(
    document,
    /\| `organic\.top_keywords\[\]\.cpc` \| string \| 2\/2 \| 3 \| 0 \| compact-number, numeric-string \|/,
  );
  assert.match(
    document,
    /\| `metric` \| null, number \| 2\/2 \| 2 \| 1 \| integer \|/,
  );
  assert.match(document, /\| `domain` \| string \| 2\/2 \| 2 \| 0 \| domain \|/);
  assert.match(document, /\| `enabled` \| boolean \| 2\/2 \| 2 \| 0 \|  \|/);
  assert.match(document, /\| `only_null` \| null \| 2\/2 \| 2 \| 2 \|  \|/);
});

test('rejects a non-array root payload', () => {
  assert.throws(
    () => buildSchemaDocument({domain: 'alpha.example'}),
    /root must be an array/i,
  );
});
