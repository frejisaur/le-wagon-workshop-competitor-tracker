# Task 9 — deterministic scraper refresh hardening

## Prerequisite

This fix round depends on `7e672e6` (`feat: replace paid ad snapshots safely`),
which provides the validated, company-scoped `replacePaidAds` contract in both
the Airtable and sanitized-fixture repositories.

## Contract decisions

- The refresh workflow transforms each provider record once at its validation
  boundary, then writes that validated company/keyword/paid-ad domain package.
  Raw Apify values never reach persistence methods or fingerprints.
- After the company write invalidates its old evidence fingerprint, refresh
  calls `replacePaidAds(companyId, paidAds)`. The adapter completes all
  replacement writes before it removes obsolete paid ads, and deletion is
  constrained to the resolved company. Failed replacement leaves obsolete ads
  intact and the fingerprint invalid.
- The evidence fingerprint is computed from a newly read stored package only
  after company, keyword, and paid-ad replacement writes succeed.
- Startup failure remains a terminal failed System run. Cache invalidation
  failure is reconciled to the same failed System state without advancing the
  last-successful timestamp.
- Dataset duplicates permanently poison the affected company for that batch;
  unexpected-item audits are bounded and do not retain provider content.
  Per-company persistence throws are contained so later companies continue.
- Refresh and Apify knobs have explicit integer ceilings. Fixture output cannot
  resolve to its fixture input. The unused cache environment settings are
  removed. Task 10 owns any concrete HTTP cache adapter; Task 9 retains only an
  optional cache port for workflow testing.

## Test coverage

- Old scoped paid ad plus empty refresh removes the old ad and fingerprints the
  fresh stored package.
- A paid-ad replacement failure leaves the old scoped record in place and the
  company fingerprint null.
- Refreshing one company never removes another company's paid ad.
- A retry after a failed replacement converges to the empty paid-ad snapshot
  and its fresh fingerprint.

## Airtable impact

Paid-ad refresh now issues replacement writes followed by scoped obsolete-row
deletions. No additional table or browser API fields are introduced.

## Validation

- `npm test -- --run tests/workflows/enrich.test.ts tests/airtable/mappers.test.ts tests/airtable/repository.test.ts` — 50 passed.
- `npm test` — 181 passed.
- `node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check` — current.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json --output-state /private/tmp/competitor-task9-enrich-output.json` — passed without live services; it produced the expected partial fixture report because the fixture base tracks two companies while the sanitized provider sample returns one matching record.

## Unresolved interface questions

- Task 10 must supply the deployment-specific HTTP cache invalidation adapter
  and its operational authentication policy. This task intentionally does not
  select or configure one.

## Fix Round 2

- Cache invalidation is now authorized only by the first, intended terminal
  System publication. A best-effort `failed` recovery after that publication
  fails can clear a stale `running` state, but it cannot authorize cache work.
- A failed initial dashboard snapshot leaves the previous successful-run value
  unknown. The terminal failure System input and its Airtable field mapping omit
  that optional field, so PATCH semantics preserve an existing timestamp. A
  readable snapshot still treats an absent timestamp as known `null`, retaining
  the established cache-failure correction behavior.
- Regression coverage verifies the cache spy remains untouched after a
  successful failed-state recovery, confirms the terminal input omits the
  unknown timestamp, and checks production System PATCH payload and the
  sanitized fixture repository have matching preserve-on-omission behavior.
