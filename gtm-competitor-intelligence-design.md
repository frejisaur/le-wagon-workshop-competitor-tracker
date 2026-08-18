# GTM Competitor Intelligence Workshop — Design Specification

Date: 2026-08-18

## 1. Purpose

Build and demonstrate a working competitor and content-intelligence prototype for technically curious marketers. The 90-minute workshop should produce a deployed application, teach a reusable agent-assisted workflow, and leave attendees with a starter repository they can extend.

The product replaces part of an expensive all-in-one competitive-intelligence subscription with a visible research pipeline:

1. Start with an Apollo account export.
2. Enrich company domains through the Apify Semrush scraper.
3. Store editable, curated records in Airtable.
4. Generate evidence-backed GTM battlecards through a repository skill run by the user's agent harness of choice.
5. Serve an enterprise-style dashboard from a Railway-hosted application.
6. Refresh scraper-derived facts through a scheduled Railway job and run semantic enrichment on an independent agent-harness schedule.

## 2. Audience and workshop outcome

The primary audience is marketers who are comfortable with CSV files and APIs but are not professional developers.

By the end of the session, attendees should have:

- A working, deployed prototype.
- A clear understanding of the research, enrichment, transformation, and display pipeline.
- A reusable repository containing the application, deterministic Railway job, versioned agent skill, harness-neutral enrichment commands, and configuration examples.
- A practical understanding of where free plans are sufficient and where their limits shape the architecture.

## 3. Scope

### Version 1

- Import a prebuilt Apollo competitor list.
- Run the Apify `pro100chok/semrush-scraper` in Domain Overview mode.
- Transform and upsert curated data into Airtable.
- Display an all-companies competitive landscape.
- Display a detailed individual-company view.
- Generate one evidence-backed GTM battlecard per company.
- Deploy the web application and deterministic scraper-enrichment command to Railway.
- Refresh all scraper-derived company, keyword, and paid-ad fields weekly through Railway.
- Generate or refresh semantic GTM insights on an independent schedule configured in the user's agent harness, such as Claude Code or Codex.
- Route low-confidence agent output to an Airtable review queue without replacing the last published insight.
- Show freshness and job status in the application.

### Version 1.2

- Page Evidence table.
- Apify SEO Audit mode for selected landing pages.
- Optional Firecrawl retrieval of clean page content.
- Page-level audience, promise, proof, CTA, and content-pattern analysis.
- Content brief generation from page and SERP evidence.

### Explicitly excluded from Version 1

- Full-page crawling or body-copy analysis.
- Authentication and multi-tenant workspaces.
- Postgres, Redis, queues, or a separate object store.
- Real-time refresh.
- Automatic discovery of the initial account list.
- A composite proprietary competitor score whose weighting cannot be explained.

## 4. Source data analysis

The supplied file `apollo-accounts-semrush-scraper.json` is a 37 MB array containing 52 Domain Overview records. It contains 32 top-level fields and 295 distinct normalized scalar paths.

### Top-level fields

- Identity: `domain`, `database`, `is_root_domain`.
- Authority and links: `authority_score`, `backlinks`, `referring_domains`, `follow_backlinks`, `nofollow_backlinks`.
- Organic search: `organic_traffic`, `total_traffic`, `organic_keywords`, `organic_traffic_cost_usd`, `organic_competitors_count`.
- Paid search: `paid_traffic`, `paid_keywords`, `paid_traffic_cost_usd`, `paid_competitors_count`.
- AI search: `ai_visibility`, `ai_visibility_benchmark`, `ai_mentions`, `ai_cited_pages`.
- Geography: `top_country`, `top_country_traffic`.
- Moz: `moz_domain_authority`, `moz_spam_score`.
- Nested groups: `authority`, `backlinks_detail`, `organic`, `paid`, `ai_search`, `serp_features`, `moz`.

### Nested authority and backlink fields

- Authority score, total backlinks, referring domains, link power, naturalness, health, and search-traffic factor.
- Follow/nofollow counts, link counts, domains, IPs, images, frames, and forms.
- Five top anchors with backlink and domain counts.
- Five sample backlinks with source title, source URL, target URL, anchor, and nofollow flag.

### Nested organic fields

- Up to seven top-keyword rows in the supplied payload.
- Keyword, position, previous position, difference, volume, CPC, difficulty, paid competition, estimated traffic, traffic share, traffic value, URL, intent, SERP codes, and result count.
- Six competitor rows per company, including a self-row.
- Competition level, shared keywords, organic keywords, organic traffic and value, paid keywords, SERP-feature traffic, and total traffic.
- 729 daily global points and 729 daily country points.
- 176 monthly global points and 176 monthly country points.
- Each trend point contains rank, organic traffic, keywords, traffic value, branded and non-brand traffic, paid traffic and keywords, paid cost, and SERP-feature traffic.
- Cross-country summaries for 3–122 databases per company.

### Nested paid fields

- Paid-ad rows containing keyword, title, description, visible URL, landing URL, position, previous position, volume, CPC, difficulty, competition, traffic, share, and traffic value.
- Paid competitors with overlap, common keywords, paid and organic keyword counts, traffic, and cost.
- The supplied sample contains paid traffic for five companies and 16 total ad rows.

### Nested AI-search fields

- Visibility and supplied industry benchmark.
- Total mentions and cited pages.
- Four LLM rows: Gemini, AI Overview, AI Mode, and ChatGPT.
- Mentions, self-mentions, and cited pages per LLM.
- Up to ten cited-source domains.
- 118 country rows per company.

### Nested SERP and Moz fields

- Total SERP positions and keyword/position counts keyed by numeric feature codes.
- Moz DA, spam score, linking-root domains, and ranking keywords.
- Ten reported top pages, seven top linking domains, and discovered/lost linking-domain activity.

## 5. Data-quality rules

The transformer must apply these rules before Airtable or UI presentation:

1. Label top-keyword metrics as observed samples. The supplied payload contains only 1–7 rows per company, averaging 6.9.
2. Remove the company self-row from organic and paid competitor lists.
3. Ignore `is_root_domain` in Version 1 because all 52 supplied values are false.
4. Preserve provider backlink totals independently. Follow plus nofollow does not equal total backlinks for 31 companies.
5. Filter zero-value AI-country rows from default views. In the supplied file, 5,713 of 6,136 country rows have zero mentions.
6. Parse Moz-formatted values such as `1.6k` and `3%` into normalized numeric fields while retaining the original string.
7. Validate Moz top-page values before display. The supplied `top_pages` arrays appear to contain some linking-domain records.
8. Do not label numeric SERP feature codes until a reliable mapping is supplied.
9. Treat provider figures as estimates and display source, database, and enrichment timestamp.
10. Separate raw values, deterministic calculations, and agent interpretations in both the schema and UI.

## 6. User experience

The product has two primary screens. Search, paid, AI, and authority intelligence appear as sections inside these screens rather than separate top-level applications.

### 6.1 All Companies

Purpose: Help a marketer understand the competitive landscape and decide which companies deserve investigation.

Components:

- Portfolio KPIs: companies tracked, combined organic traffic, organic keyword footprint, companies growing in 30 days, and companies with paid activity.
- Market map: authority score versus organic traffic, with optional encoding for AI benchmark performance.
- Attention signals: growth leaders, paid-search leaders, AI benchmark outperformers, and companies with majority non-brand demand.
- Sortable company leaderboard.
- Filters for country, paid activity, AI performance, traffic range, authority range, and Apollo segment when present.
- Columns for authority, organic traffic, 30-day change, non-brand share, keywords, paid activity, AI visibility/benchmark, referring domains, and freshness.

### 6.2 Company Detail

Purpose: Turn one company record into an evidence-backed GTM battlecard.

Components:

- Header with domain, Apollo identity, market, enrichment time, and job status.
- KPI row: authority, traffic and movement, keyword footprint, AI visibility versus benchmark, and link momentum.
- Historical chart with toggles for traffic, keywords, traffic value, branded/non-brand traffic, paid activity, and SERP-feature traffic.
- Demand-composition view for branded versus non-brand traffic.
- Observed top-keyword table with position, volume, CPC, difficulty, traffic, intent, and landing URL.
- Landing-page portfolio calculated by grouping observed keyword rows by normalized URL.
- Organic competitor table excluding the self-row.
- Geographic footprint using only meaningful country values.
- AI-search section with LLM breakdown, benchmark comparison, nonzero countries, and cited sources.
- Authority and distribution section with link composition, anchors, backlink samples, Moz metrics, and linking sources.
- Paid-search section displayed only when meaningful data exists; otherwise show a concise empty state.
- GTM battlecard and Evidence workspace tabs with direct claim-to-source navigation.

### 6.3 Evidence standard

Every generated statement must include:

- The conclusion.
- A confidence label.
- Linked Airtable evidence records or raw dataset references.
- The agent-evidence fingerprint and run ID.
- The generating agent harness and model.
- The skill and workflow versions.
- Generation timestamp.

The agent may summarize themes, strengths, vulnerabilities, and recommended actions. It may not present an inference as a directly measured field.

### 6.4 Interface design system

The approved interface direction is a calm research instrument built on IBM Carbon patterns with a product-specific visual layer. The All Companies screen is landscape-led, and Company Detail uses workspace tabs with Battlecard and Evidence as sibling views.

The complete visual system, including tokens, layouts, components, charts, states, responsive behavior, accessibility rules, and mockup decisions, is defined in [`gtm-competitor-intelligence-design-system.md`](./gtm-competitor-intelligence-design-system.md).

## 7. Airtable design

Airtable is the editable serving layer, not the raw warehouse. The design targets the Free plan limit of 1,000 cumulative records per base and 1,000 API calls per workspace per month.

### 7.1 Companies — approximately 52 records

Contains:

- Apollo identity and segmentation.
- Current top-level Domain Overview metrics.
- Deterministic calculations: 30-day and 12-month changes, non-brand percentage, benchmark gap, and tracked-set traffic share.
- Compact 24-month trend JSON for the UI.
- AI-by-LLM, nonzero-country, organic-competitor, anchor, and linking-source JSON.
- Raw Apify dataset item URL.
- Enrichment status and timestamps.
- Canonical agent-evidence fingerprint calculated from the exact curated fields exposed to the skill.
- Last successful scraper refresh and next agent-enrichment due timestamp.

### 7.2 Keywords — approximately 358 records in the supplied sample

Contains:

- Linked company.
- Keyword, position, previous position, and difference.
- Volume, CPC, difficulty, and competition.
- Traffic, share, and traffic value.
- Intent values.
- Landing URL and normalized URL.
- SERP codes retained as raw values.
- Observation timestamp.

The compound identity is company plus keyword plus normalized landing URL.

### 7.3 Paid Ads — approximately 16 records in the supplied sample

Contains:

- Linked company.
- Keyword, title, description, visible URL, and landing URL.
- Position, volume, CPC, difficulty, competition, traffic, share, and traffic value.
- First-observed and last-observed timestamps.

The stable identity is a hash of company, keyword, title, description, and normalized landing URL.

### 7.4 GTM Insights — up to 52 records

Contains:

- Linked company.
- Observed themes.
- Search strengths and vulnerabilities.
- Paid-message summary when data exists.
- AI-search summary.
- Recommended response.
- Evidence references.
- Confidence, agent harness, model, skill version, agent-evidence fingerprint, workflow version, run ID, and generation timestamp.

Only published insights are stored here. A candidate never replaces the last published insight until it passes automatic publication gates or is explicitly approved.

### 7.5 Insight Reviews — up to 52 records

Contains at most one reusable review record per company:

- Linked company and stable company identity.
- Candidate themes, summary, recommendations, and evidence references.
- Confidence and machine-readable reasons requiring review.
- Agent-evidence fingerprint, agent harness, model, skill version, workflow version, run ID, and generation timestamp.
- Review status: `needs_review`, `approved`, `rejected`, `stale`, or `published`.
- Reviewer notes, reviewer identity when supplied, and review timestamp.

The Airtable base includes a `Needs Review` view. Rejected candidates and reviewer notes remain available to the next agent attempt. The same company-linked row is reused so the review queue remains bounded.

### 7.6 System — one record

Contains:

- Last run start and finish.
- Last successful run.
- Current status.
- Processed, succeeded, and failed company counts.
- Short error summary.
- Current cache version.
- Last Railway workflow version and run ID.
- Last agent-enrichment run, skill version, processed count, review count, and error summary.

Estimated Version 1 record count using the supplied sample: approximately 531 records, including the maximum 52 review-queue records.

## 8. Raw-data retention

The full Domain Overview response remains in a named Apify dataset. Airtable stores raw-record links, not the complete 37 MB payload.

The named dataset is the evidence source for:

- Long historical series not copied into Airtable.
- Debugging transformations.
- Rebuilding Airtable after schema changes.
- Auditing generated battlecard statements.

## 9. Scheduling and execution architecture

Version 1 has two independent control planes. Railway owns deterministic scraper collection and transformation. A user-selected agent harness owns semantic enrichment that requires an LLM. Airtable and validated repository commands form the handoff boundary; neither control plane must invoke or wait for the other.

### 9.1 Web service

- Serves the frontend and server-side API.
- Reads Airtable with server-only credentials.
- Shapes Companies, Keywords, Paid Ads, and GTM Insights into a dashboard response.
- Stores the shaped response in an in-memory cache.
- Rebuilds the cache on first request after a restart.
- Supports a signed internal cache-invalidation endpoint.
- Exposes health and data-freshness status.

Start command: `npm start`.

### 9.2 Railway cron service

- Uses the same repository, image, environment-variable names, validation schemas, and transformation modules.
- Runs the scraper, validates its response, transforms records, performs batched Airtable upserts, updates agent-evidence fingerprints and System status, invalidates the web cache, and exits.
- Writes only observed provider fields and deterministic calculations that can be reproduced from the scraper response.
- Does not invoke an LLM, an agent, or a semantic-enrichment skill.
- Has no public domain.
- Uses Railway scheduling in UTC.
- Has one weekly schedule: `0 15 * * 1` (Mondays at 15:00 UTC).
- Applies a hard task timeout.
- Exits nonzero on an unrecovered failure.

Start command: `npm run enrich`.

### 9.3 Agent-harness enrichment

The user may schedule semantic enrichment in Claude Code, Codex, or another harness capable of invoking repository skills and commands. The repository does not depend on a harness-specific scheduler API.

The initial versioned runtime skill is
`.agents/skills/generating-gtm-battlecards/SKILL.md`. It defines:

- When the skill should run.
- How to select and interpret evidence.
- The boundary between observed facts and inference.
- Confidence and review-routing rules.
- The required structured candidate schema.
- How to use the repository preparation, submission, and publication commands.

The harness supplies only run-specific context. Reference material is loaded from the skill on demand rather than copied into every scheduled prompt.

Repository commands provide a stable, harness-neutral interface:

- `npm run insights:prepare -- --due` returns a bounded manifest of companies due for semantic enrichment and the evidence required for each company.
- `npm run insights:submit -- <candidate-file>` validates structured output, verifies evidence references and the current agent-evidence fingerprint, and either publishes or queues the candidate.
- `npm run insights:publish-approved` promotes approved, still-current review candidates into GTM Insights.

The agent schedule may run weekly, monthly, after a skill-version change, or on demand. Due-work selection uses timestamps, agent-evidence fingerprints, and skill versions rather than a weekday check, so missed schedules catch up on the next run.

### 9.4 Publication gates and human review

A candidate is auto-published only when:

- It passes the structured-output schema.
- Every generated claim has valid evidence references.
- Its agent-evidence fingerprint still matches the current company evidence.
- It has no conflicting-source or insufficient-evidence review reason.
- Its confidence is `high` under the skill's versioned confidence rubric.

All other valid candidates are upserted into Insight Reviews with `needs_review`; they do not replace the last published insight. A reviewer uses Airtable's `Needs Review` view to inspect evidence, add notes, and mark a candidate `approved` or `rejected`.

`npm run insights:publish-approved` revalidates approved candidates before promotion. If source evidence changed while a candidate awaited review, the command marks it `stale`. Rejected candidates remain available with reviewer notes, and a later agent run may regenerate them using those notes.

### 9.5 No additional infrastructure in Version 1

- No Postgres.
- No Redis or queue.
- No persistent Railway volume.
- No separate API service.
- No client-side Airtable calls.

## 10. Enrichment workflow

### 10.1 Weekly deterministic scraper refresh

1. Read active company domains from Airtable.
2. Create a run ID and mark the Railway workflow in the System record as running.
3. Submit domains to the Apify Domain Overview actor in bounded batches.
4. Poll each actor run with a hard timeout.
5. Validate every returned record.
6. Store the full results in the named Apify dataset.
7. Calculate current company metrics, movement fields, and a canonical agent-evidence fingerprint.
8. Batch-upsert Companies in groups supported by Airtable.
9. Replace or upsert observed keyword records.
10. Upsert paid-ad records and observation dates.
11. Persist the new agent-evidence fingerprint without invoking or changing the status of the agent workflow.
12. Record per-company failures without discarding successful companies.
13. Update the Railway workflow's System status.
14. Invalidate the web cache.
15. Close connections and exit.

### 10.2 Independently scheduled semantic enrichment

1. The selected agent harness invokes the `generating-gtm-battlecards` skill on its own schedule.
2. The skill calls `insights:prepare` to retrieve only companies currently due and a bounded evidence package for each one.
3. The agent processes one company at a time and produces a schema-constrained candidate with evidence references and confidence reasons.
4. The skill calls `insights:submit` for each candidate.
5. The submission command auto-publishes qualifying candidates and routes all others to Insight Reviews.
6. Per-company failures are recorded without discarding successful candidates.
7. The run records its harness, model, skill version, workflow version, counts, and status.

An insight is due when it has no published version, its configured refresh timestamp has passed, its current agent-evidence fingerprint differs from the published insight's fingerprint, its skill version changed, or a reviewer requested regeneration. A pending review candidate is not overwritten unless it becomes stale or the reviewer requests another attempt.

### 10.3 Review and promotion

1. The reviewer opens Airtable's `Needs Review` view.
2. The reviewer checks the candidate, confidence reason, and linked evidence.
3. The reviewer adds optional notes and selects `approved` or `rejected`.
4. `insights:publish-approved`, run manually during the workshop or by the next agent schedule, revalidates approved candidates.
5. Current candidates are promoted to GTM Insights; outdated candidates are marked `stale`.
6. The web cache is invalidated only after successful promotion.

## 11. Failure handling

- A single failed company does not fail successful company upserts.
- A failed Apify batch is retried with bounded exponential backoff.
- Airtable 429 responses use exponential backoff with jitter.
- Each external call has a timeout.
- The cron command always closes resources and terminates.
- If a previous Railway cron execution is still active, Railway may skip the next execution; therefore the task timeout must be shorter than the schedule interval.
- Railway and agent workflows have separate run IDs, timestamps, and `running`, `partial`, `succeeded`, and `failed` statuses.
- The UI continues serving the last successful cache when enrichment fails and displays its freshness.
- Cache invalidation occurs only after Airtable writes complete.
- Agent-harness unavailability, missed schedules, and generation failures do not block the Railway metric refresh.
- Railway failures do not erase published insights; the agent workflow may continue using the most recent successful evidence and its freshness metadata.
- Submission is idempotent by company, agent-evidence fingerprint, skill version, and workflow version.
- Replaying a run cannot create duplicate insight or review records.
- A candidate whose agent-evidence fingerprint no longer matches is marked `stale` and cannot be published.
- Malformed nested sections are omitted from their UI module while valid top-level data remains available.

## 12. Security

- Airtable and Apify tokens used by the web and scraper workflows exist only in Railway environment variables.
- The model token used by semantic enrichment belongs to the user's agent harness and is not required by the Railway service.
- The browser calls only the Railway application API.
- The cache-invalidation endpoint requires a secret signature.
- Logs must not contain secrets or full authorization headers.
- Raw provider responses are not returned wholesale to the browser.
- External URLs displayed in evidence views are treated as untrusted content.
- Provider text, reviewer notes, and linked page content are treated as untrusted data, never as agent instructions.

## 13. Repository structure

The implementation plan may refine filenames, but the intended boundaries are:

```text
AGENTS.md
CLAUDE.md
.agents/
  skills/
    competitor-data-contracts/
      SKILL.md
      references/
    generating-gtm-battlecards/
      SKILL.md
      references/
    operating-competitor-intelligence/
      SKILL.md
      references/
.codex/
  agents/
    pipeline-builder.toml
    dashboard-builder.toml
    evidence-reviewer.toml
.claude/
  agents/
    pipeline-builder.md
    dashboard-builder.md
    evidence-reviewer.md
  skills/
    competitor-data-contracts -> ../../.agents/skills/competitor-data-contracts
    generating-gtm-battlecards -> ../../.agents/skills/generating-gtm-battlecards
    operating-competitor-intelligence -> ../../.agents/skills/operating-competitor-intelligence
app/
  routes-or-pages/
  api/
components/
  landscape/
  company/
  shared/
lib/
  airtable/
  apify/
  agents/
    manifests/
    candidates/
    publication/
  transforms/
  schemas/
  cache/
jobs/
  enrich.ts
  prepare-insights.ts
  submit-insight.ts
  publish-approved-insights.ts
tests/
  fixtures/
  transforms/
  agents/
  api/
```

Each unit has one responsibility and communicates through validated domain types rather than raw provider objects.

### 13.1 Agent and skill architecture

The main Claude Code or Codex session orchestrates focused build-time agents;
the application has no autonomous multi-agent runtime. `AGENTS.md` and
`CLAUDE.md` hold short project-wide rules. Canonical skills live in
`.agents/skills/`, with `.claude/skills/` symlinks avoiding duplicated content.
Harness-specific agent files contain only role and tool configuration.

| Definition | Responsibility |
|---|---|
| `competitor-data-contracts` | Provider validation, transformations, Airtable identities, evidence fingerprints, and fixtures. |
| `generating-gtm-battlecards` | Due-work selection, structured candidates, evidence, confidence, review routing, and publication. |
| `operating-competitor-intelligence` | Refreshes, freshness, failure diagnosis, safe retries, smoke checks, and workshop fallbacks. |
| `pipeline-builder` | Implements and tests schemas, transforms, Airtable access, and enrichment commands. |
| `dashboard-builder` | Implements the two screens against validated types and sanitized fixtures. |
| `evidence-reviewer` | Performs read-only review for unsupported claims, unsafe data, security leaks, and missing tests. |

The workshop explicitly invokes one data-contract skill, one battlecard run,
and the read-only reviewer. Routine operation defaults to one agent using the
relevant skill; parallel agents are optional and receive neither production
secrets nor unattended deployment authority.

## 14. Testing strategy

- Preserve a small sanitized fixture derived from the supplied payload.
- Unit-test provider-response validation and every deterministic calculation.
- Test the known data-quality cases: self-competitors, zero AI countries, inconsistent backlink totals, formatted Moz strings, suspicious Moz page values, absent paid data, and unknown SERP codes.
- Test idempotent Airtable record identities and batched writes.
- Test partial-failure behavior independently in the Railway and agent workflows.
- Test that the due-work manifest selects changed, stale, skill-version-mismatched, reviewer-requested, and never-generated companies while excluding unchanged companies and active review candidates.
- Test that generated insights contain evidence, harness, model, skill version, workflow version, agent-evidence fingerprint, run ID, and timestamp metadata.
- Contract-test the skill against representative high-confidence, low-confidence, conflicting-evidence, and malformed-output cases.
- Validate every skill's metadata, trigger description, required references, and command names.
- Contract-test each skill with representative invocation and non-invocation prompts.
- Validate Codex and Claude Code agent definitions and verify that matching role names preserve the same responsibility boundaries.
- Test that the evidence reviewer remains read-only and reports file-backed findings without modifying the workspace.
- Test automatic publication gates and every Insight Review status transition.
- Test that approval promotes a current candidate, preserves the previous published insight until promotion, and rejects a stale candidate.
- Test idempotent replay of preparation, submission, and publication commands.
- Test API shaping and cache invalidation.
- Component-test both primary screens with populated, partial, loading, stale, and error states.
- Run a deployment smoke test against a non-production Airtable base before the workshop.

## 15. Workshop delivery strategy

The repository should be prepared in checkpoints so the presenter can recover from external-service or timing failures.

- Start from the working Apollo CSV and a sanitized scraper fixture.
- Demonstrate one live Apify enrichment batch, while retaining the fixture as fallback.
- Build or reveal the Airtable transformation and inspect the resulting records.
- Use `dashboard-builder` to construct the two primary screens against sanitized fixtures.
- Run `generating-gtm-battlecards` in one supported agent harness and retain pre-generated candidates as fallback.
- Show one high-confidence battlecard auto-publish and one low-confidence candidate enter Airtable's `Needs Review` view.
- Add a reviewer note, approve the candidate, run `npm run insights:publish-approved`, and show the promoted battlecard in the dashboard.
- Deploy the prepared Railway project and demonstrate that its weekly scraper cron is independent from the agent-harness schedule.
- Finish by showing both workflow statuses, evidence freshness, and the Version 1.2 extension point.

## 16. Acceptance criteria

Version 1 is complete when:

1. The Apollo list can be imported without manual code changes.
2. A Domain Overview run can enrich at least the supplied 52 domains.
3. Curated records remain below the Airtable Free-plan record limit for the sample dataset.
4. No Airtable or provider secret is sent to the browser.
5. The All Companies screen renders real portfolio metrics and supports navigation to a company.
6. The Company Detail screen renders trends, keyword evidence, competitors, AI presence, authority, and conditional paid data.
7. A battlecard distinguishes inference from observed evidence, links to its sources, and records harness, model, skill version, agent-evidence fingerprint, workflow version, and run ID.
8. The weekly Railway service refreshes only scraper-derived facts, finishes, and exits cleanly without requiring an agent or model token.
9. A supported agent harness can invoke the repository skill on an independent schedule and catch up work selected by timestamps, fingerprints, review requests, and skill versions.
10. High-confidence validated candidates publish automatically, while other candidates preserve the last published insight and enter the bounded Airtable review queue.
11. An approved current candidate can be promoted with `npm run insights:publish-approved`; a stale candidate cannot be published.
12. Replaying Railway or agent work is idempotent, and partial failures preserve successful updates and the last successful dashboard cache.
13. The deployed prototype can be demonstrated from a fresh browser session.
14. Claude Code and Codex can discover the repository guidance, invoke the three canonical skills, and use equivalent focused agent roles without changing application code.
15. The workshop can demonstrate the fixture fallback, one skill-driven workflow, and one read-only evidence review without depending on live external-service timing.

## 17. External references

- Airtable plan and record limits: <https://support.airtable.com/v1/docs/airtable-plans>
- Airtable Web API limits and pagination: <https://support.airtable.com/getting-started-with-airtables-web-api>
- Apify scraper documentation: <https://apify.com/pro100chok/semrush-scraper>
- Apify storage retention: <https://docs.apify.com/storage>
- Railway cron behavior: <https://docs.railway.com/cron-jobs>
- Codex project instructions: <https://developers.openai.com/codex/guides/agents-md>
- Codex skills: <https://developers.openai.com/codex/skills>
- Codex custom agents: <https://developers.openai.com/codex/multi-agent>
- Claude Code skills: <https://code.claude.com/docs/en/skills>
- Claude Code subagents: <https://code.claude.com/docs/en/sub-agents>
