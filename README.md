# Competitor Intelligence

A competitor-intelligence dashboard for a marketing team, built live with Claude Code in the [90-minute workshop](workshop/README.md). Every claim links back to evidence, and the data refreshes on a schedule. Node.js 22 is required.

## Local start

```sh
npm ci
npm test
npm run dev
```

Development runs against sanitized fixtures; no credentials are needed. Never commit `.env` files or expose server variables to browser code.

## Commands

| Command | What it does |
|-|-|
| `npm run airtable:schema` | Creates the missing Airtable tables and fields (approval required) |
| `npm run import:initial -- --apollo <csv> --semrush <json> [--dry-run]` | Joins an Apollo CSV with an Apify Semrush export and imports it |
| `npm run enrich` | Refreshes Semrush metrics through Apify (`--provider-fixture` and `--fixture-state` run it offline) |
| `npm run insights:prepare` | Builds the evidence package for battlecard generation |
| `npm run insights:submit` | Validates an agent-written battlecard and publishes or queues it for review |
| `npm run insights:publish-approved` | Publishes reviewed battlecards |
| `npm run apollo -- prepare [INPUT.csv]` | Prepares the saved domains and fixed Actor settings |
| `npm run refresh:dispatch -- <pilot or production> <run IDs>` | Waits for ingestion and export of completed MCP runs |
| `npm run apollo -- export INPUT.csv OUTPUT.csv [SNAPSHOT.json]` | Adds saved Airtable or fixture metrics to the original rows |

Release checks: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e`, `node scripts/verify-semrush-schema-reference.mjs`.

## Deploy

Vercel serves the app and GitHub Actions runs CI and the weekly refresh. See the [deployment contract](docs/operations/deployment.md).
