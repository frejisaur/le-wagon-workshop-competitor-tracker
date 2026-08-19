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
| Evidence | One canonical curated Company + Keyword + Paid Ad evidence-package builder feeds the fingerprint. Operational IDs, timestamps, workflow/status, and generated text are excluded. |
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
