# Weekly Apollo enrichment

Claude Code owns the Monday 15:00 UTC schedule (`0 15 * * 1`). Apify MCP starts the Actor. GitHub Actions consumes its completed runs and Vercel serves the saved Airtable values. This project creates no Apify schedule.

## Configure a pilot and a production target

Use the tracker's existing production base or create **Competitor Intelligence**. Create a separate pilot base. In the Airtable Developer Hub, select one base per token. Use a Creator account and a setup PAT with `schema.bases:read` and `schema.bases:write`. For imports and attachments use a base-scoped record reader/writer. [Airtable token setup](https://support.airtable.com/articles/9934989703-creating-personal-access-tokens)

| Setting | GitHub Actions environments `pilot` and `production` | Vercel Preview and Production |
|---|---|---|
| `AIRTABLE_BASE_ID` | Variable for that environment's base | Matching base |
| `AIRTABLE_PAT` | Secret with record read/write access | Sensitive server variable with record read access |
| `CACHE_INVALIDATION_SECRET` | Environment secret | Matching server secret |
| `APP_BASE_URL` | HTTPS origin for that deployment | — |
| `APIFY_TOKEN` | Secret with read access to the Actor, runs, input and datasets | — |

Vercel must not receive `APIFY_TOKEN`, `APIFY_ACTOR_ID` or `APP_BASE_URL`. The workflow supplies the fixed Actor ID. Configure target-specific credentials in the GitHub environments. Repository-level fallback credentials could direct a pilot at production.

Check **present/missing** by name using `gh secret list --env pilot`, `gh variable list --env pilot --json name` and `vercel env ls`. Use stdin or protected forms for values. Link Vercel to this repo, select Next.js on Node 22 and the `live-demo` production branch. Deploy Preview with the pilot configuration and Production with the production configuration. The release gate includes build, tests, types and the schema-reference check. The routine and runner need access to their target dashboard origin. The signed cache endpoint and the dashboard's 60-second snapshot lifetime handle separate server instances.

## Seed each base

1. Set the target base ID and setup PAT in the ignored local environment. Run `npm run airtable:schema` twice. The second report must show zero created tables and fields. The two tables are Companies and System.
2. Use the record-write PAT for the next commands. For the pilot use a one-company CSV with the original headers and its corresponding Semrush record. For production use the complete original files. Inspect the dry run first, including rejections and unmatched rows. Use the known export time for a static file.
3. Save the original CSV on the System row. It retains columns and rejected rows that do not belong on a Companies row. The two System attachment fields each hold a CSV up to 5 MB. They are accessible to members of the Airtable base. The dashboard API exposes curated metrics.

```sh
npm run import:initial -- --apollo "$APOLLO_CSV" --semrush "$SEMRUSH_JSON" --observed-at "$OBSERVED_AT" --dry-run
npm run import:initial -- --apollo "$APOLLO_CSV" --semrush "$SEMRUSH_JSON" --observed-at "$OBSERVED_AT"
npm run apollo -- save-roster "$APOLLO_CSV"
```

The supplied full roster should yield 52 accepted companies, one missing website, zero unmatched domains and zero write failures. Copy the authenticated Airtable cell URL for **Refresh • Enriched CSV** from the System record into the matching Claude environment as `CSV_CELL_URL`. This link points to the downloadable attachment as it is replaced each week.

## Connect and run the pilot

In Claude's Customize → Connectors, add and authorize the Apify MCP endpoint below. Include the connector in the Claude Code cloud task. Configure `APP_BASE_URL`, `CSV_CELL_URL`, `GITHUB_REPOSITORY` and `GITHUB_DISPATCH_TOKEN` in its environment. The repository-scoped GitHub token needs Actions read/write and Checks read to retrieve the summary annotation. Set `REFRESH_REF` when testing a pilot branch. Allow access to GitHub, the package registry and the target dashboard. [Apify MCP endpoint](https://mcp.apify.com/?tools=actors,docs,pro100chok/semrush-scraper) · [Claude connector authentication](https://docs.apify.com/integrations/claude-ai)

Run the `enrich-apollo-accounts` skill once with target `pilot`. Confirm Actor visibility and exactly one normalized domain before submission. The command `npm run apollo -- prepare` obtains the seeded domains from the dashboard. Claude submits Domain Overview with the worldwide database, Moz disabled and concurrency 5. The 52-domain production roster fits the 100-domain limit. [Actor input specification](https://apify.com/pro100chok/semrush-scraper/input-schema)

On completion, Claude runs `npm run refresh:dispatch -- pilot RUN_ID`. The serialized workflow runs `npm run enrich -- --run-ids "$RUN_IDS"` with a 14-minute internal deadline for provider work. It checks Actor identity, terminal status, original input and domain partition before using the dataset. Each accepted observation gets the Actor finish time and a reference to its exact dataset item. The System refresh ID is `apify-` followed by the sorted run IDs.

Before replacing the CSV, the export verifies the dashboard count, successful refresh timestamp and a saved company’s authority, organic traffic and observation time through the deployed API. Compare the pilot's `authority_score`, `organic_traffic` and run `finishedAt` with the corresponding Companies fields, the company dashboard's metrics and enrichment time, and the CSV. Check `/api/companies/<companyId>` for the full timestamp. Confirm that the Preview dashboard has the pilot's company ID and count, and that its status and last successful refresh time match System.

## Activate and recover

After the pilot passes, seed the full production base and run the skill with target `production`. Confirm 52 Companies, 53 CSV data rows, the missing-website reason, and matching dashboard freshness. In Claude Code create the cloud routine for Monday at 15:00 **UTC**, with the production connector, environment and repository. Use the prompt below. Verify its next occurrence in Claude and deploy the dispatch-only workflow to the default branch before that occurrence. During migration the old default-branch revision may still have its Monday cron.

> Use the enrich-apollo-accounts skill to refresh the production roster. Report company counts, dashboard freshness, Actor run links, the workflow link and the private CSV cell link.

A partial refresh keeps successful writes and leaves each failed company's previous metrics and observation time in place. Inspect the System row and job error codes. Retry using the original run IDs. A failed export leaves the earlier CSV available and fails the workflow. After confirming the current successful System run, the isolated export command is `npm run apollo -- export RUN_ID1,RUN_ID2`. The workflow writes the full CSV only to Airtable. Keep attachment download URLs and original Apollo columns out of public logs.

To export a saved snapshot locally use `npm run apollo -- export INPUT.csv OUTPUT.csv` with a read-only Airtable token. An optional snapshot path after the output path selects a local fixture snapshot. Fixtures and the prepared battlecard path remain available for offline workshops.
