# Data skill discovery brief

## Outcome
Draft a disposable skill candidate that teaches a repeatable Apollo + Semrush join without embedding this project's answers.

## Inputs
- `tests/fixtures/providers/apollo-sample.csv`
- `tests/fixtures/providers/semrush-sample.json`
- `workshop/context/provider-summary.json`
- `tests/transforms/join-roster.test.ts`

## Rules to discover
Separate observed, calculated, and inferred values; normalize a canonical domain; join deterministically; preserve exceptions; use a sanitized fixture; and name the narrow test.

## Non-goals
Do not call providers, mutate Airtable, print rows, copy the canonical skill, or create a discoverable skill.

## Audit
`npm run workshop:audit-skill -- --contract data --candidate workshop/generated/competitor-data-contracts/SKILL.md --canonical .agents/skills/competitor-data-contracts/SKILL.md`
