# Task 14 — battlecard claim-to-evidence trace

## Skill impact

- `building-competitor-dashboard` established Battlecard and Evidence as sibling workspace tabs, the 160ms persistent evidence highlight, mobile single-column reading, keyboard return behavior, and the explicit stale/review states.
- `competitor-data-contracts` kept browser components on the strict `CompanyResponse` projection: evidence remains classified, raw dataset references and Airtable identifiers remain server-only, and only a curated published workflow subset crosses the API boundary.
- `generating-gtm-battlecards` preserved publication semantics: the current published insight is the sole rendered claim source; a review candidate adds a non-destructive notice and a stale fingerprint withholds claims.

## Changed files

- `components/company/Battlecard.tsx`
- `components/company/EvidenceWorkspace.tsx`
- `components/company/EvidenceRow.tsx`
- `components/company/evidence-navigation.ts`
- `components/company/CompanyWorkspace.tsx`
- `components/company/company.module.scss`
- `lib/domain/dashboard.ts`
- `lib/api/shape-company.ts`
- `tests/components/evidence-trace.test.tsx`
- `tests/api/company.test.ts`

## Behavior and states

- Published conclusion and confidence lead the Battlecard; observed claims and inferred recommendations remain visually distinct and each claim has a stable DOM/test target plus a current-evidence-only count link.
- Evidence navigation accepts only `tab`, `claim`, and `evidence`; it canonicalizes order, drops foreign members/keys, deduplicates, bounds references at 100, highlights exact rows, and retains a bounded same-origin return state.
- Return restores the Battlecard URL, stored scroll position, and claim focus. Direct/shared and popstate URLs use a safe Battlecard fallback and do not steal focus.
- Evidence displays stable refs, classification, source, optional database/timestamp, escaped value text or JSON, the browser-safe raw-reference notice, and current published workflow context.
- Current published insight plus review candidate, stale insight withholding, empty evidence, populated evidence, invalid/missing trace refs, responsive evidence layout, reduced motion, keyboard tabs, and XSS-shaped text are covered.

## Response contract

`publishedInsight.workflow` now contains only current curated metadata: `evidenceFingerprint`, `runId`, `harness`, `model`, `skillVersion`, and `workflowVersion`. Reviewer identity/notes, Airtable IDs, raw dataset references, and provider URLs remain absent.

## Validation

- RED captured: trace test initially failed because `evidence-navigation` did not exist.
- `npm test -- --run tests/components/evidence-trace.test.tsx tests/components/company-research.test.tsx tests/api/company.test.ts` — 24 passed.
- `npm test` — 29 files / 252 tests passed.
- `node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check` — passed.
- `npx tsc --noEmit` — passed.
- `npm run build -- --webpack` — passed.
- `npm run build` — blocked by the known sandbox Turbopack Sass-helper local-port restriction, not application code.
- `git diff --check` — passed.
- Browser artifact scan of `.next/static` found no raw-reference markers, Airtable identifiers, reviewer fields, provider credentials, or test sentinels.

## Unresolved data-contract needs

None. The existing curated evidence and published workflow fields supply the required safe browser projection.

## Fix Round 1

- Evidence trace identifiers now align with the candidate contract: claim IDs permit 200 characters and references permit 500. Each reference is individually percent-encoded before joining, preserving commas through parse, serialization, Battlecard selection, and row highlighting.
- Shared trace URLs are capped at 1,800 bytes. A complete valid reference set that exceeds the budget writes canonical claim-only navigation; the Evidence workspace resolves that claim against the current published response, so it still highlights the complete supporting set. Oversize URLs without a valid claim retain no evidence selection.
- Battlecard leads now prefer the first inferred claim, clearly label it as an agent interpretation, show its own confidence/reason, and keep overall insight confidence separate. An observed-only insight is explicitly labeled as an observed finding. The lead is the claim target and is not duplicated below.
- Review reasons are now validated against `CandidateReviewReasonSchema`, deduplicated, sorted, capped at seven, and mapped to fixed user-facing copy. Unknown or prompt-shaped Airtable text never reaches the browser.
- A published insight now remains current only when its fingerprint matches, at least one claim parses, every stored claim collection parses without omissions, and every reference resolves in the current evidence. Any malformed or unresolved stored claim fails closed to `Insight stale` and withholds all claims.

Fix Round 1 validation: focused component/API/company tests 30 passed; full suite 29 files / 258 tests passed; TypeScript, schema drift check, Webpack production build, diff check, and browser artifact scan passed. The default Turbopack build remains blocked by the sandbox Sass-helper port binding restriction.
