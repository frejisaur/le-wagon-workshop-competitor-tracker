# Self-Service Competitor Tracker Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a coding agent a tested, secret-safe path from a fresh clone to a user-owned Airtable dataset and two-service Railway deployment, including automatic Apify Semrush enrichment when no export is supplied.

**Architecture:** Extend only the initial-import CLI boundary with an explicit Apollo-only mode; the existing import workflow already represents missing provider metrics as absent and the existing enrichment job already starts the reviewed Apify actor. Put orchestration policy in a dedicated operations runbook, link it from a concise README prompt, and protect command names, approval gates, service separation, and credential scopes with documentation contract tests.

**Tech Stack:** Node.js 22, TypeScript, Vitest, Next.js 16, Airtable Web API, Apify REST client, Railway MCP, Markdown operations documentation.

**Spec:** `docs/superpowers/specs/2026-08-19-self-service-onboarding-design.md`

## Global Constraints

- Keep observed provider data, deterministic calculations, and agent inference separate.
- Never print, log, commit, browser-expose, or include credential values in prompts or handoffs.
- Use the shared domain normalizer and Apollo-to-Apify join; never join by company name.
- Missing Semrush enrichment remains absent, never zero.
- `--apollo-only --domains <path>` and `--semrush <path>` are mutually exclusive, and one source mode is required.
- In the first version, the confirmed scrape-domain set must equal the valid active Apollo roster.
- Repository commands remain authoritative for schema, validation, import, enrichment, and verification.
- Live Airtable import, acceptance of partial enrichment, and Railway deployment each require separate explicit approval.
- The web service must not receive `APIFY_TOKEN` or `APP_BASE_URL`; web and refresh receive the same server-only `CACHE_INVALIDATION_SECRET`.
- The refresh service has no public domain and uses `/railway.cron.toml`, `NEVER`, and `0 15 * * 1`.
- Node.js 22 remains the required runtime; add no dependencies.

## File structure

- `jobs/import-initial.ts`: parse the new bootstrap flag and pass an empty validated Semrush collection into the existing workflow.
- `tests/workflows/import-initial-cli.test.ts`: own the CLI-mode, compatibility, and sanitized-output behavior.
- `.env.example`: document the exact Airtable PAT scopes required by the schema command.
- `docs/operations/onboarding.md`: canonical agent-led clone-to-deploy runbook and Railway MCP sequence.
- `README.md`: short human entry point plus copyable agent prompt.
- `docs/operations/deployment.md`: keep the operator contract aligned with the onboarding guide and exact PAT requirements.

---

### Task 1: Add the explicit Apollo-only import mode

**Files:**

- Modify: `tests/workflows/import-initial-cli.test.ts`
- Modify: `jobs/import-initial.ts:11-65`

**Interfaces:**

- Consumes: `parseApolloCsv(csv: string)`, `parseSemrushPayload(value: unknown)`, and `runInitialImport({apolloRows, semrushRecords, repository, dryRun})`.
- Produces: `npm run import:initial -- --apollo <path> --apollo-only --domains <path> [--dry-run]`; the existing `--semrush <path>` interface remains unchanged.

- [ ] **Step 1: Write failing bootstrap and exclusivity tests**

Add this fixture and these cases to `tests/workflows/import-initial-cli.test.ts`:

```ts
const apollo = [
  'Company Name,Website,Apollo Account Id,Apollo Record Id',
  'Alpha,https://alpha.example,acct-alpha,rec-alpha',
].join('\n');

it('dry-runs an Apollo-only roster as explicitly unenriched', async () => {
  const result = await runInitialImportCli(
    ['--apollo', 'apollo.csv', '--apollo-only', '--domains', 'domains.txt', '--dry-run'],
    {readFile: (path) => path === 'apollo.csv' ? apollo : 'alpha.example\n'},
  );

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    accepted: 1,
    unenriched: 1,
    rejected: 0,
    apifyOnly: 0,
    succeeded: 0,
  });
  expect(result.stdout.split('\n')).toHaveLength(1);
  expect(result.stdout).not.toMatch(/acct-alpha|rec-alpha|https:\/\/alpha\.example/);
});

it('requires one provider source mode', async () => {
  const result = await runInitialImportCli(['--apollo', 'apollo.csv', '--dry-run'], {
    readFile: () => { throw new Error('must not read invalid arguments'); },
  });

  expect(result).toEqual({
    exitCode: 1,
    stdout: JSON.stringify({status: 'failed', error: 'initial_import_failed'}),
  });
});

it('rejects Apollo-only and Semrush modes together', async () => {
  const result = await runInitialImportCli(
    ['--apollo', 'apollo.csv', '--apollo-only', '--semrush', 'semrush.json', '--dry-run'],
    {readFile: () => { throw new Error('must not read invalid arguments'); }},
  );

  expect(result).toEqual({
    exitCode: 1,
    stdout: JSON.stringify({status: 'failed', error: 'initial_import_failed'}),
  });
});
```

Keep the two existing `--semrush` tests. They are the compatibility coverage.

- [ ] **Step 2: Run the focused tests and confirm the new cases fail**

Run:

```bash
npm test -- tests/workflows/import-initial-cli.test.ts
```

Expected: the Apollo-only case fails because `--apollo-only` is unsupported;
the two source-mode cases establish the new exclusivity contract; existing
cases pass.

- [ ] **Step 3: Implement the minimum CLI argument change**

Change the CLI argument type and parser in `jobs/import-initial.ts` to this shape:

```ts
type CliArguments = {
  apollo: string;
  semrush?: string;
  apolloOnly: boolean;
  domains?: string;
  dryRun: boolean;
  fixtureState?: string;
};
```

Initialize `apolloOnly` to `false`, recognize the valueless flag next to
`--dry-run`, parse `--domains` as a file-path argument, and validate exactly
one provider mode. Apollo-only mode requires `--domains`; Semrush mode rejects
it. Before `runInitialImport`, normalize both the Apollo websites and each
nonblank requested-domain line with the shared `normalizeDomain`, reject
duplicates/invalids, and require exact set equality.

```ts
if (argument === '--apollo-only') {
  apolloOnly = true;
  continue;
}

if (!apollo) throw new TypeError('--apollo is required');
if (Boolean(semrush) === apolloOnly) {
  throw new TypeError('exactly one of --semrush or --apollo-only is required');
}
if (apolloOnly !== Boolean(domains)) {
  throw new TypeError('--domains is required only with --apollo-only');
}
return {apollo, semrush, apolloOnly, domains, dryRun, fixtureState};
```

Extend the CLI test file with literal line-delimited domain inputs that prove:

- missing `--domains` fails in Apollo-only mode;
- `--domains` fails in Semrush mode;
- blank or invalid requested domains fail;
- normalized duplicates such as `www.alpha.example` plus `alpha.example` fail;
- an extra/unknown domain fails;
- an omitted Apollo roster domain fails;
- an exact normalized match succeeds without printing the list.

At the provider boundary, avoid reading a Semrush file in bootstrap mode:

```ts
const semrushRecords = parsedArguments.apolloOnly
  ? []
  : parseSemrushPayload(JSON.parse(readFile(parsedArguments.semrush!, 'utf8'))).records;
```

Do not modify `runInitialImport`; its existing left join and
`toUnenrichedWrite` behavior are the intended implementation.

- [ ] **Step 4: Run the focused CLI and import workflow tests**

Run:

```bash
npm test -- tests/workflows/import-initial-cli.test.ts tests/workflows/import-initial.test.ts
```

Expected: all tests pass, including existing idempotency, partial import,
identity, and record-budget cases.

- [ ] **Step 5: Commit the CLI contract**

```bash
git add jobs/import-initial.ts tests/workflows/import-initial-cli.test.ts
git commit -m "feat: support Apollo-only roster bootstrap"
```

---

### Task 2: Correct and lock the Airtable credential contract

**Files:**

- Modify: `.env.example:1-4`
- Modify: `docs/operations/deployment.md:5-19`

**Interfaces:**

- Consumes: Airtable schema endpoints used by `ensureAirtableSchema` and record endpoints used by `AirtableCompetitorRepository`.
- Produces: one exact PAT scope contract: `data.records:read`, `data.records:write`, `schema.bases:read`, and `schema.bases:write`, limited to the selected base.

- [ ] **Step 1: Correct both credential references**

Change the opening comment in `.env.example` to:

```dotenv
# Airtable Web API (server-side only)
# Create a PAT scoped to this one competitor-tracker base with:
# data.records:read, data.records:write, schema.bases:read, and schema.bases:write.
```

Add this paragraph under `## Secret-safe preflight` in
`docs/operations/deployment.md`:

```markdown
Use an Airtable PAT limited to the selected base with
`data.records:read`, `data.records:write`, `schema.bases:read`, and
`schema.bases:write`. The schema command creates missing tables and fields, so
read-only schema access is insufficient.
```

- [ ] **Step 2: Review the documentation diff**

Confirm both references name the same four scopes, limit the PAT to one
selected base, and contain no example credential value. Then run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Commit the credential contract**

```bash
git add .env.example docs/operations/deployment.md
git commit -m "docs: correct Airtable setup scopes"
```

---

### Task 3: Add the agent onboarding runbook and README prompt

**Files:**

- Create: `docs/operations/onboarding.md`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/operations/deployment.md`

**Interfaces:**

- Consumes: package scripts `airtable:schema`, `import:initial`, `enrich`,
  `test`, and `build`; Railway MCP capabilities `whoami`, `list_workspaces`,
  `create_project`, `create_deployment`, `set_variables`, `update_service`,
  `generate_domain`, `get_service_config`, `redeploy`, `get_status`, and
  `get_logs`.
- Produces: a canonical runbook at `docs/operations/onboarding.md` and a
  copyable README prompt that routes agents to it.

- [ ] **Step 1: Create the canonical onboarding guide**

Create `docs/operations/onboarding.md` with these sections in this order:

```markdown
# Deploy your own competitor tracker

## Rules for the onboarding agent
## What the user needs
## 1. Verify the clone with fixtures
## 2. Collect connection status and file paths
## 3. Create and verify the Airtable schema
## 4. Preview the initial data
### Branch A: an Apify Semrush export exists
### Branch B: Apify Semrush data is missing
## Approval gate: live Airtable import
## 5. Import the roster
## Approval gate: live Apify enrichment
## 6. Run and verify missing Semrush enrichment
## Approval gate: partial enrichment
## 7. Prepare Railway MCP
## Approval gate: Railway creation and deployment
## 8. Create and configure both Railway services
## 9. Verify deployment and freshness
## Recovery and resume points
## Final handoff
```

The guide must include these exact executable command forms:

```bash
npm ci
npm test -- tests/workflows/import-initial-cli.test.ts tests/workflows/enrich.test.ts
npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json
npm run build -- --webpack
npm run airtable:schema
npm run import:initial -- --apollo <apollo.csv> --semrush <semrush.json> --dry-run
npm run import:initial -- --apollo <apollo.csv> --apollo-only --domains <domains.txt> --dry-run
npm run import:initial -- --apollo <apollo.csv> --semrush <semrush.json>
npm run import:initial -- --apollo <apollo.csv> --apollo-only --domains <domains.txt>
npm run enrich
```

Angle-bracket paths are replaceable path examples in documentation; tell the
agent to substitute verified local paths and never paste secrets into command
arguments. For the missing-export branch, require the agent to:

1. Parse and normalize the Apollo websites through the dry-run command.
2. Ask the user for a website-domain list or confirmation of the normalized
   Apollo list, save it to an uncommitted line-delimited file, and pass that
   file through `--domains`.
3. Let the CLI reject invalid, duplicate, unknown, extra, or incomplete
   confirmation; the first version requires exact equality with the valid
   active Apollo roster.
4. Import with `--apollo-only --domains <domains.txt>` only after the live-import approval.
5. Check refresh variable names as present/missing.
6. Obtain separate approval for the live provider-costing enrichment, then run
   `npm run enrich`, which triggers `pro100chok/semrush-scraper` through the
   existing Apify client.
7. Report processed, succeeded, failed, cache status, run ID, and domain
   identities without raw provider records.

For Railway MCP, write a numbered tool sequence using the capability names in
the Interfaces block. Before the Railway approval, use only `whoami`,
`list_workspaces`, and user confirmation of GitHub `owner/name` plus branch.
After approval, call `create_project`, then use `create_deployment` once to
create each GitHub-backed service. Because this can trigger an initial build,
configure with `update_service` and `set_variables` using `skipDeploys: true`,
inspect with `get_service_config`, and call `redeploy` once per fully configured
service. Configure:

- Web: `Dockerfile`, `npm start`, `/api/health`, `ON_FAILURE`, 3 retries, one
  generated public domain, Airtable variables plus `CACHE_INVALIDATION_SECRET`.
- Refresh: the same repo/branch, `/railway.cron.toml`, no domain,
  `/usr/bin/timeout --signal=TERM --kill-after=30s 15m npm run enrich`, `NEVER`,
  `0 15 * * 1`, Airtable + Apify + `APP_BASE_URL` + cache secret variables.

Include the exact rule: "The web service must not receive `APIFY_TOKEN` or
`APP_BASE_URL`; both services receive the same server-only
`CACHE_INVALIDATION_SECRET`; the refresh service has no public domain."

Tell the agent to use `get_service_config` to verify variable names without
retrieving values, `get_status` to follow deployments, and `get_logs` only for
a failed service with secret-bearing output redacted. Resource creation or a
triggered deployment is not success; `/api/health` must return `200` and
`status: ok`.

Correct `.env.example` and `docs/operations/deployment.md` so both services
receive the same server-only `CACHE_INVALIDATION_SECRET`; only refresh receives
`APIFY_TOKEN` and `APP_BASE_URL`. Label the initial dry-run record budget as an
incoming-only estimate and explain that the live import rechecks the selected
Airtable base before writing.

- [ ] **Step 2: Expand the README with an entry point and copyable prompt**

Keep the local-start block, then add a `## Deploy your own tracker` section
containing this prompt:

```text
Follow docs/operations/onboarding.md to deploy my own competitor tracker. Ask
me for one input at a time, never print or repeat secret values, and stop at
every approval gate. If I do not have an Apify Semrush export, request my list
of website domains, validate it against the Apollo roster, bootstrap the roster
with --apollo-only and --domains, and run the repository's Apify enrichment job. Use Railway
MCP for infrastructure and finish with the runbook's verification handoff.
```

Explain in one sentence that the user can paste the prompt into a coding agent
with repository access and a connected Railway MCP. Link the detailed
onboarding guide and existing operator deployment contract.

- [ ] **Step 3: Review the complete onboarding flow**

Read the README prompt and runbook once from the perspective of a fresh agent.
Confirm every documented `npm run` name exists in `package.json`, all approval
gates are separate, the missing-export branch requests domains and
runs Apify enrichment, web/refresh variables remain separated, and the final
handoff does not claim resource creation is deployment success. Then run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Commit the onboarding documentation**

```bash
git add README.md .env.example docs/operations/deployment.md docs/operations/onboarding.md
git commit -m "docs: add agent-led deployment onboarding"
```

---

### Task 4: Run complete release verification

**Files:**

- Verify only; modify a task-owned file only when a failing check proves the
  implementation contradicts this plan or its specification.

**Interfaces:**

- Consumes: completed CLI, credential, README, runbook, Railway config, and
  tests from Tasks 1-3.
- Produces: a final verification report with commands, outcomes, and any
  unverified live-service requirements clearly separated.

- [ ] **Step 1: Run the full unit and contract suite**

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run TypeScript and schema drift checks**

```bash
npx tsc --noEmit
node scripts/verify-semrush-schema-reference.mjs
```

Expected: TypeScript exits zero and the committed Semrush schema reference
matches its recorded source metadata. When the private raw Apify source export
is available, additionally run the skill generator with `--check` to detect
payload drift; a clean public clone does not contain that ignored export.

- [ ] **Step 3: Build the production application**

```bash
npm run build -- --webpack
```

Expected: the Next.js production build succeeds on Node.js 22.

- [ ] **Step 4: Verify the Node 22 container release path**

```bash
docker build -t competitor-tracker-onboarding-verify .
```

Expected: every Docker test/build stage succeeds from the repository's Node 22
base image.

- [ ] **Step 5: Inspect the final diff and repository state**

```bash
git diff --check
git status --short
git log -4 --oneline
```

Expected: no whitespace errors; only pre-existing unrelated files such as
`.DS_Store` remain untracked; commits exist for the CLI contract, Airtable
scope correction, and onboarding documentation.

- [ ] **Step 6: Report completion without claiming live deployment**

The handoff must distinguish repository verification from actions the future
onboarding agent performs against a user's Airtable, Apify, and Railway
accounts. Report changed files, CLI behavior, tests/build results, and the path
to the copyable onboarding prompt. Do not claim that live services were created
or live provider data was validated during this implementation.
