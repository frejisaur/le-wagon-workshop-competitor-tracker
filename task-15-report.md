# Task 15 — complete UI state matrix, accessibility, and browser tests

## Skill and design-system application

- `building-competitor-dashboard` drove the retained-data state model, geometry-matched empty-cache skeleton, named recovery actions, live-region timing, keyboard focus behavior, responsive containment, and evidence-return workflow.
- `competitor-data-contracts` kept every fixture behind `LandscapeResponseSchema` or `CompanyResponseSchema`; fixtures contain only sanitized browser-domain values and preserve observed/calculated/inferred classifications.
- `agent-browser` supplied a named, localhost-allowlisted, content-bounded inspection at 1440x1000, 1024x768, and 390x844. The session verified accessible structure, viewport containment, chart-table availability, and mobile target geometry, then closed cleanly.
- `superpowers:test-driven-development` produced an initial five-failure RED state-matrix run before implementation and focused RED browser regressions before responsive/navigation fixes.
- Design specification sections 5 and 6 are reflected in landscape-to-company navigation and stable URL state; sections 11 and 12 in keyboard, screen-reader, focus, responsive, and reduced-motion behavior; section 14 in explicit current/loading/running/stale/partial/failed/empty states; section 16 in deterministic sanitized fixtures and end-to-end acceptance coverage.

## Changed files

- `tests/fixtures/api/dashboard-states.ts`
- `tests/fixtures/api/company-states.ts`
- `tests/components/state-matrix.test.tsx`
- `tests/components/company-route-boundary.test.ts`
- `tests/components/landscape.test.tsx`
- `tests/e2e/fixture-dashboard-service.ts`
- `tests/e2e/primary-workflows.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/responsive.spec.ts`
- `components/shared/ScreenState.tsx`
- `components/landscape/LandscapeScreen.tsx`
- `components/company/CompanyWorkspace.tsx`
- `components/company/company-tab.ts`
- `components/company/company.module.scss`
- `app/companies/[companyId]/page.tsx`
- `styles/globals.scss`
- `next.config.ts`
- `playwright.config.ts`

The company route/parser files were added to fix a production server/client import boundary revealed by real browser acceptance. The company module and global stylesheet changes provide 44px direct targets and prevent mobile grid children from expanding the document beyond 390px. These were explicit ownership expansions from the main session. The Next configuration exposes the fixture service alias only while `E2E_FIXTURES=1`; normal production configuration remains unchanged.

## UI states and classifications

- Landscape: current, empty-cache loading, refreshing with retained data, stale with retained data, partial with retained data, failed with retained data and retry, empty import, and named no-results constraints.
- Company: current, no meaningful paid activity, review required without publication, current published insight plus review candidate, and fingerprint mismatch with stale insight withholding.
- Skeletons render only without retained cache. Running, stale, partial, and failed states retain the last successful screen.
- Completed outcomes and filter counts use polite live regions; in-progress refresh text is not continuously announced. Clear and retry recovery controls preserve or restore focus.
- Provider observations remain `observed`, deterministic values remain `calculated`, and published battlecard claims remain `inferred`. No identity, evidence, fingerprint, confidence, or publication rule changed.

## Browser and accessibility acceptance

- Desktop 1440x1000, tablet 1024x768, and mobile 390x844: shareable/reload-safe filters, map-to-row selection and focus, company navigation with tab persistence, accessible chart table, battlecard-to-evidence-to-claim return, no-paid state, stale state, and keyboard traversal passed.
- Screen-reader checks cover skip-link/main focus, named regions/tabs/tables, polite filter/outcome announcements, stale/review status semantics, and an accessible tabular alternative for the visual chart.
- Mobile checks confirm no document overflow, the map table remains usable, direct tabs/evidence/return controls are at least 44px, and reduced-motion transition duration is effectively zero.
- Supplemental `agent-browser` inspection reported content widths of 1425/1440, 1009/1024, and 375/390; the active mobile tab and evidence link each measured 44px.

## Verification

- RED: `tests/components/state-matrix.test.tsx` initially failed five behaviors: running refresh announcements, clear-filter focus, missing retry action, review-only candidate visibility, and tab-preserving company navigation.
- Focused component/API presentation suite: 5 files, 64 tests passed; focused route/history/state suite: 4 files, 37 tests passed.
- Full Vitest: 31 files, 274 tests passed.
- Playwright: 16 passed and 2 intentional desktop/tablet skips for the mobile-only target/reduced-motion case; all 18 project cases accounted for with zero failures.
- Semrush schema drift check passed.
- `npx tsc --noEmit` passed.
- `npm run build -- --webpack` passed after the final conditional fixture configuration.
- Default `npm run build` was attempted. Turbopack reached Sass processing but the sandbox denied its helper process a local port (`Operation not permitted`); this is the known environment restriction, not an application compile error.
- `git diff --check` passed.
- Production `.next/static` plus scoped fixture/component source scans found no credentials, raw provider payload/reference markers, reviewer identity fields, fixture service marker, or E2E fixture flag in browser artifacts.

## Deviations and unresolved data-contract needs

- Playwright uses one worker because concurrent first-time Next dev compilation caused nondeterministic load timeouts; the workflow itself remains fully exercised at every configured viewport.
- No additional design system was installed. No external or live provider data was used.
- Unresolved data-contract needs: none.

Commit subject: `test: cover dashboard states and accessibility`.
