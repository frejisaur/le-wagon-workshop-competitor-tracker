# Workshop: build a competitor tracker with a coding agent

A 90-minute live demo for prospective Le Wagon students. In it, Claude Code turns an Apollo company list and Semrush data (through Apify) into a deployed, self-refreshing competitor-intelligence dashboard. Along the way it shows that **the context you give an agent decides the quality of what it builds**.

## Present the workshop

Open [the interactive workshop guide](guide.html) directly in your browser. Choose a chapter from the agenda and use **Presenter controls** for the clock, lane checkpoints, and rehearsal reset. The examples work offline. Live commands run in your terminal. Keep the guide in the clone to follow its source and full-size mockup links.

After editing the workshop material or the files in `workshop/guide-source/`, run `npm run workshop:guide` from the repository root to regenerate the page.

## What you'll learn

1. **Context engineering**: what belongs in `AGENTS.md`, a skill, an agent definition, a task brief, an MCP connection, or a tested command.
2. **Data provenance**: observed provider data, reproducible calculations, and agent inference stay separate all the way to the UI.
3. **Design-to-build**: a chosen mockup becomes a brief, then a bounded agent task, then a checked result.
4. **Shipping**: OAuth for the agent vs scoped secrets for the app, a scheduled job that always ends, and health + freshness as proof.

## Files

| File | For |
|-|-|
| [run-of-show.md](run-of-show.md) | Timeline, background lanes, fallbacks |
| [speaker-script.md](speaker-script.md) | What to say, show, run and verify in each segment |
| [preflight.md](preflight.md) | Accounts, setup, rehearsal, day-of checklist |
| [prompts/](prompts/) | Paste-ready Claude Code prompts |
| [starters/](starters/) | The thin skill that is improved live |
| [context/dashboard-brief.md](context/dashboard-brief.md) | The task brief filled in live |
| [design/](design/) | Three All Companies directions + the Company Detail reference |

## Stack (all free tiers)

Next.js on **Vercel**, **Airtable** as the data store, **Apify** for Semrush data, **GitHub Actions** for CI and the weekly refresh, and an optional **Claude routine** that triggers the same refresh on its own cadence and explains the result. The stack is free except the routine, which needs a Claude plan with Claude Code on the web. See [deployment](../docs/operations/deployment.md).

## Replay it yourself

1. Fork and clone the repository, then run `npm ci && npm test`. Everything runs offline against fixtures first ([workshop runbook](../docs/operations/workshop-runbook.md)).
2. Follow [speaker-script.md](speaker-script.md) with your own data. Every command in it is real.
3. See exactly what the agent changed live in the design-to-build step:

   ```sh
   git fetch origin workshop/fallback-ui-<x>
   git diff main origin/workshop/fallback-ui-<x> --stat
   ```

4. To deploy your own copy with your own Apollo list, paste the onboarding prompt from the [repository README](../README.md) into Claude Code.
