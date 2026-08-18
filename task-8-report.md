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
