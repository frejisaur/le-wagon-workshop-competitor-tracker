# Deterministic metric refresh

The authoritative refresh implementation is `jobs/enrich.ts` and the validated
TypeScript server contracts under `lib/`. Start with its fixture path:

```sh
npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json
```

Fixture execution uses the mutable fixture repository and keeps GTM Insights and
Insight Reviews unchanged. Live execution validates server-only Airtable,
`APIFY_TOKEN`, `APIFY_ACTOR_ID`, `APP_BASE_URL`, and cache-secret settings.
The GitHub Actions refresh validates `APIFY_ACTOR_ID=pro100chok/semrush-scraper`; an explicit
`--actor-id` is a local/operator override, otherwise that reviewed env value is
used.
It validates provider data, replaces observed Keyword/Paid Ad snapshots, updates
the canonical evidence fingerprint, preserves partial successes, and exits nonzero
for partial or failed refreshes.

GitHub Actions alone schedules the terminating refresh. The workflow
`.github/workflows/refresh.yml` runs `npm run enrich` on Node 22 with
`timeout-minutes: 15`, cron `0 15 * * 1` UTC, `workflow_dispatch` for approved
manual runs, `concurrency: refresh` without cancelling an active run, and no
retries. The refresh has no public endpoint. Each run starts/polls/fetches Apify
through bearer-auth REST; it creates no Apify schedule. Run IDs are prefixed
`refresh-`. See [the deployment contract](operations/deployment.md) for the
required Actions secrets and variables.
