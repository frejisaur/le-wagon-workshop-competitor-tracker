# Deterministic metric refresh

The authoritative refresh implementation is `jobs/enrich.ts` and the validated
TypeScript server contracts under `lib/`. Start with its fixture path:

```sh
npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json
```

Fixture execution uses the mutable fixture repository and keeps GTM Insights and
Insight Reviews unchanged. Live execution validates server-only Airtable,
`APIFY_TOKEN`, `APIFY_ACTOR_ID`, `APP_BASE_URL`, and cache-secret settings; an
explicit `--actor-id` is an operator override, otherwise the validated env value
is used.
It validates provider data, replaces observed Keyword/Paid Ad snapshots, updates
the canonical evidence fingerprint, preserves partial successes, and exits nonzero
for partial or failed refreshes.

Railway alone schedules the terminating service. Configure that service with
`/railway.cron.toml`, which uses the shared Dockerfile image, a 15-minute outer
timeout, `0 15 * * 1` UTC, `NEVER` restart policy, and no public domain. Each run
starts/polls/fetches Apify through bearer-auth REST; it creates no Apify schedule.
