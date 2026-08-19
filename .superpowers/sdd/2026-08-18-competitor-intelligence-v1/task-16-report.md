# Task 16 — Railway Release Contract and Workshop Rehearsal

## Outcome

Implemented a Node 22 production image, a shared Railway build contract, explicit separate web/weekly-cron operating instructions, fixture-only workshop automation, harness/skill parity checks, and negative-control security scans. No deployment or live Airtable, Apify, or Railway action was performed.

The web service runs `npm start`, exposes only the web domain, and uses `/api/health`. The independent terminating cron uses the same image, `npm run enrich`, schedule `0 15 * * 1` UTC, no public domain, `NEVER` restart semantics, and `/usr/bin/timeout --signal=TERM --kill-after=30s 20m` as the hard execution bound. Railway config-as-code is service-scoped, so `railway.toml` contains only the shared image build; service-specific runtime and web-only health values are an explicit operator checklist. A Docker-level health check is intentionally absent because it would incorrectly mark the non-HTTP cron unhealthy.

## Skill and contract impact

- `operating-competitor-intelligence` and its runbook drove terminating workflow, last-successful preservation, sanitized present/missing preflight, non-production snapshots, cache-signature, partial-failure, and recovery guidance.
- `competitor-data-contracts` kept raw payloads and credentials outside browser/image artifacts and required sanitized fixture workflows, deterministic identities, record-budget checks, and the schema gate.
- `building-competitor-dashboard` preserved the validated dashboard API, responsive/accessibility states, and evidence navigation in the browser rehearsal.
- `generating-gtm-battlecards` preserved high-confidence publication, low/conflicting review routing, current approval promotion, stale refusal, fingerprints, and independent agent run IDs.
- TDD captured the absent deployment/docs/env contracts as 3 focused RED failures before implementation. The workshop E2E then captured ambiguous navigation and pre-hydration interaction failures before its stable GREEN path.

## Rehearsal evidence

- Sanitized small fixture dry-run: 2 accepted, 1 `missing_apollo_website` rejection, 0 external calls, 6 projected records.
- Supplied-data dry-run: 52 accepted, 1 `missing_apollo_website` rejection, 0 external calls, 426 projected records (52 Companies + 358 Keywords + 16 Paid Ads), 60 estimated write calls, and 0 estimated API calls. Output contained aggregate identities/status only; dry-run made no repository writes.
- Full V1 capacity estimate: 531 records (52 Companies + 358 Keywords + 16 Paid Ads + 52 Insights + 52 Reviews + 1 System), below the strict 1,000-record boundary.
- Partial refresh fixture: 2 processed, 1 succeeded, 1 failed (`dataset_item_missing`), status `partial`, a new `railway-<uuid>` run ID, successful company data preserved, and no cache invalidation.
- Candidate lifecycle: high candidate `fixture-run-high` published; replay returned `idempotent: true` with unchanged Company/Insight identity; low candidate `fixture-run-low` queued for `conflicting_sources`; approved-current published 1; approved-stale marked 1 stale without replacing the prior publication. The UI publication run (`fixture-run`) remained independent.
- Browser journey covered All Companies → Alpha Company Detail → Battlecard → two exact evidence observations → focus return to originating claim, with current freshness visible. It ran alongside all desktop/tablet/mobile accessibility and overflow workflows.

## Release gate

- Focused contracts/security: 4 files, 17 tests passed.
- Full Vitest: 35 files, 284 tests passed locally. Node 22 Docker test stage also passed all 284 with two workers, followed by `npx tsc --noEmit` and schema drift check.
- Playwright: 27 collected; 21 passed across desktop/tablet/mobile and 6 intentional skips because the lifecycle subprocess rehearsal runs once on desktop. All existing responsive, keyboard, evidence, and state workflows passed.
- Webpack production build: passed locally and inside Node 22 Docker, with all application/API routes emitted.
- Schema check: current. TypeScript: passed after the production build.
- Docker production image: built as `competitor-intelligence:v1`; runtime is Node 22.23.2, non-root user `app`, command `["npm","start"]`, `tsx` 4.23.12 and GNU `timeout` 9.1 present.
- Credential-free local image smoke: `npm start` became ready; `GET /api/health` fail-closed with sanitized HTTP 503 `{status:"degraded", dependencies:{airtable:"unavailable"}, data:{status:"failed", freshness:{lastSuccessfulRunAt:null,cachedAt:null,isStale:true}}}` before any network client could be constructed. Logs contained only Next startup/listen messages—no values, authorization data, raw records, or provider text.
- Client scan: no `AIRTABLE_PAT`, `APIFY_TOKEN`, `CACHE_INVALIDATION_SECRET`, authorization, raw-provider fixture path, `rawProvider`, or raw-ref field marker. Production server/client scan found no E2E fixture service/marker.
- Default Turbopack attempt retained the known sandbox-only limitation: CSS processing tried to bind a port and received `Operation not permitted`. The required Webpack and Node 22 Docker release builds passed.
- `git diff --check`: recorded immediately before commit.

## Read-only evidence review

Reviewed the scoped diff for unsupported inference, classification leakage, stale fingerprints, invalid evidence, prompt-injection handling, secret exposure, publication gates, non-idempotent writes, raw-payload delivery, and missing negative tests. No high-severity finding remained. Negative controls prove the scanner detects a planted secret marker; malformed/stale lifecycle behavior remains covered by the pre-existing full suite. Residual risk is operator misconfiguration in Railway, bounded by the explicit per-service checklist and present/missing-only preflight.

## Deviations and live-action boundary

- No non-production Railway deployment existed in scope, so no remote Railway health/freshness snapshot was taken. The credential-free local production-image smoke proves startup and sanitized fail-closed behavior; the runbook leaves remote health and before/after System snapshots as explicit operator-only non-production steps.
- No new screenshots were needed: Task 15 already established the deterministic desktop/tablet/mobile visual-state corpus, and Task 16 reran those browser contracts unchanged.
- No evidence-reviewer subagent was invoked because this bounded assignment explicitly prohibited subagents; the same read-only checklist was applied locally and recorded above.
- No secrets were read or printed. No live service was called. No production deployment, cache invalidation, approval mutation, or destructive cleanup occurred.
- Commit SHA is reported in the parent handoff; a commit cannot truthfully embed its own final hash.

## Fix Round 1 — Final-review hardening

### Findings resolved

1. Added `low-preserves-published-state.json`, containing the current curated evidence plus a sanitized prior Insight record `rec-prior-published` with fingerprint `aaaaaaaa…`, distinct from the low candidate's current fingerprint. The workshop E2E invokes submission in a separate `npm` process, verifies `queued`/`conflicting_sources`, asserts the complete prior Insight record (ID and every field) is deeply identical in the output, and confirms the input fixture bytes are unchanged. High publication/replay and low-preserves-prior now start from independent fixtures and paths; the runbook states the exact commands and warns that the high output is not the low scenario input.
2. The Docker `test` stage now writes a zero-byte `/release-verified` marker only after full Vitest, TypeScript, and schema gates succeed. The default deployable `app` stage copies that marker from `test`, so Docker cannot export the runtime without completing verification; runtime size impact is zero bytes of content. Focused RED proved the previous app had no structural dependency. The final default build log showed all 286 tests, `tsc`, schema check, marker creation, then the app copy/export in that order.
3. Browser artifact scanning now rejects shell, JSON, and camel-case credential assignments with non-empty values; Authorization/Bearer and standalone Bearer values; raw provider fixture paths/objects/field markers; Observed Raw Ref, `rawDatasetRef`, and `dataset:` values; and Airtable record IDs in record-ID property context. It reports only detector name and filename, never matched content. Twelve sanitized sentinel files exercise every detector, a safe-label fixture proves legitimate labels do not trigger, and missing/stale production builds fail explicitly before scanning.

### RED / GREEN evidence

- RED contracts/security: 2 failures—missing Docker verification marker/dependency and only 2 of 8 original leak representations detected.
- RED workshop: the focused browser workflow failed at the absent distinct prior-publication fixture.
- Focused GREEN: contracts/security 4 files, 19 tests; workshop browser 1 passed; lifecycle/API 10 files, 84 tests.
- Full Vitest after a fresh Webpack build: 35 files, 286 tests passed.
- Full Playwright: 27 collected, 21 passed and 6 intentional non-desktop lifecycle skips.
- Fresh local Webpack build, standalone `npx tsc --noEmit`, and schema drift check passed.
- Default `docker build --progress=plain -t competitor-intelligence:v1 .` passed and visibly executed builder → tests → typecheck → schema → marker → app export. Final runtime verified Node 22.23.2, `tsx` 4.23.12, GNU timeout 9.1, non-root marker ownership (`app:app`), and zero-byte marker size.
- Credential-free final-image smoke became ready in 246 ms and returned the same sanitized fail-closed HTTP 503 health body. Logs contained only normal Next startup/listen lines.
- Supplied-data dry-run remained 52 accepted, 1 missing-website rejection, 426 projected records, 60 estimated writes, and 0 external API calls. No live repository write, Airtable, Apify, Railway, deployment, or cache call occurred.

### Security and contract review

Fresh `.next/static` artifacts produced zero hardened scanner findings. Production server/client artifacts retained no E2E fixture alias/marker. The Airtable ID detector is constrained to record-ID properties to avoid false positives such as React's legitimate `reconcilerVersion`; safe labels remain allowed. Publication identity, evidence fingerprint calculation, confidence routing, API response shapes, and UI presentation contracts were not changed. Airtable record/API impact: none; the new file is a sanitized test fixture only.
