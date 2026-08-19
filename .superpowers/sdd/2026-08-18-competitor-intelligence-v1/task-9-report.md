# Task 9 report — Apify refresh and Railway cron

## Implementation

Implemented the Node ESM refresh path under `src/` and `scripts/`:

- `ApifyClient` calls the documented REST flow with Authorization headers only:
  start actor run, poll the run, then retrieve default-dataset items. All three
  accept an `AbortSignal`.
- Domain Overview requests use exactly `mode: "domain"`, `database:
  "worldwide"`, `include_moz: false`, and `concurrency: 5`; workflow batches
  are limited to at most 100 domains.
- Raw dataset items are validated at `src/refresh/provider-record.mjs` before
  the transform. The repository receives only a normalized, field-mapped
  Company update, never an unvalidated provider object.
- The deterministic transform persists observed Domain Overview metrics plus a
  stable SHA-256 evidence fingerprint over the transformed observed fields. It
  does not change GTM Insights, Insight Reviews, or agent workflow columns.
- Airtable Company writes are PATCHed by established record ID in groups of 10.
  System updates include only Railway fields. Rate-limits honor `retry-after`.
- `runEnrichment` has a Railway run ID, hard abort timer, bounded batch retry,
  per-company safe error codes, partial-success counts, terminal System status,
  and post-write/post-terminal-status cache invalidation ordering.
- `npm run enrich` has a fixture-first mode and a live preflight that prints
  only missing environment-variable names. The fixture command does not load
  or mutate insight data.
- `railway.toml` configures `0 15 * * 1` UTC, `restartPolicyType = "NEVER"`,
  no public-domain declaration, and a terminating 15-minute `timeout` wrapper.
  Railway is the only scheduler: an invocation calls Apify's REST actor API and
  exits after persistence; this implementation creates no Apify schedule.

## Contract decisions

| Contract | Decision |
| --- | --- |
| Provider boundary | Require a valid normalized domain and database; reject any supplied derived metric with a non-finite numeric value. |
| Provider input | Actor ID `pro100chok/semrush-scraper`; 1–100 domains; exact documented Domain Overview input shape. |
| Company identity | Existing Airtable record ID performs the write; immutable `Company ID` and canonical domain are read only for matching/reporting. |
| Data layers | Persisted refresh values are observed provider fields or the deterministic evidence fingerprint; no inferred fields are read or written. |
| Partial failure | Successful Company updates persist; failures are recorded as `{companyId, code}` and the run ends `partial` or `failed`. |
| Cache ordering | Cache hook runs only after Company writes and terminal Railway System update. |
| Airtable impact | Company refresh uses `ceil(successful/10)` PATCH calls, up to failed-company batches, plus System reads/writes; no Keyword, Paid Ads, Insights, or Review records are created. |

## TDD evidence

RED command (before implementation):

```text
node --test tests/apify/client.test.mjs tests/workflows/enrich.test.mjs
ERR_MODULE_NOT_FOUND: src/apify/client.mjs
ERR_MODULE_NOT_FOUND: src/workflows/enrich.mjs
tests 2; pass 0; fail 2
```

GREEN command after implementation:

```text
node --test tests/apify/client.test.mjs tests/workflows/enrich.test.mjs
tests 6; pass 6; fail 0
```

An additional repository test initially failed because `encodeURIComponent`
does not encode the unreserved word `Companies`; the request URL was correct.
The assertion was corrected to the observed URL and then passed.

## Tests and command checks

- Focused suite: `node --test tests/config/env.test.mjs tests/airtable/refresh-repository.test.mjs tests/apify/client.test.mjs tests/workflows/enrich.test.mjs` — 9 passed, 0 failed.
- Full suite: `npm test` — 19 passed, 0 failed.
- Fixture command: `npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json` — exited 0 with a secret-free `succeeded` summary: processed 2, succeeded 2, failed 0.
- Diff check: `git diff --check` — exited 0.

## Files changed

- `.env.example`
- `package.json`
- `railway.toml`
- `docs/refresh-operations.md`
- `scripts/enrich.mjs`
- `src/config/env.mjs`
- `src/domain/normalize.mjs`
- `src/apify/client.mjs`
- `src/apify/run-domain-overview.mjs`
- `src/refresh/provider-record.mjs`
- `src/airtable/refresh-repository.mjs`
- `src/workflows/enrich.mjs`
- `tests/config/env.test.mjs`
- `tests/airtable/refresh-repository.test.mjs`
- `tests/apify/client.test.mjs`
- `tests/workflows/enrich.test.mjs`
- `tests/fixtures/providers/semrush-sample.json`
- `tests/fixtures/airtable/base-snapshot.json`

## Self-review and concerns

- No provider payloads, secret values, Authorization headers, or production domains are logged. Fixtures contain only sanitized `.example` values.
- The current concrete Airtable schema is the plain `AIRTABLE_SCHEMA`; the repository accepts a field-map override for a layered base, but the CLI does not auto-detect the legacy layered field naming. A production base using that variant needs an explicit mapping at command construction.
- There is no web-cache invalidation endpoint in the current prototype. The repository exposes an injected cache-invalidation hook and treats the absent cache as a no-op. The web-service owner must supply the actual signed invalidation callback when that service exists.
- Keyword and Paid Ad refreshes remain outside this focused Task 9 implementation; it updates Company-level Domain Overview metrics only.

## TypeScript-stack adaptation and review follow-up

The shared workspace was reset onto the staged TypeScript/Next.js implementation
before the Node ESM fix round could be committed. This TypeScript stack supersedes
the old runtime and already provides the reviewed prerequisite contracts:

- Semrush parsing and deterministic transforms validate provider records before
  storage; Keyword/Paid Ad replacement uses stable identities and preserves first
  observation state.
- Airtable repository writes return per-record outcomes, including later-batch
  failures, and workflow tests preserve committed partial successes.
- The single canonical evidence-package builder and `fingerprintEvidence` hash
  Company, Keyword, and Paid Ad curated evidence while excluding generated and
  operational metadata.
- The fixture repository exercises state mutation without modifying insights or
  reviews; the workflow includes bounded terminal-state recovery and cache-failure
  reconciliation.
- Apify client tests cover bearer auth, start/poll/dataset flow, timeouts, and
  redacted failures.

### Fixes made on the TypeScript stack

- Corrected the actor input in `lib/apify/run-domain-overview.ts` to exactly
  `{mode: "domain", domains, database: "worldwide", include_moz: false,
  concurrency: 5}`.
- Made partial as well as failed refresh commands exit nonzero, while retaining
  successful writes for safe retry.
- Added a 14-minute live-job abort deadline and documented it under Railway's
  15-minute `/usr/bin/timeout` outer limit.
- Added `railway.cron.toml` for the terminating Railway service, while retaining
  root `railway.toml` as web-safe Dockerfile build configuration. It has
  `cronSchedule = "0 15 * * 1"`, `restartPolicyType = "NEVER"`, no public-domain
  configuration, and no Apify schedule. The deployment documentation tells
  operators to select `railway.cron.toml` as the cron service config path.
- Added focused tests for exact actor input, cron ownership/configuration, and
  nonzero partial CLI exit. Updated the existing timeout release contract from
  the obsolete 20-minute value to the required 15 minutes.

### TypeScript TDD evidence

RED:

```text
npm test -- tests/apify/run-domain-overview.test.ts tests/config/railway-cron.test.ts tests/jobs/enrich.test.ts
3 failed: actor input was `domain_overview`; railway.cron.toml was absent;
partial fixture command returned exit 0.
```

GREEN:

```text
npm test -- tests/apify/run-domain-overview.test.ts tests/config/railway-cron.test.ts tests/jobs/enrich.test.ts
4 passed, 0 failed.
```

`npm test` then ran 310 tests: 309 passed and one browser-secret-boundary test
was blocked because an independently running shared Next build held `.next/lock`
and had not produced `.next/BUILD_ID`. A direct `next build` invocation reported
the same live build lock; no lock removal or process termination was attempted.

### TypeScript adaptation files

- `lib/apify/run-domain-overview.ts`
- `jobs/enrich.ts`
- `railway.cron.toml`
- `docs/operations/deployment.md`
- `tests/apify/run-domain-overview.test.ts`
- `tests/config/railway-cron.test.ts`
- `tests/jobs/enrich.test.ts`
- `tests/contracts/skills.test.ts`
