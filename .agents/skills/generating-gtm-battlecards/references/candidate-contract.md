# Battlecard candidate contract

The repository schema is authoritative. A candidate must represent these
concepts even if implementation field names are refined:

| Concept | Requirement |
|-|-|
| Company | Stable company identity and normalized domain. |
| Provenance | Run ID, harness, model, skill version, workflow version, generated timestamp. |
| Evidence state | Exact current agent-evidence fingerprint. |
| Observed themes | Concise summaries of measured signals, labeled observed. |
| Conclusions | Inferred claims (strengths, vulnerabilities, AI-search position) and recommendations for the response. There are no free-text summary fields. |
| Claims | Conclusion, `observed` or `inferred` classification, confidence, confidence reason, and evidence references. |
| Review | Machine-readable review reasons; empty only when every publication gate passes. |

Every published claim therefore carries its conclusion, confidence, evidence
references, the evidence fingerprint, run ID, harness, model, skill and
workflow versions, and generation time. An inference is never presented as a
directly measured field.

Evidence references must resolve to records in the prepared package or to its
raw dataset references. A URL alone is not evidence unless the package gives it
a stable reference. Every strategic recommendation must cite the observations
that motivate it.

Omit paid-message claims when the package lacks meaningful paid data. Do not
emit empty persuasive prose. Preserve uncertainty and conflicting signals in
the candidate rather than resolving them through guesswork.

Submission is idempotent by company, evidence fingerprint, skill version, and
workflow version. The candidate must not choose an Airtable record ID or a
publication status.

## Lifecycle

A company is due when it has no published battlecard, its next-insight time has
passed, its current evidence fingerprint differs from the published one, its
skill version changed, or a reviewer requested regeneration. Selection uses
these timestamps and fingerprints rather than a weekday, so a missed schedule
catches up on the next run. A current pending or approved review candidate is
not overwritten unless it is stale or a reviewer requested another attempt.

The submission command publishes automatically only when the candidate passes
the schema, every claim has resolvable evidence, its fingerprint matches the
freshly prepared package, it has no review reason, and its overall confidence
is `high`. Every other valid candidate becomes the company's review candidate
with status `needs_review`, and the published battlecard stays in place.

Review status moves through `needs_review`, `approved` or `rejected`, then
`published` or `stale`. A reviewer edits status and notes on the Companies row.
`npm run insights:publish-approved` re-prepares each approved candidate,
publishes it only if its fingerprint is still current, and otherwise marks it
`stale`. Rejected candidates keep their reviewer notes for the next attempt.
Replaying a submission or promotion never duplicates a battlecard or review.
The dashboard shows a promotion once its snapshot expires, within 60 seconds.
