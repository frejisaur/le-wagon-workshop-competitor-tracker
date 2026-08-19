# Self-Service Competitor Tracker Onboarding Design

Date: 2026-08-19

Status: Approved

Companion specifications:

- [`gtm-competitor-intelligence-design.md`](../../../gtm-competitor-intelligence-design.md)
- [`gtm-competitor-intelligence-design-system.md`](../../../gtm-competitor-intelligence-design-system.md)
- [`docs/operations/deployment.md`](../../operations/deployment.md)

## 1. Purpose

People who clone, fork, or copy this repository need an agent-led path from a
fresh checkout to their own deployed competitor tracker. The onboarding flow
must configure a user-owned Airtable base, import the user's Apollo roster,
obtain Semrush scraper evidence through Apify when an export is not already
available, and deploy the web and refresh services through the Railway MCP.

The experience is a guided agent workflow documented in the repository, not a
browser-based setup screen. Repository commands remain the deterministic
boundary for validation and persistence. MCP tools provide infrastructure
control and account-scoped operations; they do not replace application data
contracts.

## 2. Success criteria

Onboarding is complete only when the agent can report all of the following
without revealing credential values or raw provider records:

1. Local fixture tests and the production build pass on Node.js 22.
2. The selected Airtable base contains the canonical six-table schema.
3. The Apollo roster passes a dry run and persists at least one valid company.
4. Every requested website domain is either enriched by a validated Semrush
   scraper record or listed in a bounded failure report.
5. The user explicitly accepts any partial enrichment before deployment.
6. Railway contains one public web service and one private terminating weekly
   refresh service sourced from the user's confirmed GitHub repository.
7. The web health endpoint returns `200` with non-secret freshness metadata.
8. The agent hands back project, service, deployment, freshness, and company
   counts, plus the safest retry for any remaining failure.

## 3. Deliverables

- A concise README entry point for people and coding agents.
- A copyable onboarding prompt that tells an agent to follow the repository
  runbook and obey its approval gates.
- A detailed `docs/operations/onboarding.md` runbook covering prerequisites,
  inputs, fixture verification, Airtable setup, provider branching, Railway MCP
  deployment, verification, and recovery.
- An explicit Apollo-only bootstrap option on `npm run import:initial` so the
  roster can be persisted safely before a first live Apify refresh.
- Tests for the bootstrap option and documentation/configuration drift.
- Corrections to environment or deployment documentation when repository
  behavior proves the existing text incomplete or inconsistent.

## 4. User inputs and prerequisites

The agent requests inputs in stages and never asks the user to paste secrets
into committed files, prompts that will be stored, shell command arguments, or
browser-visible code.

Required inputs:

- A confirmed GitHub repository in `owner/name` form and deployment branch.
- A Railway MCP connection authenticated to the intended workspace.
- An Airtable base ID and a PAT limited to that base with
  `data.records:read`, `data.records:write`, `schema.bases:read`, and
  `schema.bases:write` for the schema and record commands.
- An Apollo CSV using the repository's validated column contract.
- Either an Apify Semrush JSON export or permission to run the configured Apify
  actor with a user-confirmed list of website domains.
- For live scraping, `APIFY_TOKEN` and the reviewed Apify actor ID.

The guide may mention provider plugins as optional ways to obtain an export,
but it must not require an Apollo, Semrush, Airtable, or Apify plugin when the
repository command accepts a user-supplied file or credential. Railway MCP is
required for the infrastructure path requested by this design.

## 5. Agent state machine and approval gates

The onboarding agent follows a resumable state machine:

```text
checkout
  -> fixture_verified
  -> airtable_schema_verified
  -> provider_inputs_validated
  -> import_previewed
  -> [approval: live Airtable import]
  -> roster_persisted
  -> enrichment_verified
  -> [approval: accept partial enrichment, when applicable]
  -> railway_preflighted
  -> [approval: create/configure/deploy Railway resources]
  -> deployment_verified
  -> handoff
```

An agent must stop at an approval gate. Approval for one gate does not imply
approval for later live writes or deployment actions. Read-only discovery and
fixture commands may proceed without extra approval.

Every completed state records only compact evidence: command, exit status,
counts, resource IDs or names, and timestamps. Secret values, complete Airtable
records, authorization headers, and raw provider payloads never enter the
handoff.

## 6. Provider-data branches

### 6.1 Existing Semrush scraper export

When an Apify Semrush JSON export is supplied, the agent:

1. Parses Apollo and Semrush through the repository command in dry-run mode.
2. Reports accepted, rejected, unenriched, and Apify-only counts.
3. Stops on an invalid payload, duplicate normalized Apollo domain, conflicting
   source identity, or an import that would exceed the configured record budget.
4. Requests approval before running the same validated import against Airtable.

Provider estimates remain observed data. Missing enrichment is represented as
absent, never as zero.

### 6.2 Missing Semrush scraper export

When the export is absent, the agent must not fabricate an empty successful
dataset or bypass the provider boundary. It performs this explicit bootstrap:

1. Ask the user for the website domains to enrich. The user may confirm the
   normalized valid websites extracted from the Apollo CSV or supply a list.
2. Normalize and deduplicate the requested domains using the shared repository
   domain normalizer.
3. Compare the requested set with the valid normalized Apollo roster. Reject
   invalid domains and stop on domains not represented by Apollo. Report Apollo
   roster domains omitted by the user and request a corrected confirmation.
4. Dry-run the explicit Apollo-only import mode. This mode passes an empty
   validated Semrush record collection to the existing import workflow and
   reports all accepted companies as unenriched.
5. After approval, persist the Apollo roster with metrics absent.
6. Validate the live refresh environment by variable name and presence only.
7. Run `npm run enrich`, which starts the configured Apify Semrush actor through
   the existing server-side client for the confirmed active company roster.
8. Compare requested domains with processed, succeeded, and failed outcomes.
   Preserve successful writes when a batch is partial and do not retry without
   an operator decision.

The bootstrap CLI will use `--apollo-only` rather than requiring the agent to
create a magic `[]` JSON file. `--apollo-only` and `--semrush <path>` are
mutually exclusive, and one is required. Existing command behavior remains
compatible.

The first implementation will require the confirmed domain set to equal the
valid active Apollo roster. Supporting an arbitrary subset would require a new
lifecycle/selection contract and is outside this change. If the user omits a
roster domain, the agent explains that constraint and asks for a corrected
confirmation instead of silently scraping extra domains.

## 7. Airtable setup and validation

The agent uses repository commands for schema and data writes:

1. Check required environment variable names as `present` or `missing` only.
2. Run `npm run airtable:schema` against the selected base.
3. Verify the canonical tables: Companies, Keywords, Paid Ads, GTM Insights,
   Insight Reviews, and System.
4. Run the initial import dry run and show its bounded count/budget report.
5. Obtain explicit approval before the live initial import.
6. Re-read the serving snapshot or health/status boundary and verify persisted
   counts and enrichment coverage.

The schema setup must be idempotent. A wrong base, missing scope, noncanonical
table names, or failed schema check blocks import. Airtable MCP may be used for
read-only discovery if available, but the deterministic schema/import commands
remain authoritative.

## 8. Railway MCP deployment sequence

The runbook names Railway MCP operations by capability so agents can adapt to
minor tool-name changes while still preferring the current direct tools.

1. Authenticate and identify the user with `whoami`; list workspaces.
2. Ask the user to choose a workspace when more than one is available.
3. Confirm the exact GitHub `owner/name` repository and branch. Never guess.
4. Create a private Railway project and record its production environment ID.
5. Create the web service from the confirmed GitHub repository.
6. Set web variables from the validated runtime environment. The agent sends
   values to Railway only through the variable-setting tool and reports names
   afterward, never values.
7. Configure the web service with the root Dockerfile, `npm start`, `/api/health`,
   and `ON_FAILURE` with at most three retries.
8. Generate a Railway domain for the web service and set the resulting URL as
   `APP_BASE_URL` for the refresh service.
9. Create a second service from the same repository for weekly refresh.
10. Configure its Railway config path as `/railway.cron.toml`, with no public
    domain, the terminating refresh command, `NEVER` restart policy, and
    `0 15 * * 1` schedule.
11. Set the refresh service's Airtable, Apify, application URL, and cache
    invalidation variables.
12. Inspect both service configurations and variable-name lists before asking
    for approval to apply/redeploy staged changes.
13. After explicit approval, trigger or accept deployment, follow status, and
    inspect redacted logs only when a service fails.

Because creating a GitHub-backed Railway service may immediately trigger its
first build, the guide warns that the first deployment can fail until variables
and service settings are present. The agent treats that as setup state, applies
the complete configuration, and verifies the subsequent deployment. It must not
claim success from resource creation alone.

The refresh service never receives a public domain. The web service never
receives `APIFY_TOKEN` or `CACHE_INVALIDATION_SECRET`.

## 9. Verification and failure handling

Verification occurs at four levels:

- Contract: Apollo and Semrush parsers, domain join, record budget, and bootstrap
  argument behavior.
- Storage: canonical Airtable schema, company count, enrichment coverage, and
  System freshness/run status.
- Infrastructure: service settings, variable names, domain separation, cron,
  restart policies, and deployment status.
- Product: health endpoint, landscape, company detail, evidence, and explicit
  partial/stale/empty states.

On provider failure, retain successful companies and the last published
insights. On deployment failure, inspect status and bounded logs, fix only the
failed configuration, and retry the idempotent operation. On Airtable failure,
do not proceed to scraping or Railway deployment unless the user explicitly
chooses a documented partial-data path.

The final handoff includes:

- Repository and deployed domain.
- Railway project/environment and both service names or IDs.
- Airtable base identifier in redacted form and table verification status.
- Apollo accepted/rejected counts.
- Requested, enriched, and failed domain counts.
- Refresh run ID, status, and freshness timestamp.
- Tests and smoke checks performed.
- Any retry or human review still required.

## 10. Testing strategy

Implementation starts with failing tests for `--apollo-only`:

- It accepts Apollo input without `--semrush` and supplies zero Semrush records.
- It rejects using `--apollo-only` together with `--semrush`.
- It rejects a command with neither source mode.
- Its output remains a single sanitized JSON summary.
- The existing `--semrush` path remains unchanged.

Documentation/config tests assert that the onboarding guide references real
package scripts and current Railway configuration, requires approval before
live import/deploy, includes the missing-export branch, and lists the correct
service-specific variables. The narrow CLI and documentation tests run first,
followed by the relevant workflow suite, full unit suite, and production build.

## 11. Non-goals

- A browser UI, account portal, or credential form.
- Automatic creation of Airtable, Apollo, Apify, Semrush, GitHub, or Railway
  accounts.
- Storing provider credentials in Airtable or client-visible variables.
- Direct MCP writes that bypass repository schema, identity, budget, or
  fingerprint logic.
- Generating GTM insight prose during infrastructure onboarding.
- Automatically accepting partial enrichment or deploying production without
  explicit user approval.
- Supporting an arbitrary scrape subset that differs from the active Apollo
  roster in the first implementation.
