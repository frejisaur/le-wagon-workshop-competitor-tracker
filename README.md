# Competitor Intelligence

A fixture-first competitor research prototype with evidence-backed battlecards and explicit publication gates. Node.js 22 is required.

## Local start

```sh
npm ci
npm run dev
```

Use only sanitized fixtures for development. See [workshop rehearsal](docs/operations/workshop-runbook.md) for `npm run enrich`, `npm run insights:prepare`, `npm run insights:submit`, and `npm run insights:publish-approved`; see [Vercel + GitHub Actions deployment](docs/operations/deployment.md) for the operator-only release procedure.

Run the release checks with `npm test`, `npm run build`, `npm run test:e2e`, and the schema drift command documented in the operations guide. Never commit `.env` files or expose server variables to browser code.

## Deploy your own tracker

Paste this prompt into a coding agent with repository access, an authenticated Vercel CLI (`vercel login`), and an authenticated GitHub CLI (`gh auth login`). The Vercel MCP in `.mcp.json` is optional for inspecting deployments and logs:

```text
Follow docs/operations/onboarding.md to deploy my own competitor tracker. Ask
me for one input at a time, never print or repeat secret values, and stop at
every approval gate. If I do not have an Apify Semrush export, request my list
of website domains, keep that list in a user-only OS temporary file, validate it
against the Apollo roster, bootstrap with --apollo-only and --domains, prepare
the runbook's local signed cache callback, and then run the repository's Apify
enrichment job. Use the Vercel CLI for the web deployment and its environment,
the GitHub CLI for the refresh workflow's secrets and variables, and the Vercel
MCP only to inspect deployments and logs. Finish with the runbook's verification
handoff.
```

See the detailed [onboarding guide](docs/operations/onboarding.md) and the existing [operator deployment contract](docs/operations/deployment.md).
