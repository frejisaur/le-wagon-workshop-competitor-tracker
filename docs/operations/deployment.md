# Railway deployment contract

This is an operator-run procedure. Never deploy, clean up, or mutate production unattended. Both services build the same repository revision with the root `Dockerfile` and share the Airtable variables and cache-signing secret; provider credentials and the web target remain refresh-only. Railway config-as-code applies to one service at a time, so `railway.toml` owns only the shared image build; verify the following service-specific settings in Railway before every release. The image deliberately has no Docker-level health check because the terminating cron does not serve HTTP.

## Secret-safe preflight

Check only whether each required name is **present** or **missing**. Never print, echo, log, paste, or browser-expose its value.

Use an Airtable PAT limited to the selected base with
`data.records:read`, `data.records:write`, `schema.bases:read`, and
`schema.bases:write`. The schema command creates missing tables and fields, so
read-only schema access is insufficient.

| Variable | Web | Weekly refresh |
|---|---:|---:|
| `AIRTABLE_PAT` | present | present |
| `AIRTABLE_BASE_ID` | present | present |
| `AIRTABLE_*_TABLE` names | present | present |
| `APIFY_TOKEN` | not required | present |
| `APIFY_ACTOR_ID` | not required | present |
| `APP_BASE_URL` | not required | present |
| `CACHE_INVALIDATION_SECRET` | present | present |

The preflight output must contain variable name plus `present`/`missing` only. Abort on any required `missing` result. Ensure no secret is named `NEXT_PUBLIC_*`.

The web service must not receive `APIFY_TOKEN` or `APP_BASE_URL`; both services receive the same server-only `CACHE_INVALIDATION_SECRET`; the refresh service has no public domain.

## Web service

- Image: repository root `Dockerfile` (Node 22).
- Start command: `npm start`.
- Public domain: enabled for this service only.
- Health check: `GET /api/health`; require `200`, `status: ok`, and non-secret freshness metadata.
- Restart policy: `ON_FAILURE`, maximum 3 restarts.
- Server variables: Airtable names plus `CACHE_INVALIDATION_SECRET`; no `APIFY_TOKEN`, `APIFY_ACTOR_ID`, or `APP_BASE_URL`.

After a non-production deployment, open a fresh browser session and verify landscape, company, battlecard, evidence, keyboard navigation, and current/stale/partial states. A production smoke test requires an operator and explicit approval.

## Terminating weekly refresh service

Create a separate Railway cron service from the same repository revision and set
its **configuration path** to `/railway.cron.toml`. The root `railway.toml` stays
build-only for the web service. Railway alone owns the cadence; each invocation
starts the Apify actor through the REST API and this project creates no Apify
schedule.

- Image: the exact same revision and `Dockerfile` as web.
- Workload command: `npm run enrich`.
- Railway start command (hard timeout): `/usr/bin/timeout --signal=TERM --kill-after=30s 15m npm run enrich`.
- Cron schedule: `0 15 * * 1` (Monday 15:00 UTC).
- Public networking: **no public domain**.
- Restart policy: `NEVER`; failed scheduled runs require operator review. The command must exit after success or failure so schedules cannot overlap. The job installs a 14-minute internal deadline so it can publish a bounded terminal state before Railway's 15-minute outer termination.
- Server variables: Airtable names, `APIFY_TOKEN`, `APIFY_ACTOR_ID`, `APP_BASE_URL`, and the same `CACHE_INVALIDATION_SECRET` used by web.

Before a non-production refresh, export the `System` table row as a sanitized before snapshot. After it terminates, capture the after snapshot and verify a new independent refresh run ID, `last_attempt_at`, per-company successes/failures, and `last_successful_at` only when appropriate. Partial refreshes must retain successful companies and the previous publication. Cache invalidation must call the configured `APP_BASE_URL` server endpoint with the `CACHE_INVALIDATION_SECRET` signature; record status only, never the signature.

Do not run destructive cleanup, live Airtable writes, live Apify calls, Railway deploys, or production smoke tests from automation. Operators must approve each live command and validate expected counts/status first.
