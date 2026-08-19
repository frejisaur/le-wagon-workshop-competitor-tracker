# Task 11 — research dashboard design foundation

## Skill impact

- `building-competitor-dashboard` set the landscape/workspace shell hierarchy,
  continuous five-value KPI ledger, explicit status/freshness language,
  responsive breakpoints, loading geometry, and accessibility behavior.
- `competitor-data-contracts` kept the presentation layer limited to the Task 10
  `DashboardValue`, `Freshness`, and `DashboardStatus` contracts. The new UI
  neither reshapes raw provider data nor changes identities, evidence, or
  battlecard confidence.

## RED → GREEN

- RED: `npm test -- tests/components/shared-components.test.tsx` failed because
  the shared components did not exist.
- GREEN: the focused suite now has 11 passing semantic/accessibility/state and
  CSS-token assertions.

## Design decisions

- Added the approved semantic color, type, spacing, radius, layer, layout,
  breakpoint, touch-target, and motion tokens. All new styles consume those
  tokens. Page modules use rules and surface contrast, without gradients or
  shadows.
- The root contains one Carbon `Theme` in the light `white` theme. The styles
  use IBM Plex Sans/Mono first with browser-safe fallbacks; no remote font CSS is
  imported, and emitted CSS was checked for remote font hosts.
- The desktop shell has the prescribed 48px header, 192px navigation rail, and
  1600px content maximum. Tablet keeps the content canvas while mobile removes
  the rail and converts the ledger to a shared two-column grid.
- `KpiLedger` remains one semantic list/ledger with internal dividers, up to five
  values, provenance labels, explicit unknowns, and text movement descriptions.
- `ScreenState` covers loading, empty, stale, partial, failed, and unknown
  recovery. Stale/partial/failed states retain supplied last-successful content.
  Full-screen loading uses dashboard-shaped skeleton regions.

## Accessibility

- Semantic header, navigation, aside, main consumer contract, heading support,
  and a focusable skip link are included.
- Global visible focus, 44px touch targets where applicable, keyboard-accessible
  freshness tooltip, text-bearing workflow statuses, and reduced-motion rules
  are present. Live-region attributes are opt-in through `announce`, so static
  status render does not create continuous announcements.

## Validation

- `npm test -- tests/components/shared-components.test.tsx` — 11 passed.
- `npm test` — 26 files / 210 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run build -- --webpack` — passed.
- `git diff --check` — passed.
- Inspected emitted CSS: semantic shell and reduced-motion rules are present;
  no remote font host was emitted.

`npm run build` through Turbopack remains blocked in this sandbox because its
Sass helper cannot bind a local port (`Operation not permitted`). The equivalent
Webpack production build completed successfully.

## Unresolved data-contract needs

None. The Task 10 classified response contracts already contain the values this
foundation renders.

## Fix Round 1

- `AppShell` now owns the only `main#main-content` landmark and programmatic
  focus target. The home route supplies page content instead of nesting a main.
- KPI movements now show their own provenance classification and require the
  caller to provide `beneficial`, `adverse`, or `neutral` meaning. Numeric sign
  only determines the `Increased`/`Decreased` text; it no longer determines
  status color.
- Retained loading/running content states explicitly say `Refresh running`.
  Failed states only claim that a last successful snapshot is available when it
  was supplied.
- Freshness is a click/touch/keyboard disclosure. It uses one visible name,
  only associates the exact timestamp as a description while open, and Escape
  closes the hidden tooltip.
- Carbon reset/theme Sass is included once before product overrides. The root
  loads locally bundled IBM Plex Sans and Mono through `next/font/local` at
  weights 400/500/600; emitted assets are local `/_next/static/media` WOFF2
  files, and no external font host is present.
- Additional tokens cover focus, rule widths, status, tooltip, skeleton, and
  layout values. Authored style rules now contain no non-token px/rem/ms/color
  literals outside the documented approved breakpoint media queries.
- The loading ledger now renders five cells and inherits the same desktop and
  mobile ledger grid/divider rules as populated KPI content.

Fix Round 1 validation: focused suite (14 passed), full suite (213 passed),
TypeScript, Webpack production build, diff check, and emitted Carbon/local-font
CSS scan passed. Default Turbopack remains restricted by the sandbox Sass
helper local-port limitation.

## Fix Round 2

### RED → GREEN

- RED: four focused regressions failed for the Carbon selector mismatch, the
  no-retained running state, absent page-title rule, and insufficiently scoped
  movement-classification rule.
- GREEN: the focused suite now has 18 passing tests. It renders Carbon's actual
  `Theme theme="white"` class and compiles the Sass to confirm `--cds-*`
  variables are scoped to that emitted `.cds--white` selector.

### Decisions and accessibility

- The one Carbon light theme is now scoped to `.cds--white`, which is exactly
  the class emitted by Carbon's root `Theme`; no second theme was introduced.
- A running refresh with no retained data shows `Refresh running` and the same
  dashboard-shaped five-cell skeleton used by the loading state. The optional
  live announcement remains attached only to the meaningful notice.
- The reusable `.page-title` restores the approved tokenized 24px/30px/500
  hierarchy after Carbon's reset.
- Movement provenance uses `--color-text-secondary` rather than the quieter
  text token. The regression test checks its rendered class, compiled style,
  and AA contrast ratio against both raised-white and subtle surfaces.

### Fix Round 2 validation

- `npm test -- tests/components/shared-components.test.tsx` — 18 passed.
- `npm test` — 26 files / 217 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run build` — blocked only by the sandbox's Turbopack Sass-helper local
  port restriction (`Operation not permitted`).
- `npm run build -- --webpack` — passed.
- Emitted Webpack CSS contains local `@font-face` WOFF2 assets, `.cds--white`
  Carbon variables including `--cds-background`, and the optimized
  `.page-title,.workflow-status` weight rule; no external font URL was found.
- `git diff --check` — passed.
