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
