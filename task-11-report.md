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
