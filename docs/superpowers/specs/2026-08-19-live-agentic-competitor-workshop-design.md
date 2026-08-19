# Live Agentic Competitor Intelligence Workshop Design

Date: 2026-08-19

Status: Approved in collaborative design; awaiting written-spec review

Companion product specifications:

- [`gtm-competitor-intelligence-design.md`](../../../gtm-competitor-intelligence-design.md)
- [`gtm-competitor-intelligence-design-system.md`](../../gtm-competitor-intelligence-design-system.md)

## 1. Purpose

This repository must support a reliable 90-minute, instructor-led workshop for
marketers with beginner-level Claude Code experience. The instructor uses a
prepared environment while attendees watch live and later use the recording and
GitHub repository to reproduce the work.

The workshop demonstrates how useful agent context is assembled from project
instructions, focused agents, skills, MCP servers, CLI tools, fixtures, tests,
and visual references. The product outcome is a deployed competitor-tracking
prototype backed by an Apollo roster, Apify Semrush enrichment, Airtable, and a
scheduled Railway refresh.

The workshop is successful when the audience can explain:

1. What belongs in project-wide instructions, a skill, an agent definition, a
   reference file, an MCP connection, or a deterministic CLI command.
2. Why provider data, reproducible calculations, and agent inference remain
   separate.
3. How a visual mockup becomes compact, reusable context for a coding agent.
4. Why OAuth access for an agent differs from runtime credentials for an app.
5. How checkpoints make a live agentic build honest and recoverable.

## 2. Audience and delivery constraints

- Audience: marketers learning Claude Code at a 101 level.
- Format: instructor-led demonstration, not a participant setup lab.
- Follow-up: recording plus a public GitHub repository containing the finished
  project and replay instructions.
- Instructor harness: Claude Code on a Pro plan.
- Preparation harness: Codex may perform broad exploration and generate compact
  reference artifacts before the workshop.
- Live priority: discussion, visual decisions, tool use, verification, and
  agent handoffs. Waiting for agents or providers is not teaching time.
- Secrets never appear in projected prompts, shell arguments, committed files,
  browser code, fixtures, logs, or screenshots.

## 3. Teaching narrative

Use a reverse-reveal opening followed by a linear rebuild.

The workshop begins with the finished deployed product. This gives the audience
a concrete reason for every context and infrastructure decision that follows.
The rebuild then proceeds in causal order:

```text
Apollo CSV -> Apify Semrush evidence -> normalized contract -> Airtable
           -> visual design -> dashboard -> Railway web + scheduled refresh
```

Agent work runs in a background lane. The instructor launches a bounded task,
then teaches the next concept while it runs. The session returns to an agent only
when there is an artifact, test result, or decision to inspect.

## 4. Run of show

| Time | Segment | Live teaching outcome | Recovery asset |
| --- | --- | --- | --- |
| 00:00-00:07 | Reverse reveal | Show All Companies, Company Detail, evidence trace, and freshness. State the end-to-end promise. | Pre-deployed final app |
| 00:07-00:15 | Context anatomy | Explain `CLAUDE.md`, `AGENTS.md`, skills, focused agents, MCPs, CLIs, fixtures, and tests. | Pre-generated context map |
| 00:15-00:25 | Source acquisition | Export a prepared Apollo Saved list. Use Apify MCP/plugin to inspect the selected Actor/task and input contract. Start one bounded live enrichment. | Original Apollo CSV and saved Apify fixture |
| 00:25-00:36 | Data skill and join | Create/refine the data-joining skill. Normalize domains, join the two files, classify fields, and inspect counts and exceptions. | Joined sanitized output and expected-count manifest |
| 00:36-00:45 | Airtable serving layer | Authenticate the Airtable MCP with OAuth, inspect the disposable base, apply the deterministic schema command, and import through the repository command. | Prepared workshop base and import report |
| 00:45-00:56 | Visual brainstorming | Generate two or three All Companies directions from the product constraints and real-shaped fixture. Select one hierarchy. | Pre-generated mockup set and selected reference |
| 00:56-01:03 | Dashboard skill and handoff | Encode the selected decisions in the dashboard skill and compact UI brief. Dispatch the dashboard builder with explicit ownership and proof. | Completed dashboard skill and UI packet |
| 01:03-01:13 | Inspect the build | Review the All Companies implementation, compare it with the selected mockup, and show the pre-generated Company Detail reference and implementation. | Working application checkpoint |
| 01:13-01:25 | Deploy and schedule | Deploy local code with Railway CLI. Use Railway MCP to inspect services, configure the refresh command and weekly UTC schedule, and check status. | Pre-deployed service and prepared cron service |
| 01:25-01:30 | Proof and recap | Trigger health/freshness checks, show compact status, name each context boundary, and explain replay paths. | Final verification report |

The instructor may move up to two minutes between adjacent segments, but must
not consume the final five-minute proof and recap block.

## 5. Repository architecture

The repository is both a working application and a teaching instrument. Keep
canonical project context separate from a thin workshop layer.

```text
AGENTS.md                          # cross-harness iron laws and routing
CLAUDE.md                          # short Claude adapter; points to AGENTS.md
.agents/skills/                    # canonical reusable domain skills
.claude/agents/                    # focused Claude Code agent definitions
.codex/agents/                     # matching Codex agent definitions
gtm-competitor-intelligence-design.md
docs/gtm-competitor-intelligence-design-system.md
src/, scripts/, tests/, data/      # application and stable CLI boundaries

workshop/
  README.md                        # audience, promise, and replay entry point
  run-of-show.md                   # minute-by-minute stage plan
  speaker-script.md                # say / show / run / verify / fallback
  preflight.md                     # day-before and hour-before checks
  credentials.md                   # OAuth and runtime-secret procedures
  checkpoints.md                   # trigger, fallback, and resume table
  context/
    01-data-join-brief.md
    02-airtable-brief.md
    03-dashboard-brief.md
    04-railway-brief.md
    provider-summary.json
    expected-counts.json
  prompts/                         # paste-ready, bounded Claude prompts
  starters/                        # live skill skeletons
  expected/                        # sanitized compact command outputs
  design/                          # generated options and selected UI reference
```

The existing product and design-system documents remain authoritative for the
application. Workshop documents explain how to demonstrate and reproduce the
product; they do not fork product requirements.

## 6. Three context planes

### 6.1 Context plane

This plane tells agents how to reason.

- `AGENTS.md` contains only rules that apply across domains: provenance layers,
  secret safety, fixture-first development, publication safety, retry safety,
  testing, and skill routing.
- `CLAUDE.md` remains a short harness adapter that points to canonical context.
- Skills contain domain triggers, workflows, boundaries, and required handoff
  formats.
- Detailed schemas, rubrics, and examples live in skill references and load
  only when needed.
- Agent definitions constrain ownership, tools, and return formats.
- Product specifications define user and interface behavior.
- Sanitized fixtures supply the smallest realistic data needed for execution.

Two contrasting skills are authored or refined live:

1. The data-joining skill encodes deterministic normalization, join identity,
   field classification, exception reporting, and verification.
2. The dashboard-design skill encodes visual judgment, evidence presentation,
   responsive behavior, accessibility, required states, and visual validation.

The live skeletons must converge on the canonical repository skills rather than
create overlapping permanent skills.

### 6.2 Execution plane

This plane gives agents bounded ways to act.

- Airtable MCP: discover, inspect, and demonstrate a base through browser OAuth.
- Apify MCP/plugin: inspect Actor details and input/output contracts; run a
  bounded sample only when the selected Actor supports MCP execution.
- Railway MCP: inspect and configure projects, services, variables, schedules,
  deployments, and status through OAuth.
- Railway CLI: authenticate interactively, link the local repository, deploy
  local code, and run local commands with service configuration.
- Repository CLIs: perform validation, joins, schema reconciliation, imports,
  refreshes, status checks, and insight lifecycle operations deterministically.

Repository commands are the stable handoff boundary. MCP tools must not replace
tested code for identities, calculations, fingerprints, or idempotent writes.

### 6.3 Proof and recovery plane

This plane keeps the demonstration honest.

- Narrow tests prove the behavior changed.
- Contract reports show accepted, rejected, unmatched, and persisted counts.
- Evidence provenance remains available without loading raw payloads.
- Prepared artifacts replace slow external results without bypassing the same
  validation boundary.
- A pre-deployed app and prepared services preserve the reverse reveal and final
  proof if a deployment is slow.
- Health and freshness checks show the difference between a deployed process
  and a trustworthy current result.

## 7. Claude context-efficiency design

Codex performs broad excavation once. Claude Code receives progressive,
task-specific context.

### 7.1 Pre-generated artifacts

Codex prepares:

- A concise provider-field and coverage summary derived from the generated
  Semrush schema inventory.
- Expected source, join, table, and rejection counts.
- A repository/module map.
- Current credential and external-tool procedures linked to official sources.
- Sanitized expected command outputs.
- Two or three All Companies visual options and a Company Detail reference.
- Fallback input, joined output, Airtable import report, and deployment proof.

These artifacts are versioned with their source hash or generation date when
staleness matters.

### 7.2 Progressive disclosure

- Level 1: skill name and trigger metadata.
- Level 2: focused `SKILL.md` workflow and boundaries.
- Level 3: detailed schema, examples, rubrics, and generated references.
- Task packet: outcome, non-goals, owned files, references, one fixture, exact
  command, acceptance checks, and compact handoff format.

Prompts point to files instead of copying those files into chat. Claude never
receives the full 37 MB Apify payload. Provider exploration happens against a
generated inventory and smallest useful fixture.

### 7.3 Session and agent boundaries

- Use fresh Claude sessions for the data, interface, and deployment phases.
- Persist settled decisions in repository files before clearing a session.
- Dispatch only the pipeline builder and dashboard builder for implementation.
- Use the evidence reviewer as a read-only quality gate.
- Do not dispatch multiple agents to rediscover the same repository context.
- Agent handoffs return changed files, decisions, counts, tests, and unresolved
  questions, not narrative transcripts or raw tool output.
- Commands print concise structured status and file paths by default. Verbose
  provider output requires an explicit diagnostic flag and must remain redacted.

Subagents are used for context isolation, not spectacle. Each dispatch must be
bounded enough that its result can be inspected within the current segment.

## 8. UI design-to-build loop

UI design remains a workshop centerpiece.

### 8.1 Live screen

All Companies is designed live because it communicates the portfolio decision
and contains the strongest spatial hierarchy: KPI ledger, market map, attention
signals, and leaderboard.

The visual companion receives:

- The marketer decision the screen supports.
- The approved product design principles and semantic tokens.
- A small real-shaped dashboard fixture.
- Required populated, partial, stale, empty, and error states.
- Desktop, tablet, mobile, keyboard, and screen-reader requirements.

It produces two or three visual options. The instructor selects one, records the
decision in the dashboard skill and UI brief, and passes the selected HTML or
image reference to the dashboard builder.

### 8.2 Pre-generated screen

Company Detail is pre-generated and included in the dashboard context packet.
It uses workspace tabs, with Battlecard and Evidence as sibling views, and
preserves the evidence-trace interaction. This keeps the final app coherent
without spending a second full visual cycle during the workshop.

### 8.3 Agent input and proof

The dashboard builder receives only:

- The selected All Companies reference.
- The pre-generated Company Detail reference.
- The compact dashboard brief.
- The canonical dashboard and data-contract skills.
- A small sanitized dashboard fixture.
- Explicit owned files, required states, and test commands.

The handoff is accepted only after a populated-state comparison, a non-happy
state check, a narrow component test, and a keyboard/accessibility smoke check.

## 9. Credentials and tool choreography

Teach the difference between agent authorization and application credentials.

### 9.1 Agent authorization

Use browser OAuth when supported:

- Airtable MCP: add the remote HTTP server, then authenticate from Claude
  Code's `/mcp` flow.
- Apify MCP/plugin: authenticate through its browser OAuth flow.
- Railway remote MCP: authenticate through OAuth.
- Railway CLI: use interactive browser login for the instructor workstation.

OAuth access is visible and revocable. It authorizes Claude to use tools within
the instructor's account permissions. It is not copied into application code or
Railway runtime variables.

### 9.2 Runtime credentials

The application uses separate runtime variables:

| Variable | Secret | Local | Web service | Refresh service |
| --- | --- | --- | --- | --- |
| `AIRTABLE_PAT` | Yes | `.env.local` | Required | Required |
| `AIRTABLE_BASE_ID` | No, but sensitive metadata | `.env.local` | Required | Required |
| Airtable table-name variables | No | `.env.local` | Required | Required |
| `APIFY_TOKEN` | Yes | `.env.local` when refreshing | Not present | Required |
| `APIFY_ACTOR_ID` | No | `.env.local` when refreshing | Not present | Required |
| `CACHE_INVALIDATION_SECRET` | Yes | `.env.local` | Required | Required |
| `APP_BASE_URL` | No | `.env.local` | Required | Required |

For workshop bootstrap, the Airtable PAT is limited to the disposable base and
has record read/write plus schema read/write access. A production follow-up
should split schema-bootstrap and runtime tokens. The Apify token should be
scoped to the required task and storage where supported and should expire soon
after the workshop.

Secrets are entered off-screen into `.env.local` or Railway variables. Prefer
stdin or a protected UI field over shell arguments. Railway variables are
reviewed, deployed, verified, and then sealed where the recovery trade-off is
acceptable. Secret preflight reports names and present/missing status only.

### 9.3 Service boundaries

- Web service: public domain, `npm start`, Airtable read access, no Apify token.
- Refresh service: no public domain, `npm run enrich`, Airtable write access,
  Apify access, cache invalidation access, and a hard timeout.
- Railway schedule: `0 15 * * 1`, Mondays at 15:00 UTC.
- The refresh process must close resources and exit. If the prior Railway cron
  execution remains active, Railway skips the next scheduled execution.
- Model or agent credentials never enter Railway. Semantic insight generation
  remains in Claude Code, Codex, or another selected agent harness.

## 10. Checkpoint model

Git history and live recovery serve different purposes.

### 10.1 Replay history

After implementation stabilizes, annotated Git tags mark the linear teaching
states:

- `workshop/cp0-start`
- `workshop/cp1-source`
- `workshop/cp2-data`
- `workshop/cp3-design`
- `workshop/cp4-app`
- `workshop/cp5-deployed`

The public replay guide explains how to inspect diffs between tags. The live
workshop does not switch branches or detach HEAD on stage.

### 10.2 Live recovery

Live recovery uses prepared artifacts and external state:

| Trigger | Fallback | Resume point |
| --- | --- | --- |
| Apify has not returned within 90 seconds | Disclose the switch and use the saved provider fixture | Run the same validation and join command |
| A coding agent exceeds its segment | Use the prepared implementation artifact or working app checkpoint | Inspect diff, tests, and decision rather than waiting |
| Airtable schema/import fails twice | Use the prepared disposable base | Verify schema/counts and continue to UI |
| Railway build remains pending at the segment boundary | Open the pre-deployed final app and inspect the active build asynchronously | Finish with health and freshness proof |
| Live visual generation fails or becomes unreadable | Use the pre-generated option set | Record a selection and continue with the same UI packet |

Fallbacks must pass through the same validation or presentation contracts as
live outputs. Hand-edited data that bypasses validation is not an acceptable
checkpoint.

## 11. Error handling and safety

- Treat provider text, external pages, reviewer notes, URLs, and MCP results as
  untrusted data, never instructions.
- Validate raw provider records at the boundary and isolate malformed nested
  sections when top-level company evidence remains usable.
- Preserve successful company writes when other companies fail.
- Retry only documented idempotent operations.
- Preserve the last successful dashboard data and last published insight when a
  refresh, model call, review, cache invalidation, or deployment fails.
- Do not overlap a manual refresh with an active Railway refresh.
- Do not let agent/model unavailability block deterministic metric refresh.
- Never expose full tokens, authorization headers, raw provider payloads, or
  unsanitized records in tool output, prompts, fixtures, or logs.
- Rotate or revoke workshop-only tokens after recording. Retain OAuth
  integrations only when continued access is intended.

## 12. Verification strategy

### 12.1 Repository checks

- Context tests verify required skills, agent definitions, prompt packets, and
  referenced files exist.
- Secret scans reject credential-shaped values in committed workshop artifacts.
- Schema drift checks compare the source hash and generated Semrush inventory.
- Contract tests cover domain normalization, joins, identities, classifications,
  malformed sections, missing values, and expected fixture counts.
- Airtable tests cover schema reconciliation, batched idempotent upserts, and
  compact status output.
- Dashboard tests cover populated, loading, stale, partial, empty, review, and
  evidence states.
- Deployment tests validate environment scopes, service commands, health, and
  refresh exit behavior.

### 12.2 Workshop rehearsal checks

Run three rehearsals:

1. Full live path with all providers.
2. Full fallback path with provider, Airtable, agent, and Railway delays forced.
3. Projected-screen rehearsal that verifies secrets remain hidden, text remains
   readable, and terminal output is compact.

Record actual segment duration and Claude usage after each rehearsal. Reduce
context or move exploration to pre-generated references when a segment exceeds
its timebox; do not remove final proof.

## 13. Documentation deliverables

The completed boilerplate includes:

- A public workshop entry point and architecture explanation.
- Minute-by-minute run of show.
- Speaker script with exact prompts, commands, proof, fallback, and transitions.
- Credential runbook with official links, least-privilege guidance, safe entry,
  verification, rotation, and revocation.
- Day-before and hour-before preflight checklists.
- Checkpoint and incident-recovery matrix.
- Four compact Claude task packets and paste-ready prompts.
- Two live skill skeletons that converge on canonical skills.
- Generated provider summary, expected counts, UI options, selected UI reference,
  and Company Detail reference.
- Post-workshop replay guide using Git tags and GitHub diffs.

## 14. External references

- [Apollo account CSV export](https://knowledge.apollo.io/hc/en-us/articles/46465094177421-Export-Accounts-to-a-CSV)
- [Airtable personal access tokens](https://support.airtable.com/v1/docs/creating-personal-access-tokens)
- [Airtable MCP server and Claude Code setup](https://support.airtable.com/articles/9897799762-using-the-airtable-mcp-server)
- [Apify API integration and scoped tokens](https://docs.apify.com/integrations/api)
- [Apify MCP server](https://docs.apify.com/integrations/mcp)
- [Railway for agents](https://docs.railway.com/agents)
- [Railway CLI deployment](https://docs.railway.com/cli/deploying)
- [Railway variables and sealed secrets](https://docs.railway.com/variables)
- [Railway cron jobs](https://docs.railway.com/cron-jobs)

## 15. Acceptance criteria

The workshop project is ready when:

1. A full rehearsal finishes within 90 minutes without cutting proof or recap.
2. The preflight command reports required tools, files, connections, and
   variable names without printing secret values.
3. Both live-created skill flows produce or converge on the canonical skills.
4. The Apollo-to-Apify join produces expected accepted/rejected counts and
   preserves data classification and provenance.
5. The Airtable schema and import are repeatable and idempotent.
6. The All Companies screen can be traced from visual option to selected
   reference, dashboard skill, agent task, component tests, and deployed UI.
7. Company Detail and evidence trace match the approved design system.
8. Web and refresh Railway services contain only the credentials each needs.
9. The scheduled refresh exits, records status, preserves prior success on
   partial failure, and can be safely retried.
10. Every fallback resumes through the same contract as its corresponding live
    step and is disclosed to the audience.
11. The GitHub repository contains replay instructions and inspectable
    checkpoint history without committed secrets or unsanitized payloads.
12. The full live path, forced-fallback path, and projected-screen safety
    rehearsal all pass.
