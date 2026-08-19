# Competitor Intelligence

A fixture-first competitor research prototype with evidence-backed battlecards and explicit publication gates. Node.js 22 is required.

## Local start

```sh
npm ci
npm run dev -- --webpack
```

Use only sanitized fixtures for development. See [workshop rehearsal](docs/operations/workshop-runbook.md) for `npm run enrich`, `npm run insights:prepare`, `npm run insights:submit`, and `npm run insights:publish-approved`; see [Railway deployment](docs/operations/deployment.md) for the operator-only release procedure.

Run the release checks with `npm test`, `npm run build -- --webpack`, `npm run test:e2e`, and the schema drift command documented in the operations guide. Never commit `.env` files or expose server variables to browser code.
