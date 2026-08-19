# Dashboard skill discovery brief

## Outcome
Draft a disposable skill candidate for implementing the All Companies and Company Detail experiences from bounded visual references.

## Inputs
- `workshop/design/selected-all-companies.html`
- `workshop/design/company-detail-reference.html`
- `workshop/design/dashboard-fixture.json`
- `tests/components/state-matrix.test.tsx`

## Rules to discover
Keep evidence traceable; distinguish observed, calculated, and inferred content; cover responsive and keyboard behavior; specify empty/loading/stale states; and name the narrow test.

## Non-goals
Do not rebuild the whole app, change API shapes, copy the canonical skill, or create a discoverable skill.

## Audit
`npm run workshop:audit-skill -- --contract dashboard --candidate workshop/generated/building-competitor-dashboard/SKILL.md --canonical .agents/skills/building-competitor-dashboard/SKILL.md`
