# Deterministic metric refresh

Run the fixture-backed workshop path first. It uses no credentials and preserves the
pre-generated insight snapshot:

```sh
npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json
```

For live refreshes, set `APIFY_TOKEN`, `AIRTABLE_PAT`, and `AIRTABLE_BASE_ID`.
The command reports only missing variable names during preflight, never values.
It reads existing Company records, runs bounded batches of at most 100 domains,
and only writes validated observed metrics, reproducible fingerprints, and Railway
workflow fields. It does not call a model or alter GTM Insights or Insight Reviews.

Railway alone schedules `npm run enrich` at `0 15 * * 1` UTC. It has no public
domain, does not restart after exit, and is terminated after 15 minutes. Each
Railway invocation starts the Apify actor through its REST API, polls it, fetches
the resulting dataset, persists it, and exits; this repository never creates or
configures an Apify schedule. A partial run retains completed company updates;
retrying the same command is safe because it updates established Airtable Company
records by record ID.

The cache invalidation hook is deliberately invoked only after Company writes and a
terminal Railway System update. If a live provider is unavailable during the
workshop, use the fixture command above.
