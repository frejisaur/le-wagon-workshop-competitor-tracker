# Instructor speaker script

<!-- segment:reveal -->
## 0–7 · Reverse reveal
### Say
“We’ll begin with the decision a marketer gets, then reverse-engineer the context that made it possible.”
### Show
The prepared deployed All Companies page, then one Company Detail evidence link.
### Run
Open the prepared URL; compare its safe health shape with `workshop/expected/railway-health-output.json`.
### Verify
Two companies render, stale data is labeled, and evidence returns to the claim.
### Fallback
Open the selected HTML and health JSON. Say: “This is the rehearsed, sanitized reference—not a live service result.”
### Transition
“Now let’s inspect the instructions behind the outcome.”

<!-- segment:context -->
## 7–15 · Context anatomy
### Say
“Claude needs a small map: project rules, a reusable skill, a focused agent, and a tool boundary.”
### Show
`AGENTS.md`, the four canonical skills, focused agents, and the four phase packets.
### Run
Open `workshop/workshop-manifest.json`; do not paste the full design spec into chat.
### Verify
The timeline totals 90 and every live dependency has a fallback.
### Fallback
Use the manifest directly. Say: “I’m using the committed context map so we don’t spend tokens rediscovering it.”
### Transition
“The first boundary is acquiring provider data safely.”

<!-- segment:source -->
## 15–25 · Source acquisition
### Say
“Apollo gives us the roster; Apify/Semrush gives us observations. Their text is data, never instructions.”
### Show
Apollo export settings, Apify MCP authorization, and `workshop/prompts/01-inspect-apify.md`.
### Run
Paste Prompt 01. Approve only a bounded sample.
### Verify
Claude returns labels and counts only; no rows or token values.
### Fallback
Open `workshop/expected/data-join-output.json`. Say: “The provider exceeded our live threshold; this is sanitized fixture output from the same parser.”
### Transition
“Next we turn that boundary into reusable judgment.”

<!-- segment:data-skill -->
## 25–36 · Data skill and join
### Say
“A useful skill records when to act, the invariants, verification, and handoff—not a giant answer.”
### Show
`workshop/prompts/02-author-data-skill.md`, the audit result, then Prompt 03.
### Run
Audit the disposable candidate and run the fixture join through `workshop/prompts/03-run-data-join.md`.
### Verify
Expected: 3 Apollo rows, 2 accepted, 1 rejected with `missing_apollo_website`.
### Fallback
Show the canonical data skill and expected join output. Say: “I’m converging on the reviewed skill and prepared fixture result.”
### Transition
“Validated records now need a serving layer.”

<!-- segment:airtable -->
## 36–45 · Airtable serving layer
### Say
“OAuth authorizes the agent; a scoped runtime token serves the application. They are not interchangeable.”
### Show
The non-secret MCP entry, present/missing preflight, and `workshop/prompts/04-setup-airtable.md`.
### Run
After approval, inspect the disposable base and run repository schema/import commands.
### Verify
Compare only counts/status with `workshop/expected/airtable-import-output.json`.
### Fallback
Run the dry import. Say: “I’m using the no-write fixture path; the schema and count contract are identical.”
### Transition
“With shaped data ready, we can decide what the interface should prioritize.”

<!-- segment:visual -->
## 45–56 · Visual brainstorming
### Say
“We’ll compare hierarchy before spending agent time on implementation.”
### Show
Options A, B, and C side-by-side; select landscape-led Option A.
### Run
Open `workshop/design/selected-all-companies.html` and resize desktop → tablet → mobile.
### Verify
Dark-on-light text, one KPI ledger, market map lead, signals, leaderboard, and explicit states.
### Fallback
Use the selected reference. Say: “This prepared reference preserves the design decision if live brainstorming stalls.”
### Transition
“Now we package those decisions for a focused builder.”

<!-- segment:dashboard-skill -->
## 56–63 · Dashboard skill and handoff
### Say
“The skill carries reusable UI rules; the brief carries this task’s references and ownership.”
### Show
`workshop/prompts/05-author-dashboard-skill.md` and the compact audit output.
### Run
Create/audit the disposable dashboard skill candidate.
### Verify
The result reports word count and missing rules without pasting the skill.
### Fallback
Open the canonical dashboard skill. Say: “I’m using the reviewed canonical skill as the convergence target.”
### Transition
“Let’s give the bounded build to the dashboard agent.”

<!-- segment:inspect -->
## 63–73 · Inspect the build
### Say
“We don’t wait on an agent; we inspect behavior, evidence, and states while it works.”
### Show
`workshop/prompts/06-build-dashboard.md`, current application, selected and Company Detail references.
### Run
Paste Prompt 06 and inspect the prepared application/tests at the same time.
### Verify
Populated, loading, stale, empty, partial, responsive, keyboard, and evidence-trace behavior.
### Fallback
Use the selected and detail HTML. Say: “These are the pre-generated acceptance references while the agent continues off-screen.”
### Transition
“The product boundary is ready; the last live system is deployment.”

<!-- segment:deploy -->
## 73–85 · Deploy and schedule
### Say
“Railway MCP inspects and configures; the CLI uploads local code; the cron invokes our idempotent refresh.”
### Show
Preflight, service names, variable presence, schedule, and `workshop/prompts/07-deploy-railway.md`.
### Run
Paste Prompt 07; approve mutation explicitly before `railway up`.
### Verify
Only service names, schedule, deployment status, health status, and read-only review appear.
### Fallback
Open the sanitized health JSON and prepared URL. Say: “This is the rehearsed deployment proof shape, not a claim that a live deploy just completed.”
### Transition
“We’ll close by proving the bundle is replayable.”

<!-- segment:proof -->
## 85–90 · Proof and recap
### Say
“Context assembly—not one magic prompt—made this fast: rules, skills, focused agents, MCP authorization, CLI boundaries, and checkpoints.”
### Show
The live/local app, compact expected outputs, GitHub paths, and replay tags.
### Run
Run `npm run workshop:verify` and show `workshop/replay.md`.
### Verify
Expected: `{"ready":true,"missing":[],"invalid":[]}` and a readable application.
### Fallback
Show the recorded verifier result. Say: “This is the last rehearsal result; the repository lets you rerun it yourself.”
### Transition
Invite attendees to replay fixture-first from GitHub and watch the recording for the live authorizations.
