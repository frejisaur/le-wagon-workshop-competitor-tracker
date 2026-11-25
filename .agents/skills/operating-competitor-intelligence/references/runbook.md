# Competitor intelligence runbook

## Command map

| Operation | Repository interface | Success evidence |
|-|-|-|
| Metric refresh | `npm run enrich` | The refresh workflow run (`refresh-…` ID) exits `succeeded` or documented `partial`; successful companies persist; cache invalidates after writes. |
| Prepare due insights | `npm run insights:prepare -- --due` | Bounded manifest contains only due companies and current fingerprints. |
| Submit candidate | `npm run insights:submit -- <candidate-file>` | Result identifies published, queued, stale, or rejected with run/company identity. |
| Promote reviews | `npm run insights:publish-approved` | Companies rows with `Review • Status` = `approved` publish when current; changed fingerprints become `stale`. |
| Web health | Application health endpoint defined by implementation | Service is reachable and reports data freshness without exposing secrets. |

Inspect `package.json` and application routes for the implemented interface
before running a command. If an interface is absent, stop and report the missing
implementation rather than inventing a substitute.

## Failure classification

| Failure | Safe response |
|-|-|
| Apify timeout or failed batch | Retry with bounded backoff; retain other batches and record company failures. |
| Airtable `429` | Honor retry timing and use exponential backoff with jitter. |
| Partial transform validation | Omit malformed nested modules; retain valid top-level company data. |
| Agent/model unavailable | Leave published insights unchanged; metric refresh remains independent. |
| Candidate fingerprint mismatch | Mark stale; prepare fresh work instead of publishing. |
| Cache invalidation failure | Keep serving last successful cache, report stale status, retry invalidation after confirming writes. |
| Refresh workflow run still in progress | Do not overlap manually; `concurrency: refresh` queues a dispatched run. Inspect with `gh run watch`, then wait or cancel through an approved operator action. |

## Workshop fallback order

1. Keep the working Apollo CSV as the starting artifact.
2. Attempt one bounded live Apify batch only.
3. If it is slow or fails, disclose the switch and use the sanitized scraper
   fixture.
4. Use pre-generated valid candidates if live model generation is unavailable.
5. Demonstrate submission, review routing, approval, and publication against the
   non-production Airtable base.
6. End with freshness and separate refresh workflow (GitHub Actions) and agent workflow statuses.

The fallback demonstrates the same contracts as the live path; it must not use
hand-edited output that bypasses validation.
