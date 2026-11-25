# Run of show (90 minutes)

Single source of truth for workshop timing. `speaker-script.md` follows these segments one to one.

**Format**: instructor-led live demo for prospective Le Wagon students. Attendees watch; they replay later from this repository and the recording.

**Promise**: in 90 minutes, go from a list of competitors to a deployed, self-refreshing competitor-intelligence dashboard, and understand how the context you give a coding agent decides the quality of what it builds.

## Learning outcomes

By the end, attendees can explain:

1. **Context engineering**: what belongs in `CLAUDE.md`/`AGENTS.md`, a skill, an agent definition, an MCP connection, or a tested CLI command.
2. **Data provenance**: why raw provider data, deterministic calculations, and agent inference stay separate, all the way to the UI label.
3. **Design-to-build**: how a chosen mockup becomes a compact brief that a coding agent can build against and be checked against.
4. **Shipping**: why agent OAuth differs from app runtime secrets, and how deploys, schedules, and health checks make a result trustworthy.

## Rule: never wait in the foreground

Every slow step starts in a background lane and is collected later. If a lane is not back at its collect time, use the disclosed fallback and keep teaching.

Screen layout: two terminal panes. Claude Code on the left (it runs the agent lanes), a plain shell on the right (commands, the dev server, deploys).

| Lane | What runs | Starts | Collect by | Fallback at |
|-|-|-|-|-|
| A | Background subagent refines the data-join starter skill | 13 | 22 | 24: show the canonical skill, skip the diff |
| B | `dashboard-builder` subagent applies the chosen design | 41 | 58 | 64: restore files from `workshop/fallback-ui-<x>` |
| C | GitHub Actions refresh: live Apify run for ~10 companies | 52 | 72 | 78: show the last scheduled run's page + `System` row |
| D | Vercel production deploy of the new UI (right pane) | 68 | 74 | 75: open the branch's preview URL, else the pre-deployed production URL |

## Timeline

| Time | Segment | Outcome | What happens on screen |
|-|-|-|-|
| 00-05 | 1. Reveal | Shipping | The finished deployed app: All Companies, a company, Battlecard, a claim to its Evidence, freshness badge. "By minute 80 we'll have rebuilt and redeployed this." |
| 05-13 | 2. Context anatomy | Context | `CLAUDE.md` to `AGENTS.md` (iron laws), one skill (name, `SKILL.md`, reference: 3 disclosure levels), one agent definition, `/mcp`, `npm run` commands, tests. Rule: **MCP to explore, tested CLI to change data.** |
| 13-33 | 3. Data provenance | Provenance, Context | **Start Lane A.** Live exports: the prepared ~10-company Apollo Saved list to CSV, the prepared Apify run's dataset to JSON, moved into the git-ignored `data/` folders. Apify MCP: inspect the Actor's input/output contract. Collect Lane A: diff against the canonical skill. `import:initial --dry-run`: counts + one rejected company. One metric shown three ways: observed, calculated, inferred. Airtable MCP OAuth live; inspect the empty base; OAuth vs PAT; approval gate; `airtable:schema` + live import; confirm counts through MCP. Start `npm run dev` (right pane). "This base is our sandbox; production reads the one the weekly job maintains." |
| 33-42 | 4. Design decision | Design-to-build | Three pre-generated All Companies directions. The room votes. Record the decision in the UI brief. **Start Lane B.** |
| 42-58 | 5. Ship it | Shipping, Context | Credential boundary: web (Vercel) vs refresh (Actions). Names on screen, values never. Health check on production. Walk `refresh.yml`: schedule, timeout, concurrency, report. **Start Lane C** with `gh workflow run`. Schedule a Claude routine that triggers the same workflow and explains its result. |
| 58-70 | 6. Inspect the build | Design-to-build | Collect Lane B: diff summary, side by side with the chosen mockup, component tests incl. the state matrix, Company Detail unchanged, keyboard pass. Commit + push. **Start Lane D.** |
| 70-82 | 7. Proof | Shipping, Provenance | Collect Lane C: the run page's report table, new `System` row via Airtable MCP, freshness changed on production, `/api/health` 200. Collect Lane D: new UI live. |
| 82-90 | 8. Recap + replay | All | Map each step back to a context boundary. How to replay with the repo. Q&A. **Protected: never consumed by overruns.** |

Segments may borrow up to two minutes from a neighbour, never from segment 8.

## Disclosed fallbacks

Every fallback goes through the same validation path as the live step, and the instructor says out loud that it is being used.

| Trigger | Fallback | Resume |
|-|-|-|
| Lane A not back by 24 | Show `.agents/skills/competitor-data-contracts/SKILL.md` directly | Same `import:initial --dry-run` |
| Apollo or Apify export fails | Rehearsal copies kept outside the repo | Same `import:initial --dry-run` |
| Airtable OAuth or import fails twice | Showcase base (point `.env.local` at it) | Verify counts via MCP, continue to segment 4 |
| `/schedule` fails | The routine pre-created in preflight (paused) | Same three talking points |
| Lane B not back by 64 | `workshop/fallback-ui-<x>` branch | Same inspection checklist |
| Lane C not finished by 78 | Last scheduled run's page + `System` row | Same proof checklist |
| Lane D pending at 75 | The branch's Vercel preview URL, else the pre-deployed production URL | Same proof checklist |
| Any live step reveals a secret risk | Stop sharing the screen, rotate after the session | Resume at the next segment |
