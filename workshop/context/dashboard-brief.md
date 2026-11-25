# Dashboard task brief - All Companies restyle

A brief records **one task's decisions**. Reusable rules stay in the
`building-competitor-dashboard` skill; this file is thrown away after the task.

## Decision (filled live in segment 4)

- Selected direction: <!-- live --> option-?
- Why the room chose it (the marketer decision it serves): <!-- live -->

## Fixed constraints

- Restyle only: same data, same API, same components; change hierarchy, layout, emphasis, density.
- Every metric keeps its visible `observed` / `calculated` / `inferred` label.
- Keep populated, partial, stale, empty and error states working (`components/shared/ScreenState.tsx`).
- Desktop, tablet and 375px mobile without horizontal scroll; keyboard order follows the visual order.
- Tokens from `styles/tokens.css` only; no new colors or fonts.
- Styles: in `styles/globals.scss`, edit only the landscape blocks (`.landscape-*`, `.company-leaderboard`, `.market-map*`, `.attention-signals`). Shared blocks (`.kpi-ledger`, `.freshness`, `.screen-state`, `.app-shell`) may change only through a rule scoped under `.landscape-modules`, so other screens stay as they are.

## Acceptance (checked live in segment 6)

1. Side by side with the chosen option at 1440px: same hierarchy order.
2. `npx vitest run tests/components` passes, including the stale/partial/empty/error state matrix.
3. `npx tsc --noEmit` passes.
4. Tab through the screen: focus is visible and in order.
5. Company Detail looks exactly as before.
