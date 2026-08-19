# Task 8 — evidence-backed insight lifecycle

## Skill impact

- `competitor-data-contracts` kept raw provider records behind Task 7's curated preparation package and made its canonical package fingerprint the sole lifecycle fingerprint.
- `generating-gtm-battlecards` supplied the structured-candidate, evidence, idempotency, review-routing, and promotion rules implemented here.

## RED → GREEN

Initial lifecycle tests failed because `lib/agents/publication/submit` and `publish-approved` did not exist. The new sanitized tests now cover auto-publication, low/conflicting queueing, malformed/unresolved rejection, prompt-injection routing, deterministic retry, bounded review reasons, current approved promotion, and stale approval preservation.

## Contract decisions

- Candidate input is strict Zod output with no Airtable record IDs, publication status, raw provider objects, or caller-supplied aggregate confidence.
- Every stored candidate claim must retain one or more references resolvable against the current prepared package. Unresolved references reject before any write.
- Overall confidence is calculated as the lowest material-claim confidence. It is persisted for display but never trusted from candidate input.
- The current Task 7 preparation fingerprint (`fingerprintEvidence` over the curated package) is authoritative. `Company.Workflow • Evidence Fingerprint` is never consulted for submit or promotion.
- Submission identity is `(companyId, preparationFingerprint, skillVersion, workflowVersion)`; `runId` is provenance only, so retries return their existing result without write duplication.
- Review rows are keyed by company and reused. Published insights are now also upserted by company, enforcing one current published row while retaining the immutable generated `Insight ID` as provenance. Existing Airtable bases with duplicate published rows fail closed with `duplicate_published_insights`; clean-up is a manual migration operation.

## State table

| Condition | Result | Writes |
|---|---|---|
| Strict schema/evidence refs invalid | rejected | none |
| Current high confidence, no gates | published | one company-linked insight |
| Low/medium or deterministic gate | queued | one reusable review row |
| Current package fingerprint drift | stale | review marked stale |
| Matching submission retry | prior outcome | none |
| Approved review, current package | published | insight then review `published` |
| Approved review, drifted package | stale | review only; prior insight remains |

## Validation and commands

- `npm test -- --run tests/agents/submission.test.ts tests/agents/publication.test.ts`
- `npm test -- --run tests/agents`
- `npm test`
- `node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check`
- `npx tsc --noEmit`
- `npm run build`
- Fixture CLIs: high candidate publishes, low/conflicting queues, malformed rejects, and current approval promotes using `tests/fixtures/insights/`.

## Unresolved interface questions

- Airtable must expose the newly written `Inferred • Overall Confidence` field on GTM Insights and Insight Reviews if it is not already configured. Absent fields are an Airtable-base configuration concern, not a browser contract.
- Existing bases containing more than one GTM Insight for the same company require manual consolidation before replacement writes are permitted.

## Commit

`feat: gate and publish evidence-backed insights`

## Fix Round 1

- Removed free-form candidate, review, and published summary fields. Published content now consists only of classified claims with validated evidence references; unsupported paid or AI prose is rejected by the strict candidate boundary.
- Replaced legacy reason aliases with the versioned rubric names: `unresolved_evidence_reference`, `conflicting_sources`, and `ambiguous_company_identity`. Unknown stored reasons now fail promotion closed.
- Submission now computes fresh preparation state before replay matching, serializes same-company submissions in-process, rejects duplicate review rows, and permits a reviewer-requested regeneration to replace the reusable candidate while retaining reviewer metadata.
- Removed mapper truncation of claims, reasons, and references. Candidates that exceed retained Airtable JSON/cardinality limits reject before writes, so stored validated claims remain byte-identical.
- Fixture commands support `--fixture-output-state`; state is atomically written only to an explicit path different from the input. Reload-style tests cover submit, idempotent retry, and promotion.
- Prepared evidence values and reviewer notes receive bounded recursive injection scanning. They are routed with `prompt_injection_content` and never emitted by the result envelope.
- Submit results now always expose `status`, `companyId`, `runId`, and `reasons` (with typed idempotency/confidence metadata).

Operational limitation: Airtable does not offer a server-side unique constraint for the company-linked review row. The adapters and lifecycle fail closed on duplicates, and concurrent writers from separate processes still require a serialized operational run/migration policy.

## Fix Round 2

- Published-insight replacements explicitly write `null` for the three retired free-form prose columns (`Inferred • Summary`, `Inferred • Paid Message Summary`, and `Inferred • AI Search Summary`). This prevents Airtable PATCH from retaining old uncited prose while retaining the validated claim fields.
- Injection scanning now checks full strings and object keys with one bounded package-wide traversal budget. Exhausting that budget fails closed into `prompt_injection_content`; no tail content is skipped.
- Candidate text is validated as already trimmed instead of normalized. Accepted claim conclusion/reason bytes are persisted unchanged; whitespace-padded candidate text rejects before writes.
- Fixture promotion coverage now proves stale approved state is written only to an explicit output file, leaves the source fixture byte-identical, retains its prior published insight, and marks the review stale.

## Fix Round 3 (test-only)

- Added coverage for the character-budget exhaustion branch using benign prepared evidence larger than one million characters. It queues with only `prompt_injection_content`: the fail-closed scan condition is the sole deterministic gate in this fixture, and the result envelope does not expose the oversized input.
- Added reload-style stale fixture coverage. The first approved-to-stale transition preserves the prior insight; a second invocation reads the first explicit output, produces no publication or second stale transition because the review is no longer approved, preserves the first output bytes, and retains the stale review and prior insight.
