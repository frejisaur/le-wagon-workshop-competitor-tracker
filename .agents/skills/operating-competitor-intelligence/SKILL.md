---
name: operating-competitor-intelligence
description: Use when running or diagnosing competitor refreshes, checking data freshness or workflow status, handling partial failures, processing approved reviews, validating Railway deployment behavior, or recovering the 90-minute workshop through fixtures and prepared candidates.
---

# Operating Competitor Intelligence

Prefer safe, idempotent repository commands and preserve the last successful
data or insight when an external dependency fails.

## Workflow

1. Read [references/runbook.md](references/runbook.md) and inspect the current
   `package.json` scripts. Do not claim an operation is available when its
   repository command has not been implemented.
2. Identify the requested control plane:
   - Railway metric refresh
   - Agent-harness insight enrichment
   - Review promotion
   - Web/cache health
   - Workshop fallback
3. Run preflight checks without printing secret values. Report each required
   variable as present or missing and use a non-production base for smoke tests.
4. Capture the current System status, run IDs, freshness, and affected company
   count before changing state.
5. Use the narrowest supported command. Do not write directly to Airtable or
   replay raw requests by hand.
6. On failure, preserve successful company results, classify the failure, and
   retry only when the operation is documented as idempotent. Never invalidate
   the web cache before writes or promotion complete.
7. Re-read status and run a focused smoke check. Compare new run IDs and
   timestamps with the pre-run snapshot.
8. Return the handoff format below.

## Incident handoff

Report:

- Control plane and command used.
- Before/after status, run ID, and freshness.
- Processed, succeeded, failed, queued, and stale counts when applicable.
- Affected company identities without full raw records.
- Retry or fallback performed.
- Safest next action and whether human review is required.

## Safety boundaries

- Never display or log credentials, authorization headers, or full environment
  values.
- Never let an agent outage block deterministic metric refresh.
- Never erase published insights because a refresh or generation run failed.
- Never publish a stale candidate.
- Never run an unattended production deployment or destructive cleanup.
- When live services threaten the workshop timeline, switch to the documented
  fixture path and disclose the fallback.

