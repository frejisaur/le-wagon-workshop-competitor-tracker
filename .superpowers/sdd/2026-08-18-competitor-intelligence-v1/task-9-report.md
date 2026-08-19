# Task 9 report — TypeScript Apify refresh and Railway cron

## Authoritative implementation

The staged TypeScript/Next.js implementation is authoritative; the earlier Node
ESM prototype is superseded and is not described as an active implementation.

- `lib/apify/run-domain-overview.ts` starts the configured actor with bearer
  authentication, polls the run, then fetches default-dataset items. The exact
  actor input is `{mode: "domain", domains, database: "worldwide",
  include_moz: false, concurrency: 5}`. Railway starts each run; this code never
  creates an Apify schedule.
- Raw provider items are schema-validated and transformed before repository
  access. The refresh workflow persists observed Company, Keyword, and Paid Ad
  records through the existing repository contract, keeping provider payloads
  outside the storage boundary.
- The workflow retains committed records after partial batches, replaces the
  current keyword snapshot, upserts stable paid-ad identities, derives its
  fingerprint from the canonical curated evidence package, and does not modify
  inferred or agent workflow fields.
- A terminal status is published before concrete cache-version invalidation.
  Failed terminal/cache work makes the run unsuccessful; the workflow has
  bounded abort and cleanup handling.
- Fixture mode uses the same mutable repository contract and leaves existing
  insight and review snapshots intact. Partial and failed CLI reports exit
  nonzero, preserving successful writes for retry.
- `APIFY_ACTOR_ID` is a validated refresh-only server variable. `--actor-id`
  remains an explicit operator override; live Railway execution otherwise uses
  the validated environment value. No secret is printed by the preflight.

## Railway contract

The web-safe root `railway.toml` remains Dockerfile-build-only. The separate
cron service must use custom configuration path `/railway.cron.toml`.

- same `Dockerfile` image as the web service;
- `startCommand = "/usr/bin/timeout --signal=TERM --kill-after=30s 15m npm run enrich"`;
- `cronSchedule = "0 15 * * 1"` (Monday 15:00 UTC);
- `restartPolicyType = "NEVER"` and no public-domain configuration;
- Railway alone owns cadence. It invokes Apify through REST and exits; no Apify
  schedule is created or configured.

The process-level 15-minute termination is intentionally interpolation-free.
The job installs its own 14-minute deadline, allowing bounded terminal cleanup
before Railway sends TERM.

## Contract decisions

| Contract | Decision |
| --- | --- |
| Provider boundary | Validate required Company metrics and `database: "worldwide"` before transformation; malformed nested keyword/ad entries are reported and omitted without discarding a valid company. |
| Identity | Existing Company IDs are updated; Keyword and Paid Ad identities are stable deterministic data identities. Conflicting duplicate provider records are rejected while canonical duplicates are idempotent. |
| Evidence | One canonical curated Company + Keyword + Paid Ad evidence-package builder feeds the fingerprint. Generated text and top-level operational metadata are excluded; a provenance-exclusion migration remains pending. |
| Partial persistence | Repository outcomes are per record/batch. Already committed records remain succeeded if a later batch fails. |
| Cache | After data writes and terminal status, `System.Cache Version` advances through the repository. This is concrete invalidation, not an HTTP purge. |
| Server config | The active plain-name `AIRTABLE_SCHEMA` is supported. No legacy layered field-map compatibility is claimed. |

## TDD evidence

### TypeScript adaptation RED/GREEN

RED:

```text
npm test -- tests/apify/run-domain-overview.test.ts tests/config/railway-cron.test.ts tests/jobs/enrich.test.ts
3 failed: actor input used `domain_overview`; railway.cron.toml was absent;
partial fixture execution exited 0.
```

GREEN:

```text
npm test -- tests/apify/run-domain-overview.test.ts tests/config/railway-cron.test.ts tests/jobs/enrich.test.ts
4 passed, 0 failed.
```

### Deployment fallback RED/GREEN

RED:

```text
npm test -- tests/config/server-env.test.ts tests/jobs/enrich.test.ts tests/config/railway-cron.test.ts
4 failed: cron start command interpolated `$APIFY_ACTOR_ID`; APIFY_ACTOR_ID
was absent from the refresh-only schema; valid refresh env accepted no actor ID;
and no environment fallback resolver existed.
```

GREEN:

```text
npm test -- tests/config/server-env.test.ts tests/jobs/enrich.test.ts tests/config/railway-cron.test.ts
Test Files  3 passed (3)
Tests  9 passed (9)
```

## Files changed in the authoritative implementation

- `.env.example`
- `docs/operations/deployment.md`
- `docs/refresh-operations.md`
- `jobs/enrich.ts`
- `lib/apify/run-domain-overview.ts`
- `lib/config/server-env.ts`
- `railway.cron.toml`
- `tests/apify/run-domain-overview.test.ts`
- `tests/config/railway-cron.test.ts`
- `tests/config/server-env.test.ts`
- `tests/contracts/skills.test.ts`
- `tests/jobs/enrich.test.ts`

## Verification and self-review

- Focused adaptation and deployment-contract tests passed as recorded above.
- `npm run build -- --webpack` passed after the deployment-fallback change.
- `npm test` passed: 40 files and 311 tests.
- The fixture command completed the intentionally partial sample with one
  success and one unresolved company, then exited 1. This demonstrates the CLI
  contract that partial persistence is retained but visible to Railway.
- No provider payloads, Authorization headers, token values, or credentials are
  logged or placed in fixtures. The command preflight identifies only missing
  environment variable names.
- Reviewed for schedule ownership, external/internal timeout ordering, validated
  actor selection, and safe nonzero partial exits.

## Concerns

The live command requires all refresh-only server variables and an Airtable base
matching the active plain-name schema. The existing tests cover those contracts;
live credentials were not used in this task.

## Round 3 safe checkpoint

This checkpoint intentionally contains only independently complete refresh
contracts. It does not claim the unfinished whole-roster write redesign.

### Included

- `ApifyClient.getDatasetItems` now parses the real top-level array response
  and validates `X-Apify-Pagination-Offset`, `-Limit`, `-Count`, and `-Total`.
  It preserves `Response` access internally, performs bounded exponential poll
  delays, and exposes a best-effort remote abort for an owned nonterminal run.
- Domain Overview returns `{items, datasetId}`. The workflow stores a distinct,
  token-free dataset item URL for validated Company/Keyword/Paid Ad provenance;
  browser shaping remains allow-listed.
- The live refresh environment pins Railway's default actor to
  `pro100chok/semrush-scraper`; `--actor-id` remains an explicit local override.
  Configured Airtable table names are passed to the live repository.
- Provider validation requires `database: "worldwide"`. Missing Moz does not
  erase persisted Moz evidence. Malformed organic/paid modules retain existing
  child snapshots, add bounded quality evidence, and surface sanitized run
  errors. Valid empty arrays still replace the corresponding snapshot.
- Roster validation now counts missing IDs, invalid domains, and every duplicate
  canonical domain as deterministic failures. The safely implemented traffic
  share is calculated only when the full roster is represented by the validated
  provider batch; otherwise it persists `null` plus a coverage issue.

### RED/GREEN evidence

RED before the Apify change:

```text
npm test -- tests/apify/client.test.ts
1 failed: the old invented {data:{items,offset,count,total}} response parser
rejected the official-shaped top-level array plus pagination headers.
```

GREEN:

```text
npm test -- tests/apify tests/airtable/repository.test.ts tests/config/server-env.test.ts tests/jobs/enrich.test.ts tests/workflows/enrich.test.ts tests/contracts/provider-schemas.test.ts tests/transforms/semrush-to-domain.test.ts
9 files passed; 84 tests passed.
```

Final verification:

- `npm run build -- --webpack` — passed.
- `npm test` — 40 files, 315 tests passed.
- Sanitized fixture refresh — partial as designed (1 persisted, 1 unresolved),
  exited 1 without secrets or raw payload logging.

### Explicitly excluded remaining split

1. Stage and validate the whole active provider set before any transformation,
   compute all-52 tracked-set traffic shares, and batch Company/child/fingerprint
   writes while preserving per-record outcomes after a later batch fails.
2. Thread a parent deadline through repository calls and Airtable 429 retry
   sleeps, add bounded fresh-signal terminal cleanup, and prove that behavior.
3. Introduce a versioned fingerprint migration that excludes observation
   timestamps and dataset IDs without making existing approved insight fixtures
   unexpectedly stale; then add the full budget/provenance regression coverage.
