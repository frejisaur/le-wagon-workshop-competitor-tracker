# Instructor preflight

The command reports only `present` or `missing`; it never prints values or subprocess output.

## Day before

- Run `npm run workshop:preflight -- --phase all` and `npm run workshop:verify`.
- Verify every fixture and fallback path in `workshop/workshop-manifest.json`.
- Open the pre-deployed URL and compare it with `workshop/expected/railway-health-output.json`.
- Rehearse the saved Apify fixture, Airtable expected output, selected UI reference, and health fallback.
- Enter/rotate secrets in a non-projected window, then close it.

## One hour before

- Pull the approved branch, install dependencies, and run the fixture-only focused tests.
- Confirm Claude Code MCP authorization for Airtable, Apify, and Railway without revealing scopes or values on screen.
- Open the seven prompt files and five visual references in presentation order.
- Confirm the terminal and HTML remain readable at presentation zoom.

## Five minutes before

- Run `npm run workshop:preflight -- --phase all` once more.
- Confirm the pre-deployed URL, local app, and selected reference are open.
- Hide notifications and every secret-entry surface.
- Start at `workshop/cp0-start`; do not switch branches during the session.

## Rehearsal evidence

Record date, result, and duration only—never URLs with query data, record IDs, payloads, or credentials.

| Date | Path | Result | Duration |
|---|---|---|---|
| 2026-08-19 | Fixture preflight | Ready | 00:24 |

Rotation order: create new → store new → deploy → verify health/refresh → revoke old.
