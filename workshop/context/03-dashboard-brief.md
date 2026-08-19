# Phase 3 — dashboard build

## Outcome
Implement the selected All Companies direction so a marketer can decide where to investigate next; keep the prepared Company Detail as the downstream contract.

## Non-goals
Do not redesign Company Detail live, alter API schemas, fetch providers, add gradients, invent metrics, or change unrelated application code.

## Read
- `.agents/skills/building-competitor-dashboard/SKILL.md`
- `.agents/skills/competitor-data-contracts/SKILL.md`
- `workshop/design/selected-all-companies.html`
- `workshop/design/company-detail-reference.html`
- `workshop/design/dashboard-fixture.json`
- `gtm-competitor-intelligence-design-system.md` (authoritative; do not copy it into chat)

Owned code is limited to the existing All Companies route and its focused components. If an API shape must change, stop and report the boundary.

## Run
Use the `dashboard-builder` agent. Implement populated, loading, stale, empty, and partial states. Preserve desktop/tablet/mobile hierarchy, keyboard order, chart alternative text, linked evidence, and visible observed/calculated/inferred labels.

Run `npm test -- tests/components/landscape.test.tsx tests/components/evidence-trace.test.tsx tests/components/state-matrix.test.tsx`.

## Acceptance
The KPI row is one ledger; the market map leads; attention signals are actionable; the leaderboard remains scannable; missing is never zero; all text has dark-on-light AA contrast.

## Return
Return only changed paths, states covered, responsive/accessibility checks, tests and status, plus any blocked boundary. Do not paste components or logs.
