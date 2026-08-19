# Phase 1 — provider join

## Outcome
Prove a deterministic Apollo-to-Semrush join against sanitized fixtures and explain exceptions without exposing company rows.

## Non-goals
No live provider calls, Airtable writes, schema invention, raw payload output, dashboard changes, or inferred marketing claims.

## Read
- `.agents/skills/competitor-data-contracts/SKILL.md`
- `workshop/context/provider-summary.json`
- `workshop/context/expected-counts.json`
- `tests/fixtures/providers/apollo-sample.csv`
- `tests/fixtures/providers/semrush-sample.json`
- `tests/transforms/join-roster.test.ts`

## Run
Use only `pipeline-builder`. Run `npm run import:initial -- --apollo tests/fixtures/providers/apollo-sample.csv --semrush tests/fixtures/providers/semrush-sample.json --dry-run`.

## Acceptance
Canonical domains are stable; observed provider values remain distinct from calculated fields and inferred content; accepted, unmatched, Apify-only, and rejected counts match the compact expected files; errors are classified without identities.

## Return
Return only command status, input/accepted/rejected counts, rejection-code counts, tests run, and changed paths. Never paste rows or raw output.
