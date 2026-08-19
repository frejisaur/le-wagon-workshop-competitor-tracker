# Task 12 — competitive landscape screen

## Skill impact

- `building-competitor-dashboard` set the landscape-led hierarchy, continuous KPI
  ledger, Carbon-only filters/table foundation, explicit missing-data treatment,
  map fallback, keyboard behavior, and the desktop/tablet/mobile presentation.
- `competitor-data-contracts` kept the browser boundary on validated
  `LandscapeResponse` values. The only contract correction adds curated optional
  observed `country` and `segment` identity values to each company summary from
  the same allow-listed Airtable fields already used to create the filter lists.
  No raw record, provider payload, evidence reference, identity, confidence, or
  deployment behavior changed.

## RED → GREEN

- RED: `npm test -- tests/components/landscape.test.tsx` initially failed because
  the landscape modules did not exist.
- GREEN: focused landscape plus API shaping tests pass (13 tests). The full
  suite passes (27 files, 224 tests).

## State and filter contracts

- URL state is strictly bounded and canonically serialized in this order:
  `country`, `paid`, `ai`, `trafficMin`, `trafficMax`, `authorityMin`,
  `authorityMax`, `segment`, `sort`, `selectedCompany`. Invalid values and
  unrelated keys are discarded. Valid sort persists through filter updates;
  browser history popstate restores the canonical state without a hydration
  mismatch.
- Country/segment now filter against curated per-company summary values, with an
  explicit `Not available` choice for nulls. Paid and AI filters likewise retain
  unknowns, and numeric filters reject invalid/bounds-reversed input.
- One filtered/sorted company set drives coverage-aware KPIs, map rows,
  deterministic 3–5 attention signals, and leaderboard rows. Missing values are
  never treated as zero.
- Loading, empty, running/retained, partial, stale, and failed states use the
  shared `ScreenState`; full loading renders the dashboard-shaped skeleton.

## Accessibility and responsive validation

- Market map labels authority and logarithmic organic traffic axes, exposes
  company/domain/value button names, supports arrow traversal in leaderboard
  order, focuses the selected leaderboard row, and includes a structured
  accessible data table. Incomplete/zero-log records are explicitly excluded.
- Leaderboard has sortable controls and correct `aria-sort`, row selection,
  canonical company links, explicit unavailable text, and the shared freshness
  disclosure.
- At `<768px`, the single semantic table becomes prioritized disclosure rows;
  at `768–1279px` supplementary columns are removed; at `>=1280px` the full
  comparison columns and split map/signals layout return. No duplicate table is
  introduced for mobile.

## Validation

- `npm test -- tests/components/landscape.test.tsx tests/api/dashboard.test.ts` — 13 passed.
- `npm test` — 27 files / 224 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run build` — Turbopack blocked by the sandbox Sass helper’s local-port
  bind (`Operation not permitted`), not by application code.
- `npm run build -- --webpack` — passed.
- `git diff --check` — passed.

## Unresolved data-contract needs

None. The minimal country/segment association correction is now covered by the
dashboard response test and remains entirely inside the curated allow-list.
