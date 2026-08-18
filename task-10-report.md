# Task 10 — cached dashboard serving boundary

## Skill impact

- `building-competitor-dashboard` kept the API contract aligned with the approved landscape-led and company-workspace states: classified values, explicit absence, freshness, partial/failure recovery, and evidence reachability.
- `competitor-data-contracts` required the strict allow-list projection from already-curated Airtable records; raw provider payloads, Airtable record IDs, credentials, and reviewer identity/notes never cross into API responses.
- `operating-competitor-intelligence` determined the last-successful snapshot behavior, health/freshness semantics, fixture-safe refresh adapter wiring, and post-terminal-only cache invalidation.

## RED → GREEN

`npm test -- --run tests/api` was captured red before implementation: the new API suites could not resolve the missing cache, response shaper, and signing modules. The focused API, environment, refresh-workflow, and fixture CLI checks are now green.

## Response contracts

- `LandscapeResponse` and `CompanyResponse` are strict runtime Zod schemas in `lib/domain/dashboard.ts`.
- Every scalar exposed for dashboard presentation carries an explicit `observed`, `calculated`, or `inferred` classification. Missing provider values remain `null`; paid activity is omitted unless the validated calculated presence flag and meaningful data agree.
- Shapers project only curated allow-listed field names. Company detail excludes Airtable record IDs, raw payloads, provider credentials, reviewer identities, and reviewer notes. Published claims are retained only when each evidence reference resolves against the current curated evidence package.
- Companies, rows, filters, evidence, signals, and map data have stable deterministic ordering.

## Cache and health

- `DashboardCache` bounds process memory to one last-successful snapshot, single-flights first load, and retains it across revalidation/refresh failure. Cache state is separate from content and represents loading, running, stale, partial, failed, empty, and recovery behavior without allowing failed loads to overwrite good data.
- Health is non-secret and reports application/dependency state plus dashboard freshness.

## Signing protocol and adapter

- Internal invalidation accepts only `POST` requests with a strict `{"version":"v1"}` body under 1 KiB.
- It validates a length-prefixed canonical byte sequence: `v1`, raw timestamp length and bytes, raw body length, and exact raw body bytes. HMAC-SHA256 uses constant-time comparison after safe length checking; malformed, duplicate/combined, expired (>5 minutes), future, unsigned, and invalid-schema requests reject with sanitized responses.
- Invalidation is idempotent: it marks the cache stale and the next request safely reloads or continues serving the retained snapshot.
- The live `enrich` CLI now creates the HTTP adapter only outside fixture mode with `APP_BASE_URL` and `CACHE_INVALIDATION_SECRET`; fixture mode neither requires nor calls it. Task 9 retains call ordering ownership and its workflow test confirms terminal System transition precedes the cache port.

## Validation

- `npm test -- --run tests/api tests/config/server-env.test.ts tests/workflows/enrich.test.ts tests/jobs/enrich.test.ts` — 32 passed.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed; server routes compiled.
- `npm test` — 187 passed before Fix Round 1 additions.
- `node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check` — current.
- Fixture CLI refresh passed with `cacheInvalidated: false`, proving fixture mode did not call the live adapter.
- Browser artifact scan of `.next/static` found no server environment variable names, raw-payload marker, or test-only untrusted reviewer text.

## Unresolved data-contract needs

None. The current curated tables supply the fields needed by the Version 1 response contracts. Future additional dashboard fields must be added to the explicit shaper allow-list and runtime schema rather than forwarded from a provider or Airtable record.

## Commit

Committed as `feat: serve cached competitor dashboard data`.

## Fix Round 1

- Published claims now use a freshly rebuilt Task 7 evidence package and
  `fingerprintEvidence`, never the legacy Company fingerprint. A published
  record whose stored workflow fingerprint differs is represented as
  `publishedInsightState: "stale"` and its claims are withheld.
- Invalidation v1 now includes a cryptographic nonce. The route incrementally
  reads and cancels request streams exceeding 1 KiB, authenticates exact raw
  bytes, then stores the nonce/signature only after successful validation.
  The bounded replay store returns `409` for a duplicate valid request. It is
  intentionally per-process; separate serverless instances require shared
  durable replay protection if cross-instance replay prevention becomes a
  requirement.
- Portfolio totals are nullable when any member lacks the required value and
  include `{available,total}` coverage. Missing paid activity remains `null`,
  not `false`.
- An invalidation now returns retained content as `stale` immediately while one
  cache-owned background revalidation runs. It has no unhandled rejection;
  success replaces the snapshot and failure marks the retained snapshot failed.
- The adapter rejects unsafe destinations. Production requires a root-path
  HTTPS origin without credentials, query, or fragment. HTTP is allowed only
  for explicit loopback development/test use.

Fix Round 1 validation: 38 focused tests; full suite 193 passed; `npx tsc
--noEmit`, production build, schema drift check, browser scan, and fixture CLI
all passed. Fixture output retained `cacheInvalidated: false`.
