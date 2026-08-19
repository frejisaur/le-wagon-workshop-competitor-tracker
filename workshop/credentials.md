# Workshop credentials and authorizations

Use a disposable Airtable base, bounded Apify access, and a dedicated Railway project. Agent authorization and application secrets are different: OAuth lets Claude operate a tool; runtime credentials belong only in protected local or Railway variable entry. Never project a secret-entry window or paste a secret into chat, Git, screenshots, commands, or MCP configuration.

## Apollo export

### Create
In Apollo, open **Companies → Saved**, apply the prepared list/filter, select accounts, and choose **Export**. In CSV settings include Company Name, Website, Apollo Account ID, Apollo Record ID, segment/stage, employees, industry, and country. Export order may differ from the displayed sort.

### Store
Save the CSV outside Git, then copy only the sanitized workshop fixture into the repository.

### Verify
Confirm the header and row count locally without projecting company rows.

### Rotate
Generate a fresh export if the saved list or workshop date changes.

### Revoke
Delete the local raw export after the retention window.

## Airtable MCP and runtime PAT

### Create
Add the remote MCP with `claude mcp add --transport http airtable https://mcp.airtable.com/mcp`, open `/mcp`, authenticate in the browser, and limit authorization to the disposable workshop base. Separately create a PAT named `competitor-workshop-runtime`, scoped only to that base with `data.records:read`, `data.records:write`, `schema.bases:read`, and `schema.bases:write`.

### Store
Copy the PAT once into a non-projected `.env.local`/Railway secret-entry window. Never put it in the MCP command.

### Verify
Use MCP to list the disposable base and repository preflight to report only present/missing. Test the runtime via the schema/import command, never by printing the value.

### Rotate
Create a new PAT, store it, deploy, verify health and refresh, then revoke the old PAT.

### Revoke
After the workshop, delete or regenerate the PAT and revoke the Airtable OAuth grant if it is no longer needed.

## Apify plugin and runtime token

### Create
In Claude Code: `/plugins` → **Marketplaces** → **Add Marketplace** → `https://github.com/apify/apify-claude-code-plugin`; install `apify`; run `/reload-plugins`; open `/mcp`; enable and authenticate `plugin:apify:apify`. Separately create one described, expiring runtime token in Apify Console **API & Integrations**, limited to the required task/storage permissions where supported.

### Store
Set only `APIFY_TOKEN` in protected local/Railway storage. Keep `APIFY_ACTOR_ID` as configuration, not a credential.

### Verify
Inspect the actor/input through MCP and run only the bounded sample with operator approval.

### Rotate
Create new → store new → deploy → verify health/refresh → revoke old.

### Revoke
Delete the workshop token and disconnect the plugin authorization when finished.

## Railway CLI and MCP

### Create
Run `railway login`, then `railway mcp install --agent claude-code --remote --oauth`. Open `/mcp`, complete browser authentication, and link only the prepared workshop project.

### Store
Enter application variables through a non-projected Railway variable window. Sealed variables cannot be read back or copied into duplicated services/environments, so record the rotation procedure—not their values.

### Verify
Inspect project/service names with MCP, review variables as present/missing, use `railway up` only after approval, confirm web health, and confirm the cron schedule.

### Rotate
Create new → store new → deploy → verify health/refresh → revoke old.

### Revoke
Revoke OAuth/logout after the workshop and remove disposable project access.

## Official references

- [Airtable personal access tokens](https://support.airtable.com/docs/creating-and-using-api-keys-and-access-tokens)
- [Airtable MCP](https://support.airtable.com/docs/airtable-mcp-server)
- [Apify API integrations](https://docs.apify.com/platform/integrations/api)
- [Railway CLI login](https://docs.railway.com/guides/cli)
- [Railway MCP server](https://docs.railway.com/reference/mcp-server)
- [Railway variables](https://docs.railway.com/guides/variables)
