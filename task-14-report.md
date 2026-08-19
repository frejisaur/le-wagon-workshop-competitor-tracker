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

## Fix Round 2

- Persisted published claims now pass the canonical `CandidateClaimSchema` unchanged, including trimmed conclusion/reason text, bounded IDs/references, unique evidence references, collection-specific classification, and collection cardinality. Cross-collection duplicate claim IDs also fail closed.
- The response derives overall confidence from the lowest valid material-claim confidence. Stored aggregate confidence is no longer trusted, so malformed or optimistic historical values cannot overstate the published insight or throw the response shaper.
- Trace serialization enforces the 1,800 UTF-8 byte budget after every fallback. If a valid multibyte claim identifier itself makes a claim-only URL oversized, it is safely omitted and only `tab=evidence` remains.

Fix Round 2 validation: focused evidence/API/company tests 32 passed; full suite 29 files / 260 tests passed; TypeScript, schema drift check, Webpack production build, diff check, and browser artifact scan passed. The default Turbopack build remains blocked by the sandbox Sass-helper port binding restriction.

## Fix Round 3

- Published claim parsing now accepts only the exact canonical storage wire emitted by `toAirtableInsightFields`, including integer `evidenceRefCount` and `evidenceRefsRetainedCount` values that exactly match the retained evidence array. The storage-only metadata is removed before the strict `CandidateClaimSchema` projection; missing, inconsistent, or foreign fields fail closed.
- A mapper-to-snapshot-to-company-response regression verifies that a matching-fingerprint canonical record remains current and returns the original inferred claim. Malformed storage metadata, malformed claim data, unresolved evidence, duplicate claim IDs, and collection/classification violations continue to produce `Insight stale` with no published claim payload.
- Present non-string claim collections are no longer collapsed into absent optional collections. Values such as `Observed • Themes JSON: 42`, empty serialized values, invalid JSON, and non-array JSON are incomplete persisted insight data and withhold the insight.
- Evidence trace serialization now compares the normalized output with the complete caller-provided reference sequence. Dedupe, membership filtering, invalid-reference filtering, or the 100-reference cap triggers claim-only navigation when it fits the 1,800-byte UTF-8 budget, otherwise tab-only navigation. It never emits the first 100 members of a 101-reference trace; valid comma-bearing references still round-trip exactly.

Fix Round 3 validation: focused mapper/API/evidence/company tests 46 passed; full suite 29 files / 262 tests passed; schema drift check, TypeScript, Webpack production build, diff check, and browser bundle/raw-reference scans passed. The default Turbopack build was attempted and remains blocked by the sandbox Sass-helper local-port restriction (`Operation not permitted` while binding a port). No data identities, fingerprint inputs, evidence rules, confidence logic, deployment configuration, persisted record counts, or Airtable API-call expectations changed. Unresolved data-contract needs: none.
