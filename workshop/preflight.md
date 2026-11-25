# Preflight

Everything here happens off stage. Nothing in this file is shown to the audience except the present/missing check.

## Accounts (all free tiers)

| Service | Plan | Used for |
|-|-|-|
| GitHub | Free, public repository | Code, CI, weekly refresh (Actions minutes are free for public repos) |
| Vercel | Hobby | Web hosting (non-commercial use; use Pro if Le Wagon treats the workshop as commercial) |
| Airtable | Free | Serving layer (two tables: one Companies row per company plus one System row, so the ~10-company roster uses about 11 of the 1,000-record limit) |
| Apify | Free monthly credit | `pro100chok/semrush-scraper` runs |
| Apollo | Free | Saved company list and CSV export (free plans have limited export credits: check the balance) |
| Claude | Plan with Claude Code on the web | The scheduled routine in segment 5 |

## Tools

```sh
node -v                 # 22.x
npm i -g vercel         # Vercel CLI
gh --version && claude --version && jq --version
vercel login && gh auth login
```

## A week before

1. Build the ~10-company Apollo Saved list. Note the companies with no website (they show up as a rejection, which is useful on stage). Export it once and note the downloaded file name; adjust the `mv` line in segment 3 of the speaker script if it differs.
2. Run the Apify Actor once for the same domains and keep the run. You export its dataset live in segment 3; note the downloaded file name too.
3. Create two Airtable bases:
   - **showcase**: schema + import already applied. Production and the weekly refresh use it, so it has real history. It is also the Airtable fallback.
   - **workshop**: emptied before each session. Segment 3 imports into it live, and `npm run dev` in segment 6 reads it through `.env.local`.

    Create one PAT per base with `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`.
4. Deploy production once, following `docs/operations/deployment.md`, against the showcase base. This is the reveal app and the deploy fallback. Set `APP_URL` in your shell profile.
5. Configure target-specific GitHub environments and Vercel credentials using [the deployment runbook](../docs/operations/deployment.md).
6. Connect the Apify MCP connector to the pilot cloud task. Run the one-company pilot with the weekly skill, keeping its run ID, and compare its numbers across the Actor, Airtable, dashboard and CSV.
7. Rehearse the Monday schedule with the production prompt after verifying the full roster. Keep only one active production routine.
8. Full rehearsal with a stopwatch, using the same two-pane layout. Record in the table below. Build one fallback per design option, because the room may vote for any of them. For each `<x>` in `a`, `b`, `c`: run Lane B for that option, check it against the brief, then `git switch -c workshop/fallback-ui-<x> && git add -A components styles && git commit -m "feat: restyle All Companies (option <x>)" && git push -u origin HEAD && git switch live-demo`.

## Rehearsal notes (fill in, do not commit real company names)

| Measure | Rehearsal 1 | Rehearsal 2 |
|-|-|-|
| Dry run: accepted / rejected / unenriched | | |
| Lane A (skill refine) duration | | |
| Lane B (dashboard build) duration | | |
| Lane C (refresh) duration | | |
| Segment overruns | | |

If Lane C takes more than 15 minutes, shrink the roster. If Lane B overruns twice, narrow the brief, not the proof.

## The day before

- [ ] `npm ci && npm test && npm run build` pass on the presenting laptop.
- [ ] Point `AIRTABLE_BASE_ID` in `.env.local` at the **workshop** base and empty it: delete every table except one placeholder (Airtable requires a base to keep at least one), so the schema command has all six to create.
- [ ] In Claude Code, run `/mcp` and **log out of Airtable** so the OAuth flow happens live. Keep Apify and Vercel signed in.
- [ ] Confirm `workshop/fallback-ui-a`, `-b` and `-c` exist on the remote.
- [ ] Rotate any token that has appeared on a screen during rehearsal.

## One hour before

- [ ] Terminal: two panes, Claude Code on the left and a plain shell on the right. Font size 20+, a light theme, prompt trimmed to the folder name. Clear the scrollback, but keep the shell history from rehearsal (the commit and fallback commands are recalled, not typed).
- [ ] Close every window that could show a secret: `.env.local`, password manager, Vercel or GitHub settings pages.
- [ ] Browser tabs, in order: `$APP_URL`, Apollo Saved list, Apify run, Airtable workshop base, the three `workshop/design/option-*.html` files, the GitHub Actions tab, claude.ai/code/routines.
- [ ] Start from a clean `live-demo` on a dated branch: `git switch live-demo && git pull && git switch -c "workshop/live-$(date +%F)"`.
- [ ] Remove last rehearsal's exports from `data/apollo/` and `data/apify/`.
- [ ] Reset `workshop/context/dashboard-brief.md` (`git checkout -- workshop/context/dashboard-brief.md workshop/starters`).
- [ ] Secret-safe check (the only credential output that appears on screen). Locally you only need Airtable: the Apify side lives in Actions.

  ```sh
  for n in AIRTABLE_PAT AIRTABLE_BASE_ID; do
    grep -q "^$n=." .env.local && echo "$n present" || echo "$n missing"
  done
  vercel env ls production && gh secret list && gh variable list
  ```

- [ ] `curl -s "$APP_URL/api/health" | jq` returns `status: ok`.

## After the session

- Restore production to `live-demo`: `git switch live-demo && vercel deploy --prod`.
- Delete the routine created on stage (keep the paused fallback).
- Revoke the workshop PATs and the Apify token, or rotate them if the repository stays live.
- Keep or revoke the Airtable, Apify and Vercel MCP OAuth grants, as you intend.
