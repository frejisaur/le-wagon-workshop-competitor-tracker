# Plan: two-table Airtable model (Companies + System)

Status: planned, not started. Delete this file when the refactor merges.

## Why

The workshop only ever shows Companies and System, but the base has six tables, and their only purpose is storage layout. Collapsing to two removes a concept the audience never needs, makes every refresh a single write per company (no half-written company spread across child tables), and drops the base from about 150 records to about 11, so Airtable's 1,000-record free limit stops mattering.

## Target model

| Table | Rows | Holds |
|-|-|-|
| Companies | One per competitor | Identity, Apollo roster fields, observed/calculated metrics (unchanged), keywords and paid ads as JSON, the published battlecard, the pending review candidate |
| System | One | Refresh and agent run state (unchanged) |

New Companies fields (names keep the provenance prefix, which is the on-stage teaching point):

| Field | Type | Content |
|-|-|-|
| `Observed • Keywords JSON` | long text | `CuratedKeyword[]`, ordered by traffic, capped |
| `Observed • Keywords At` | text | Observation time of that snapshot |
| `Observed • Paid Ads JSON` | long text | `CuratedPaidAd[]` with first/last observed dates, capped |
| `Inferred • Battlecard JSON` | long text | The published insight (themes, claims, recommendations, summaries, confidence) |
| `Workflow • Battlecard …` | text | Harness, model, skill version, evidence fingerprint, workflow version, run ID, generated at |
| `Review • Candidate JSON` | long text | The pending candidate and its review reasons |
| `Review • Status`, `Review • Identity`, `Review • At`, `Review • Notes` | text / long text | Human review state, edited in Airtable |

Rules:
- JSON stores validated domain types, never raw provider objects or Airtable field-name keys. It is parsed with the existing zod schemas on read. A field that fails to parse marks that company with a data-quality issue and renders as missing; it never crashes the snapshot and is never read as zero.
- Caps: keep the existing `JSON_CAPS`/`boundedJson` approach. Set keyword and ad caps so the serialized field stays under 90,000 characters (Airtable's limit is 100,000), and record truncation as a data-quality issue with retained/original counts, as claims already do.
- Evidence references (`evidenceRefs`) keep pointing at keyword and paid-ad IDs inside the JSON, so claim-to-evidence tracing is unchanged in the UI.
- Table names become fixed constants. Remove the six `AIRTABLE_*_TABLE` environment variables everywhere.

## Steps (TDD, one commit each)

1. **Domain row type and codec.** Add `lib/airtable/company-row.ts`: `CompanyRow` (record ID, scalar fields, parsed keywords, paid ads, battlecard, review) plus `toCompanyFields`/`parseCompanyRecord`. Tests: round trip, caps and truncation issue, malformed JSON becomes a data-quality issue, missing stays missing.
2. **Schema.** `lib/airtable/schema.ts`: two tables; the new Companies fields; drop link fields. Update `tests/airtable/schema-bootstrap.test.ts`. Delete `record-budget.ts` and its test (two rows per company cannot approach the limit; replace with one assertion in the schema test if useful).
3. **Repository port.** Change `CompetitorStore`:
   - `DashboardSnapshot` becomes `{companies: CompanyRow[]; system: SystemRecord | null}`.
   - `replaceKeywords`, `replacePaidAds` and `upsertPaidAds` collapse into one `writeCompanyEvidence(companyId, {keywords, paidAds})` that merges paid-ad first/last-observed history in memory and issues one PATCH.
   - `upsertReview` and `upsertPublishedInsight` write fields on the company row.
   - Apply this to both `repository.ts` and `fixture-repository.ts`, and port `tests/airtable/*` (`paid-ad-replacement.test.ts` becomes a merge test on the codec).
4. **Workflows.** `lib/workflows/enrich.ts` and `import-initial.ts` use the new port. A company refresh is one write, so the partial-failure path simplifies: a company either has its new evidence or keeps the previous snapshot.
5. **Agents.** `lib/agents/{evidence/build-package,manifests/prepare,publication/submit,publication/publish-approved}.ts` read and write battlecard and review state on `CompanyRow` instead of separate records.
6. **API shaping.** `lib/api/shape-company.ts` and `dashboard-service-core.ts` consume `CompanyRow`. The response types in `lib/domain/dashboard.ts` stay unchanged, so components and their tests should not change. If one must change, stop and review why.
7. **Env and jobs.** `lib/config/server-env.ts` drops the table names; `jobs/setup-airtable-schema.ts` drops its name check; `jobs/enrich.ts` stops passing them; `.github/workflows/refresh.yml`, `.env.example`, `tests/config/*` follow.
8. **Fixtures.** Regenerate `tests/fixtures/airtable/*.json`, `tests/fixtures/import/*.json` and `tests/fixtures/insights/*.json` in the two-table shape. Keep them sanitized, with no real company data.
9. **Context.** Update `competitor-data-contracts/references/data-contract.md`, the battlecard and operating skills, `AGENTS.md`, `docs/operations/deployment.md` (credential table shrinks to 3 web / 6 refresh entries), and the workshop files (preflight secrets, speaker script MCP prompts: "show the Companies fields grouped by Observed / Calculated / Inferred").
10. **Product spec.** Fold the rules from `gtm-competitor-intelligence-design.md` that skills still need into the skill references, then delete it, so the demo branch has one source of truth per topic.

## Verification

- `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e`, `node scripts/verify-semrush-schema-reference.mjs`.
- Fixture rehearsal: `npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json` reports the same counts as before the refactor.
- Live, with approval: rebuild the workshop and showcase bases with `npm run airtable:schema`, import, refresh once through Actions, and confirm the app, the battlecard evidence trace and the freshness badge.
- Visual pass of All Companies and Company Detail at 1440px and 375px: no change is expected.

## Open decisions

- **Default branch.** Scheduled workflows and `workflow_dispatch` only run workflows that exist on the repository's default branch, Vercel deploys production from its production branch, and `npm run refresh:dispatch` defaults to `main`. Either merge this branch into `main` before the workshop, or make `live-demo` the GitHub default branch and the Vercel production branch and set `REFRESH_REF=live-demo` for the routine.
- **Battlecard history.** The current model keeps only the latest published insight and the latest candidate. That stays true; say so if history is wanted, because it would need its own table again.
