# Railway deployment contract

This is an operator-run procedure. Never deploy, clean up, or mutate production unattended. Both services build the same repository revision with the root `Dockerfile` and use the same variable names. Railway config-as-code applies to one service at a time, so `railway.toml` owns only the shared image build; verify the following service-specific settings in Railway before every release. The image deliberately has no Docker-level health check because the terminating cron does not serve HTTP.

## Secret-safe preflight

Check only whether each required name is **present** or **missing**. Never print, echo, log, paste, or browser-expose its value.

| Variable | Web | Weekly refresh |
|---|---:|---:|
| `AIRTABLE_PAT` | present | present |
| `AIRTABLE_BASE_ID` | present | present |
| `AIRTABLE_*_TABLE` names | present | present |
| `APIFY_TOKEN` | not required | present |
| `APIFY_ACTOR_ID` | not required | present |
| `APP_BASE_URL` | not required | present |
| `CACHE_INVALIDATION_SECRET` | not required | present |

The preflight output must contain variable name plus `present`/`missing` only. Abort on any required `missing` result. Ensure no secret is named `NEXT_PUBLIC_*`.

## Web service

- Image: repository root `Dockerfile` (Node 22).
- Start command: `npm start`.
- Public domain: enabled for this service only.
- Health check: `GET /api/health`; require `200`, `status: ok`, and non-secret freshness metadata.
- Restart policy: `ON_FAILURE`, maximum 3 restarts.

After a non-production deployment, open a fresh browser session and verify landscape, company, battlecard, evidence, keyboard navigation, and current/stale/partial states. A production smoke test requires an operator and explicit approval.

## Terminating weekly refresh service

- Image: the exact same revision and `Dockerfile` as web.
- Workload command: `npm run enrich`.
- Railway start command (hard timeout): `/usr/bin/timeout --signal=TERM --kill-after=30s 20m npm run enrich -- --actor-id "$APIFY_ACTOR_ID"`.
- Cron schedule: `0 15 * * 1` (Monday 15:00 UTC).
- Public networking: **no public domain**.
- Restart policy: `NEVER`; failed scheduled runs require operator review. The command must exit after success or failure so schedules cannot overlap.

Before a non-production refresh, export the `System` table row as a sanitized before snapshot. After it terminates, capture the after snapshot and verify a new independent refresh run ID, `last_attempt_at`, per-company successes/failures, and `last_successful_at` only when appropriate. Partial refreshes must retain successful companies and the previous publication. Cache invalidation must call the configured `APP_BASE_URL` server endpoint with the `CACHE_INVALIDATION_SECRET` signature; record status only, never the signature.

Do not run destructive cleanup, live Airtable writes, live Apify calls, Railway deploys, or production smoke tests from automation. Operators must approve each live command and validate expected counts/status first.
