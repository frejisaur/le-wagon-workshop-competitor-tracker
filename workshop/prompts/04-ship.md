# Prompt 4 - Ship it (segment 5)

Values are already stored off screen (see `preflight.md`). On stage, only names appear. Run these in the right-hand shell pane: Lane B is working in the Claude Code pane and owns the working tree, so nothing here deploys it.

```sh
vercel env ls production                       # names only: Airtable + CACHE_INVALIDATION_SECRET
gh secret list && gh variable list             # names only: refresh side
curl -s "$APP_URL/api/health" | jq             # 200, status ok, freshness
gh workflow run refresh.yml                    # starts Lane C
gh run list --workflow refresh.yml --limit 1   # show it is queued/running, then move on
```

Optional Claude prompt to narrate the boundary (only if Lane B has already returned; otherwise narrate it yourself):

```text
Read .github/workflows/refresh.yml and docs/operations/deployment.md. In 5 bullets,
explain which credentials the web app has, which only the refresh has, and why.
Do not run any command and do not read .env files.
```
