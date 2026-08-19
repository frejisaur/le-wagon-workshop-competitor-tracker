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

## Fix Round 1

- The demand band now uses validated `0..1` share values as proportional flex weights: the tested 70% non-brand value produces a 70/30 non-brand/branded band. Out-of-range or unavailable values render no band.
- Company comparison now uses the shared server snapshot through `DashboardService.companyWorkspace`, capped at 52 deterministic sanitized `CompanyResponse` records for the workshop cohort. The client can select at most two additional companies, giving three plotted/tabled series including the researched company; the historical table retains per-date value, provenance, and gaps.
- Keyword evidence now includes observed CPC USD, difficulty, and intents. Missing values remain `Not available`.
- The response allow-list now includes classified paid-competitor samples plus calculated Moz domain authority, spam score, and validated top-page URLs. Authority and AI modules explicitly state that anchor/backlink/linking-source/cited-source-domain samples are unavailable when they are absent from the curated snapshot.
- Self competitors are removed with the shared server domain normalizer and rechecked in the browser. This covers bare domains and URL/www/path/port variants.
- Paid content is runtime-validated before determining visibility or rendering; malformed nested paid data fails soft while the identity/KPI header remains usable.
- Task 13 canonicalization now emits only `?tab=<valid-tab>` or no query. Foreign/invalid parameters are removed on hydration, selection, and popstate; Task 14 can extend this explicit allow-list when claim/evidence navigation is implemented.

The plotted comparison series has an explicit regression assertion for two selected companies, and its point disclosure reports the selected company alongside date, value, source, and database.

Fix Round 1 validation: focused tests 18 passed; full suite 28 files / 242 tests passed; schema drift check, TypeScript, Webpack build, and diff check passed. The default Turbopack build remains blocked by the sandbox Sass-helper port binding restriction.

## Fix Round 2

- Paid competitor rows now have a dedicated strict contract (`paidTraffic`, `paidKeywords`, and common keywords), sourced from validated Semrush `ad_traffic` and `paid_keywords`. The transform, Airtable mapper, response shaper, and paid table regression use distinct paid/organic values to prevent cross-field display.
- The browser competitor defense now calls the shared normalizer. It handles a parseable URL directly and normalizes lowercase hostnames, `www`, trailing dots, default ports, and paths before self exclusion.
- Workspace comparisons now use a strict `CompanyComparison` projection: company ID, display identity, and compact validated trend only. The server builds selected detail plus at most 51 deterministically ordered comparisons from one cached snapshot, keeping each workspace response at 52 companies maximum and excluding insight, evidence, review, and raw fields.
- Demand composition now accurately identifies itself as a calculation from latest branded and non-brand organic-traffic trend evidence; it remains a calculated value.

Fix Round 2 validation: focused transform/mapper/API/component tests 44 passed; full suite 28 files / 246 tests passed; schema drift check, TypeScript, Webpack build, and diff check passed. The default Turbopack build remains blocked by the sandbox Sass-helper port binding restriction.
