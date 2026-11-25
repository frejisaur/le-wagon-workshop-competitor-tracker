# Speaker script

Follows `run-of-show.md` one to one. Each segment has **Say** (the point, not a teleprompter), **Show**, **Run**, **Verify**, **Fallback** and **Transition**. Times are clock minutes from the start.

Conventions:
- Two Airtable bases. **Workshop** is imported live and read locally through `.env.local`. **Showcase** is read by production and refreshed by GitHub Actions.
- Two terminal panes. **Left**: Claude Code, which runs the agent lanes. **Right**: a plain shell for commands, the dev server and deploys.
- `$APP_URL` is the Vercel production URL (set in your shell during preflight). Paths under `data/apollo/` and `data/apify/` are git-ignored. Values of secrets never appear on screen.

---

## 1. Reveal (00-05)

**Say**: "This is a competitor-intelligence tool for a marketing team. It tracks ~10 competitors, refreshes itself every week, and every claim it makes links back to evidence. By minute 80 we'll have rebuilt the important parts and redeployed it. Watch for one idea: the agent is only as good as the context we give it."

**Show** (`$APP_URL`): All Companies, then one company, then Battlecard, then click a claim to jump to its Evidence row, then back. Point at the freshness badge and the refresh run ID.

**Transition**: "How does an agent know any of the rules this app follows? Let's open the box."

## 2. Context anatomy (05-13)

**Say**: "Context comes in layers, and each layer has one job."

**Show**, in this order, one sentence each:

| File | Its one job |
|-|-|
| `CLAUDE.md` | 5 lines: "read AGENTS.md". The harness adapter. |
| `AGENTS.md` | Iron laws that apply everywhere: provenance, secrets, fixtures first, tests. |
| `.agents/skills/competitor-data-contracts/` | A skill: name + description (always loaded), `SKILL.md` (loaded when relevant), `references/` (loaded only when needed). Progressive disclosure. |
| `.claude/agents/dashboard-builder.md` | A focused agent: what it owns, what it must not touch, what it returns. |
| `/mcp` in Claude Code | Tools the agent can use with *your* login: Airtable, Apify, Vercel. |
| `package.json` scripts + `tests/` | Deterministic commands and proof. |

**Say** the rule, and leave it on screen: **"MCP to explore. Tested CLI to change data."**

**Transition**: "Let's see that rule with real data."

## 3. Data provenance (13-33)

**Run** (left) `prompts/02-data-join-skill.md`. **Lane A starts** (collect at 22). **Say**: "That runs in the background. I never watch an agent type."

**Run** (live exports, ~3 min): export the prepared Apollo Saved list as CSV and the prepared Apify run's dataset as JSON. Both land in `~/Downloads`; move them (right):

```sh
mv ~/Downloads/apollo-*.csv data/apollo/workshop.csv
mv ~/Downloads/dataset_*.json data/apify/workshop.json
```

**Run** (left) `prompts/01-inspect-apify.md` (~1 min). **Say**: "The MCP reads the Actor's contract. It does not write anything."

**Collect Lane A**, then (right) the `diff` from prompt 2. **Say**: "The starter is what anyone would write on day one. The production skill is what it becomes after real failures."

**Run** (right) the authoritative preview:

```sh
npm run import:initial -- --apollo data/apollo/workshop.csv --semrush data/apify/workshop.json --dry-run
```

**Verify**: accepted / rejected / unenriched counts match your rehearsal notes in `preflight.md`. Read one rejection out loud (usually a missing or duplicate website).

**Say** (provenance, ~2 min), with one company on screen:
- *Observed*: organic traffic, straight from Semrush, with source and date.
- *Calculated*: its share of combined traffic, reproducible from stored values.
- *Inferred*: a battlecard claim, with confidence and evidence links, published only after a gate.
"Missing is never zero. An agent that blurs these layers produces confident nonsense."

**Run** Airtable (~6 min):
1. (left) `/mcp`, authenticate Airtable in the browser. **Say**: "OAuth lets *the agent* act as me, visibly and revocably. The deployed app never gets this. It gets its own token, scoped to one base."
2. Ask Claude: "Using the Airtable MCP, list the tables in the workshop base. Do not write."
3. **Approval gate**: say out loud "this mutates the base, I approve", then (right):

```sh
npm run airtable:schema
npm run import:initial -- --apollo data/apollo/workshop.csv --semrush data/apify/workshop.json
```

4. Ask Claude: "Using the Airtable MCP, count records in Companies, then show the Companies fields grouped by Observed / Calculated / Inferred. Do not write."

**Verify**: the Companies count equals the dry-run accepted count, and the schema command created exactly two tables, Companies and System. **Say**: "The field names carry the layer. Keywords and ads live inside the company row as JSON, so a refresh is one write per company."

**Run** (right) `npm run dev`, and leave it running: it warms up now so segment 6 has no dead air.

**Say**: "This base is our sandbox. Production reads a second base that the weekly job has been maintaining. You'll see that job run in a few minutes."

**Fallback**: Lane A not back by 24: show the canonical skill instead of the diff, and say so. OAuth or import fails twice: say so, point `AIRTABLE_BASE_ID` in `.env.local` at the showcase base, and verify counts the same way.

**Transition**: "Data is in. Now: what should a marketer see first?"

## 4. Design decision (33-42)

**Show** `workshop/design/option-a.html`, `option-b.html`, `option-c.html` (one minute each). For each, name the decision it optimizes for (see `design/README.md`).

**Run** a show of hands. Fill in the two `<!-- live -->` lines of `workshop/context/dashboard-brief.md`.

**Say**: "The skill holds rules that are true for every screen. The brief holds the decision for this one task. Mixing them is how skills rot."

**Run** (left) `prompts/03-dashboard-dispatch.md`. **Lane B starts** (collect at 58).

**Transition**: "While it works, let's make sure whatever it builds can go live safely."

## 5. Ship it (42-58)

**Say**: "Two runtimes, two sets of keys. The website only reads Airtable. The weekly refresh needs Apify too. If the website is ever compromised, the Apify key isn't there."

**Show** the credential table in `docs/operations/deployment.md`.

**Run** (right) the first three commands in `prompts/04-ship.md` (names only, then health). Do not deploy now: Lane B is still editing files, and a deploy uploads whatever is on disk.

**Verify**: `/api/health` returns `200`, `status: ok`, and freshness.

**Show** `.github/workflows/refresh.yml` and name four lines: `cron` (a clock owns the schedule), `timeout-minutes` (it must end), `concurrency` (never two at once), `refresh:report` (it leaves a readable result).

**Run** (right) `gh workflow run refresh.yml`. **Lane C starts** (collect at 72).

**Say**: "That was me pressing the button. The cron presses it every Monday. What if the thing pressing it could also tell us what went wrong?"

**Run** (left) `prompts/05-schedule-routine.md`: `/schedule`, then open claude.ai/code/routines and show the next run time. Make the three points in the prompt file.

**Fallback**: `/schedule` fails: show the paused routine created in preflight, and say so.

**Transition**: "Let's check what our agent built."

## 6. Inspect the build (58-70)

**Run**: read Lane B's return summary (10 lines, not a transcript). Then (right) `git diff --stat` and open the already-running dev server.

**Verify**, against `dashboard-brief.md` acceptance:
1. Side by side with the chosen option at 1440px.
2. Non-happy states: `npx vitest run tests/components` passes, including `state-matrix.test.tsx` (stale, partial, empty, error).
3. Open one company: Company Detail looks exactly as before.
4. Tab through the screen.

**Say**: "Without the brief, I'd be judging by vibes. With it, I'm checking a contract."

**Run** (right):

```sh
git add -A components styles workshop
git commit -m "feat: restyle All Companies (workshop choice)"
git push -u origin HEAD
vercel deploy --prod
```

**Lane D starts** (collect at 74). The live work sits on today's `workshop/live-*` branch, so `live-demo` stays the clean starting point. The push also gets a Vercel preview URL. **Say**: "Every branch gets its own preview. Production changes only when I say so."

**Fallback**: Lane B not back by 64: stop the agent, disclose, then (right) `git fetch origin workshop/fallback-ui-<x> && git checkout origin/workshop/fallback-ui-<x> -- components styles` and run the same checks. The commands above are in shell history from rehearsal; recall them rather than typing.

## 7. Proof (70-82)

**Say**: "Locally we've seen today's import. Production reads the showcase base, which this same weekly job has kept fresh. We just ran it by hand."

**Run** (right):

```sh
gh run list --workflow refresh.yml --limit 1   # completed? then:
gh run view --web "$(gh run list --workflow refresh.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

**Show** the run page: the **Refresh report** table (status, processed / succeeded / failed, cache invalidated, error codes) and the `refresh-report` annotation. **Say**: "That annotation is what the routine reads back on Thursday."

Ask Claude: "Using the Airtable MCP, show the System table's latest run ID, last attempt and last success. Do not write."

**Verify**:
- The run ID starts with `refresh-` and matches the dashboard's freshness panel on `$APP_URL` (allow up to 60 s for every server instance to reload).
- `curl -s "$APP_URL/api/health" | jq` shows `200` and the new freshness.
- The new UI is live on `$APP_URL`.

**Say**: "Deployed isn't the same as trustworthy. Health says it runs. Freshness says the data is current. The run ID says which job produced it."

**Fallback**: Lane C not done by 78: open the last scheduled run's page and `System` row, and say so. Lane D pending at 75: open the branch's preview URL, else the pre-deployed production URL.

## 8. Recap and replay (82-90, protected)

**Say**, walking back through the four outcomes:
1. Context: laws in `AGENTS.md`, judgment in skills, decisions in briefs, actions in tested CLIs, exploration through MCP.
2. Provenance: observed, calculated, inferred, labeled all the way to the UI.
3. Design-to-build: mockup, then brief, then a bounded agent packet, then checked against acceptance.
4. Shipping: OAuth for the agent, scoped secrets for the app, a scheduled job that must terminate, an agent on a schedule that holds one narrow key, health plus freshness as proof.

**Show** `workshop/README.md`: the repository, the `fallback-ui-<x>` diffs, and how to replay with your own Apollo list.

Q&A for the remaining time.
