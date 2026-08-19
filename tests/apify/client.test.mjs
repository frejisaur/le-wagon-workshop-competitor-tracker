import assert from 'node:assert/strict';
import test from 'node:test';

import {ApifyClient} from '../../src/apify/client.mjs';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

test('starts the Semrush actor with bounded Domain Overview input and Authorization header', async () => {
  const requests = [];
  const client = new ApifyClient({
    token: 'apify-test.secret',
    fetchFn: async (input, init) => {
      requests.push({input, init});
      return jsonResponse(201, {data: {id: 'run-1', status: 'RUNNING'}});
    },
  });

  await client.startRun({
    actorId: 'pro100chok/semrush-scraper',
    input: {
      mode: 'domain', domains: ['alpha.example', 'beta.example'], database: 'worldwide',
      include_moz: false, concurrency: 5,
    },
  });

  assert.equal(requests[0].input, 'https://api.apify.com/v2/acts/pro100chok~semrush-scraper/runs');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer apify-test.secret');
  assert.equal(requests[0].init.headers.Authorization.includes('?token='), false);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    mode: 'domain', domains: ['alpha.example', 'beta.example'], database: 'worldwide',
    include_moz: false, concurrency: 5,
  });
});

test('polling stops at the caller timeout without exposing provider response bodies', async () => {
  const controller = new AbortController();
  const client = new ApifyClient({
    token: 'apify-test.secret',
    fetchFn: async () => jsonResponse(200, {data: {id: 'run-1', status: 'RUNNING'}}),
    sleep: async () => controller.abort(new Error('refresh timeout')),
  });

  await assert.rejects(
    client.waitForRun('run-1', {signal: controller.signal, pollMs: 1}),
    /refresh timeout/,
  );
});

test('gets dataset items with a caller abort signal', async () => {
  const controller = new AbortController();
  controller.abort(new Error('task timeout'));
  const client = new ApifyClient({token: 'apify-test.secret'});

  await assert.rejects(
    client.getDatasetItems('dataset-1', {signal: controller.signal}),
    /task timeout/,
  );
});
