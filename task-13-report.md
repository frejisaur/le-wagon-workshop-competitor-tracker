# Task 13 — company detail research workspaces

## Skill impact

- `building-competitor-dashboard` set the workspace-tab hierarchy, continuous KPI ledger, Carbon tab/table controls, explicit data states, chart alternatives, responsive behavior, and keyboard operation.
- `competitor-data-contracts` kept every rendered value inside the validated `CompanyResponse` boundary. Browser components consume no raw provider payloads and retain observed/calculated provenance.

## RED → GREEN

- RED: `npm test -- --run tests/components/company-research.test.tsx` failed because `CompanyWorkspace` did not exist.
- GREEN: focused workspace plus company-shaper tests pass (10 tests), including the explicit comparison list cap.

## Workspace behavior

- The company route validates `companyId`, reads the server dashboard service directly, returns 404 for unknown identities, and never self-fetches an API route.
- `tab` accepts only `overview`, `search`, `ai`, `authority`, `paid`, `battlecard`, and `evidence`; invalid values canonicalize to Overview. Paid is omitted and `tab=paid` is normalized away when no positive ad, traffic, or keyword evidence exists.
- Carbon workspace tabs are scrollable, keyboard-operable, history/popstate-safe, and use no nested-link workaround. Battlecard and Evidence deliberately remain explicit placeholders for Task 14.
- Overview contains the shared continuous KPI ledger, 24-month organic trend, demand band, observed keyword sample, self-excluding organic competitors, meaningful AI geography, and the exact no-paid statement.
- Search, AI, Authority, and conditional Paid workspaces render complete validated modules. Malformed nested subsections fail soft while company identity/KPIs remain visible. Missing observations remain gaps and `Not available`, never zero.
- Every visualization includes adjacent text plus a structured data table. Historical tooltip disclosure exposes exact date/value/source/database. Explicit comparison input is typed, never fetched/invented, capped deterministically at three, and listed accessibly.

## Minimal response-shaping correction

Calculated compact organic-trend points now copy the curated observed provider source/database into their already allow-listed `DashboardValue`. This supplies the required tooltip provenance without expanding raw-data exposure, changing identities, evidence fingerprints, confidence, or deployment configuration. The company response test covers it.

## States and accessibility covered

Populated/current, loading through shared skeleton behavior, partial retained, stale retained, failure retained, paid absent, malformed authority, absent keyword/page data, absent geography/model data, chart gaps, safe external links, sticky table headings, right-aligned data, mobile two-column ledger, full-width min-height chart, and keyboard tabs.

## Validation

- `npm test -- --run tests/components/company-research.test.tsx tests/api/company.test.ts` — 10 passed.
- `npm test` — 28 files / 236 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run build -- --webpack` — passed.
- `npm run build` — blocked by the sandbox’s Turbopack Sass-helper local-port restriction (`Operation not permitted`), not application code.
- `git diff --check` — passed.

## Unresolved data-contract needs

None for Task 13. `CompanyResponse` does not yet include a second historical metric, so the metric control explicitly marks organic-keyword history unavailable instead of fabricating a series.
