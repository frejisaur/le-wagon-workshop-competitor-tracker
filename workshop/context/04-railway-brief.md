# Phase 4 — Railway deployment

## Outcome
Inspect, deploy, and prove the web and scheduled refresh services with a compact sanitized health result.

## Non-goals
No production mutation without operator approval, secret printing, raw build logs, unbounded provider refresh, tag creation, or application redesign.

## Read
- `.agents/skills/operating-competitor-intelligence/SKILL.md`
- `railway.toml`
- `railway.cron.toml`
- `.env.example`
- `docs/operations/deployment.md`
- `workshop/expected/railway-health-output.json`

## Run
Run `npm run workshop:preflight -- --phase deploy`. Use Railway MCP for project/service inspection and configuration; use `railway up` for local-code upload only after the operator approves mutation. Ask the read-only `evidence-reviewer` for the final evidence/security review. Do not echo CLI/MCP raw output.

## Acceptance
Named web and refresh services exist, the schedule matches the repository, variables are present (never revealed), deployment reports healthy, and the sanitized health shape matches the expected file.

## Return
Return only service names, commands, schedule, deployment status, health status, review result, and fallback used.
