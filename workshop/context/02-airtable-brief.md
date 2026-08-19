# Phase 2 — Airtable bootstrap

## Outcome
Reconcile the layered schema in a disposable workshop base and import the accepted fixture records idempotently.

## Non-goals
No production base, secret display, browser-side credentials, live provider calls, destructive schema changes, or inferred values stored as observations.

## Read
- `.agents/skills/competitor-data-contracts/SKILL.md`
- `gtm-competitor-intelligence-design.md` (layered schema and deployment security boundary)
- `workshop/context/expected-counts.json`
- `workshop/credentials.md`
- `workshop/expected/airtable-import-output.json`

## Run
First run `npm run workshop:preflight -- --phase data`. With operator approval for live mutation, use the Airtable MCP only to inspect the disposable base, then run `npm run airtable:schema` and the existing import command. Fixture fallback: `npm run import:initial -- --apollo tests/fixtures/providers/apollo-sample.csv --semrush tests/fixtures/providers/semrush-sample.json --dry-run`.

## Acceptance
Schema and record operations are retry-safe; expected counts match; credentials remain protected; no raw provider text enters prompts or logs.

## Return
Return only preflight status, base label, schema status, created/updated/rejected counts, command status, and fallback used. Never return IDs, tokens, headers, or rows.
