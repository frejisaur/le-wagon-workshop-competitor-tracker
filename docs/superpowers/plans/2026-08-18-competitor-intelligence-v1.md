# Competitor Intelligence Version 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the Version 1 competitor-intelligence prototype: import the Apollo roster, enrich it from Apify Semrush data, persist curated evidence in Airtable, generate and review evidence-backed battlecards, and serve the two approved dashboard screens.

**Architecture:** Use one TypeScript modular monolith. A Next.js App Router process serves the React dashboard and server-only API; command-line jobs import data, run the deterministic Railway refresh, prepare insight manifests, submit candidates, and publish approved reviews. All entry points share Zod provider/domain schemas, pure transforms, stable identity and fingerprint helpers, an Airtable repository, and an in-memory dashboard cache; raw provider objects never cross those boundaries.

**Tech Stack:** Node.js 22 LTS, TypeScript, Next.js App Router, React, Zod, `@carbon/react`, `@carbon/styles`, `@carbon/charts-react`, Airtable Web API through server-only `fetch`, Apify REST API through server-only `fetch`, Vitest, Testing Library, MSW, Playwright, and Railway.

**Spec:** `gtm-competitor-intelligence-design.md` and `gtm-competitor-intelligence-design-system.md`

## Global Constraints

- Version 1 imports the supplied Apollo list, enriches Domain Overview data, uses Airtable as the editable serving layer, generates one evidence-backed battlecard per company, and exposes freshness and workflow status.
- Version 1 excludes full-page crawling, authentication, multi-tenancy, Postgres, Redis, queues, persistent volumes, real-time refresh, account discovery, and opaque composite scores.
- Join Apollo `Website` to Apify `domain` through the shared normalizer; never join by company name.
- Preserve observed provider values, deterministic calculations, and agent inference in separate schema fields and UI treatments.
- Preserve provider backlink totals independently; do not force follow plus nofollow to equal total.
- Label keyword rows as an `observed sample`; hide zero-value AI countries by default; retain unknown SERP codes without labels; retain original Moz strings alongside parsed values.
- Missing provider data is absent and displays as `Not available`; it is never converted to zero.
- Keep the sample below 1,000 Airtable records and target fewer than 1,000 Airtable API calls per workspace per month through batched reads and writes.
- Browser code receives no Airtable, Apify, cache-signing, model, authorization-header, or raw-provider-payload values.
- Railway owns only deterministic collection and transformation. The agent harness owns semantic enrichment and requires no model token in Railway.
- The Railway schedule is `0 15 * * 1` (Mondays at 15:00 UTC), and its task timeout must be shorter than the schedule interval.
- Preserve the last published insight and the last successful dashboard cache until a current replacement passes every gate.
- Submission identity is company + agent-evidence fingerprint + skill version + workflow version; retries must not create duplicates.
- Automatic publication requires a valid current fingerprint, resolved evidence, no review reason, and overall `high` confidence. Every other valid candidate enters the reusable company review row.
- External provider text, reviewer notes, page content, and URLs are untrusted data, never instructions or executable markup.
- Carbon is the only component-system dependency; Version 1 is light-first; investigation blue (`#245EB5`) is the only interface accent.
- Support desktop (`>= 1280px`), tablet (`768-1279px`), and mobile (`< 768px`), WCAG AA, visible focus, keyboard operation, reduced motion, semantic landmarks, and accessible chart alternatives.
- Keep the sanitized fixture and pre-generated high- and low-confidence candidates operational for workshop recovery.
- Write the narrow failing test before each behavior change, then run the complete relevant suite.

## Milestones and Dependency Order

1. **Foundation:** Tasks 1-5 establish executable contracts, fixtures, deterministic transforms, and Airtable persistence.
2. **Working data pipeline:** Tasks 6-9 make initial import, insight lifecycle, and weekly metric refresh runnable and retry-safe.
3. **Working product:** Tasks 10-15 expose shaped APIs and implement the approved dashboard, evidence trace, and failure states.
4. **Workshop-ready deployment:** Task 16 validates Railway configuration, fallbacks, security, and the complete demo journey.

## File and Module Map

```text
app/
  api/dashboard/route.ts                # portfolio response
  api/companies/[companyId]/route.ts    # company workspace response
  api/health/route.ts                   # cache and workflow freshness
  api/internal/cache/route.ts           # signed invalidation
  companies/[companyId]/page.tsx        # company workspace route
  layout.tsx                            # theme, fonts, landmarks, shell
  page.tsx                              # landscape-led home
components/
  company/                              # KPI, research, battlecard, evidence views
  landscape/                            # filters, market map, signals, leaderboard
  shared/                               # shell, status, freshness, skeletons, errors
jobs/
  import-initial.ts                     # two-file roster import
  enrich.ts                             # Railway deterministic refresh
  prepare-insights.ts                   # bounded due-work manifest
  submit-insight.ts                     # validate and publish/queue one candidate
  publish-approved-insights.ts          # promote current approved reviews
lib/
  agents/                               # candidate, due-work, evidence, publication
  airtable/                             # wire mappings, client, repositories
  apify/                                # actor client, batch orchestration
  cache/                                # last-successful snapshot and invalidation
  config/                               # server environment validation
  domain/                               # classified domain and API types
  schemas/                              # raw provider and command-boundary schemas
  transforms/                           # normalization, calculations, provider transforms
  workflows/                            # import and refresh orchestration
styles/                                 # semantic tokens and application styles
tests/
  agents/ api/ components/ contracts/ e2e/ transforms/ workflows/
  fixtures/                             # sanitized source, states, candidate fallbacks
```

---

### Task 1: Executable Application and Test Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `lib/config/server-env.ts`
- Create: `tests/config/server-env.test.ts`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `getWebEnv(source?: NodeJS.ProcessEnv): WebEnv` for Airtable serving/cache values and `getRefreshEnv(source?: NodeJS.ProcessEnv): RefreshEnv` for Airtable, Apify, cache-invalidation, and application URL values. Insight commands require Airtable values but never Apify or model values.
- Produces: scripts `dev`, `build`, `start`, `test`, `test:watch`, `test:e2e`, `import:initial`, `enrich`, `insights:prepare`, `insights:submit`, and `insights:publish-approved`.

- [ ] **Step 1: Write the failing environment-boundary test**

```ts
import {describe, expect, it} from 'vitest';
import {getRefreshEnv, getWebEnv} from '@/lib/config/server-env';

describe('server environment scopes', () => {
  it('rejects missing refresh credentials without printing their values', () => {
    expect(() => getRefreshEnv({})).toThrow(/AIRTABLE_PAT, AIRTABLE_BASE_ID, APIFY_TOKEN/);
  });

  it('does not require Apify for the web serving process', () => {
    const env = getWebEnv({
      AIRTABLE_PAT: 'hidden', AIRTABLE_BASE_ID: 'app-test', APIFY_TOKEN: 'hidden',
      CACHE_INVALIDATION_SECRET: 'hidden', APP_BASE_URL: 'http://127.0.0.1:3000',
      AIRTABLE_COMPANIES_TABLE: 'Companies', AIRTABLE_KEYWORDS_TABLE: 'Keywords',
      AIRTABLE_PAID_ADS_TABLE: 'Paid Ads', AIRTABLE_GTM_INSIGHTS_TABLE: 'GTM Insights',
      AIRTABLE_INSIGHT_REVIEWS_TABLE: 'Insight Reviews', AIRTABLE_SYSTEM_TABLE: 'System',
    });
    expect(env.AIRTABLE_BASE_ID).toBe('app-test');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run: `npm test -- tests/config/server-env.test.ts`

Expected: FAIL because `@/lib/config/server-env` does not exist.

- [ ] **Step 3: Scaffold the application and implement strict server configuration**

Install runtime packages with `npm install next react react-dom zod @carbon/react @carbon/styles @carbon/charts-react @carbon/charts papaparse` and test packages with `npm install --save-dev typescript tsx vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @playwright/test @types/node @types/react @types/react-dom @types/papaparse eslint eslint-config-next`.

Implement a shared Airtable/table schema, then compose `WebEnvSchema`, `RefreshEnvSchema`, and `InsightEnvSchema` with only the values each control plane needs. Use `z.string().min(1)` for secrets/IDs/table names, `z.string().url()` for `APP_BASE_URL`, and an error formatter that reports field names only. Keep this module free of any `NEXT_PUBLIC_` variable. Add the listed scripts with job entry points executed by `tsx`; their entry files are created in the tasks that first invoke them.

- [ ] **Step 4: Run foundation checks**

Run: `npm test -- tests/config/server-env.test.ts && npm run build`

Expected: the environment tests pass and the minimal Next application builds without reading credentials at module load time.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts vitest.setup.ts playwright.config.ts app lib/config tests/config .env.example .gitignore
git commit -m "chore: scaffold competitor intelligence app"
```

### Task 2: Sanitized Fixtures and Provider Boundary Schemas

**Files:**
- Create: `lib/schemas/apollo.ts`
- Create: `lib/schemas/semrush.ts`
- Create: `tests/fixtures/providers/apollo-sample.csv`
- Create: `tests/fixtures/providers/semrush-sample.json`
- Create: `tests/fixtures/providers/semrush-invalid-subsection.json`
- Create: `tests/contracts/provider-schemas.test.ts`
- Modify: `tests/skills/generate-semrush-schema.test.mjs`

**Interfaces:**
- Produces: `ApolloRowSchema`, `SemrushDomainOverviewSchema`, `parseApolloCsv(text)`, and `parseSemrushPayload(value)`.
- Produces: sanitized fixtures containing fictitious `.example` domains and the known quality cases without provider secrets or raw workshop records.

- [ ] **Step 1: Write failing provider-contract tests**

```ts
it('accepts valid top-level metrics while isolating a malformed Moz subsection', () => {
  const result = parseSemrushPayload(loadJson('semrush-invalid-subsection.json'));
  expect(result.records[0].domain).toBe('alpha.example');
  expect(result.records[0].moz).toBeUndefined();
  expect(result.issues[0]).toMatchObject({domain: 'alpha.example', section: 'moz'});
});

it('rejects a non-array Semrush payload', () => {
  expect(() => parseSemrushPayload({domain: 'alpha.example'})).toThrow(/array/);
});

it('preserves Apollo source identifiers and a missing Website', () => {
  const [row] = parseApolloCsv('Company Name,Website,Apollo Account Id,Apollo Record Id\nAlpha,,acct-1,rec-1');
  expect(row).toMatchObject({'Company Name': 'Alpha', Website: '', 'Apollo Account Id': 'acct-1'});
});
```

- [ ] **Step 2: Verify failure, then build the schemas from the observed field inventory**

Run: `npm test -- tests/contracts/provider-schemas.test.ts`

Expected: FAIL because the parsers do not exist.

Implement strict top-level identity fields, null-aware numeric/string fields, and independently safe-parsed nested `authority`, `backlinks_detail`, `organic`, `paid`, `ai_search`, `serp_features`, and `moz` schemas. Return section issues rather than rejecting an otherwise usable company when only a nested module is malformed.

- [ ] **Step 3: Add the smallest complete sanitized cases**

The fixtures must cover: two matched domains, one Apollo row without a website, a self competitor, zero and nonzero AI countries, unequal backlink totals, `1.6k`, `3%`, a suspicious Moz top-page object, no paid ads, a paid ad, an unknown SERP code, 31 daily points, 25 monthly points, and a malformed nested module. Replace names, IDs, URLs, and prose with fictitious values; do not copy full raw records.

- [ ] **Step 4: Run contract and schema-drift checks**

Run: `npm test -- tests/contracts/provider-schemas.test.ts tests/skills/generate-semrush-schema.test.mjs && node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check data/apify/apollo-accounts-semrush-scraper.json .agents/skills/competitor-data-contracts/references/semrush-domain-overview-schema.md`

Expected: all tests pass and the observed schema reference is current.

- [ ] **Step 5: Commit the provider boundary**

```bash
git add lib/schemas tests/fixtures/providers tests/contracts tests/skills
git commit -m "feat: validate sanitized provider inputs"
```

### Task 3: Stable Identities, Domain Join, and Classified Domain Types

**Files:**
- Create: `lib/domain/classification.ts`
- Create: `lib/domain/company.ts`
- Create: `lib/transforms/normalize.ts`
- Create: `lib/transforms/join-roster.ts`
- Create: `tests/transforms/normalize.test.ts`
- Create: `tests/transforms/join-roster.test.ts`

**Interfaces:**
- Produces: `type Observed<T> = {kind:'observed'; value:T; source:'apollo'|'semrush'; observedAt:string; database?:string; rawRef?:string}`.
- Produces: `type Calculated<T> = {kind:'calculated'; value:T; inputs:string[]; calculatedAt:string}` and `type Inferred<T> = {kind:'inferred'; value:T; evidenceRefs:string[]; confidence:'high'|'medium'|'low'}`.
- Produces: `normalizeDomain(value: string): string | null` and `normalizeUrl(value: string): string | null`.
- Produces: `joinRoster(apolloRows, semrushRecords): JoinReport`, where `JoinReport` contains `accepted`, `rejections`, `unmatchedApollo`, and `apifyOnly` arrays.

- [ ] **Step 1: Write the normalization and identity tests**

```ts
it.each([
  ['HTTPS://WWW.Example.COM:443/path?q=1#x', 'example.com'],
  ['example.com.', 'example.com'],
  ['http://sub.example.com/a', 'sub.example.com'],
])('normalizes %s', (input, expected) => expect(normalizeDomain(input)).toBe(expected));

it('left-joins valid Apollo rows and reports every deterministic exception', () => {
  const report = joinRoster(apolloFixture, semrushFixture);
  expect(report.accepted).toHaveLength(2);
  expect(report.rejections).toContainEqual(expect.objectContaining({code: 'missing_apollo_website'}));
  expect(report.apifyOnly).toEqual([]);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/transforms/normalize.test.ts tests/transforms/join-roster.test.ts`

Expected: FAIL because shared normalization and join logic do not exist.

- [ ] **Step 3: Implement normalization, conflicts, and immutable-ID resolution inputs**

Use the URL parser with an added `https://` only for scheme-less input. Reject credentials, IP addresses, localhost, blank hostnames, and invalid public-looking hostnames. Normalize landing URLs by lowercasing hostname, removing fragments and default ports, and preserving path/query because they identify keyword/ad landing pages. The join must reject duplicate Apollo normalized domains, conflicting Apollo IDs, Apify-only domains, and conflicting duplicates with the same `(domain,database,observedAt)`; canonically identical duplicates collapse idempotently.

- [ ] **Step 4: Run focused and broader contract tests**

Run: `npm test -- tests/transforms tests/contracts`

Expected: all normalization, exception, and provider contract tests pass.

- [ ] **Step 5: Commit stable identity primitives**

```bash
git add lib/domain lib/transforms tests/transforms
git commit -m "feat: add stable competitor identities"
```

### Task 4: Pure Domain Overview Transformation and Calculations

**Files:**
- Create: `lib/domain/metrics.ts`
- Create: `lib/transforms/parse-provider-number.ts`
- Create: `lib/transforms/calculations.ts`
- Create: `lib/transforms/semrush-to-domain.ts`
- Create: `tests/transforms/calculations.test.ts`
- Create: `tests/transforms/semrush-to-domain.test.ts`

**Interfaces:**
- Produces: `parseCompactNumber(value): {raw:string|null; normalized:number|null}`.
- Produces: `calculateMovement(points, days)`, `calculateNonBrandShare(branded, nonBrand)`, `calculateBenchmarkGap(visibility, benchmark)`, `calculateTrackedSetShare(companyTraffic, totalTraffic)`, and `buildLandingPagePortfolio(keywords)` as pure functions.
- Produces: `transformSemrushCompany(input, context): CuratedCompanyEvidence`, `CuratedKeyword[]`, and `CuratedPaidAd[]` with observed/calculated classifications.

- [ ] **Step 1: Write failing data-quality tests**

```ts
it('keeps conflicting backlink totals independent', () => {
  const evidence = transformSemrushCompany(semrushFixture[0], context);
  expect(evidence.company.observed.backlinks).toBe(100);
  expect(evidence.company.observed.followBacklinks).toBe(60);
  expect(evidence.company.observed.noFollowBacklinks).toBe(30);
});

it('filters self competitors and zero AI countries without erasing raw meaning', () => {
  const evidence = transformSemrushCompany(semrushFixture[0], context);
  expect(evidence.company.observed.organicCompetitors.every((x) => x.domain !== 'alpha.example')).toBe(true);
  expect(evidence.company.observed.aiCountries).toEqual([{country: 'ca', mentions: 2, visibility: 1}]);
});

it('parses Moz display strings and retains their original form', () => {
  expect(parseCompactNumber('1.6k')).toEqual({raw: '1.6k', normalized: 1600});
  expect(parseCompactNumber('3%')).toEqual({raw: '3%', normalized: 0.03});
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/transforms/calculations.test.ts tests/transforms/semrush-to-domain.test.ts`

Expected: FAIL because the transformation functions are missing.

- [ ] **Step 3: Implement minimal pure calculations and curated projections**

Compute 30-day movement from daily points, 12-month movement from monthly points, non-brand share with a null result for a zero/absent denominator, AI benchmark gap, tracked-set traffic share, compact 24-month trends, normalized landing-page groups, keyword/ad identities, and paid-activity presence. Flag suspicious Moz top-page records and omit them from display projections. Preserve unknown SERP codes as strings/numbers in `rawSerpCodes`.

- [ ] **Step 4: Run the transform suite**

Run: `npm test -- tests/transforms`

Expected: all pure calculation, classification, malformed-section, and identity tests pass.

- [ ] **Step 5: Commit deterministic transformation**

```bash
git add lib/domain/metrics.ts lib/transforms tests/transforms
git commit -m "feat: transform semrush evidence deterministically"
```

### Task 5: Airtable Wire Mapping, Batched Repository, and Record Budget

**Files:**
- Create: `lib/airtable/types.ts`
- Create: `lib/airtable/mappers.ts`
- Create: `lib/airtable/client.ts`
- Create: `lib/airtable/repository.ts`
- Create: `lib/airtable/fixture-repository.ts`
- Create: `lib/airtable/record-budget.ts`
- Create: `tests/fixtures/airtable/base-snapshot.json`
- Create: `tests/airtable/mappers.test.ts`
- Create: `tests/airtable/repository.test.ts`
- Create: `tests/airtable/record-budget.test.ts`

**Interfaces:**
- Produces: `AirtableClient.list/create/update` with pagination, request timeouts, 429 retry-after handling, exponential backoff, jitter, and max attempts.
- Produces: `CompetitorRepository.resolveCompanyIdentity`, `upsertCompanies`, `replaceKeywords`, `upsertPaidAds`, `getDashboardSnapshot`, `getDueInsightInputs`, `upsertReview`, `upsertPublishedInsight`, and `updateSystem`.
- Produces: `CompetitorStore`, implemented by the production Airtable repository and an in-memory `FixtureCompetitorRepository.fromSnapshot(path)` used by tests, local workshop fallback, and `--fixture-state` job invocations.
- Produces: `estimateRecordBudget(counts): {total:number; withinFreeLimit:boolean}`.

- [ ] **Step 1: Write failing repository behavior tests with MSW**

```ts
it('batches Airtable writes in groups of ten and retries 429', async () => {
  const result = await repository.upsertCompanies(makeCompanies(11));
  expect(requestBodies.map((body) => body.records.length)).toEqual([10, 1]);
  expect(result).toMatchObject({succeeded: 11, failed: 0});
  expect(rateLimitedRequestCount).toBe(2);
});

it('reuses an existing company by Apollo Account ID before canonical domain', async () => {
  expect(await repository.resolveCompanyIdentity({apolloAccountId: 'acct-1', canonicalDomain: 'new.example'}))
    .toEqual({companyId: 'company-existing', source: 'apollo_account_id'});
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/airtable/repository.test.ts tests/airtable/mappers.test.ts`

Expected: FAIL because Airtable mappings and repository do not exist.

- [ ] **Step 3: Implement explicit table mappings and safe request behavior**

Map the six specified tables only. Store bounded nested summaries as JSON strings, never the raw 37 MB response. Escape Airtable formula values instead of interpolating unsanitized text. Redact authorization headers from thrown errors. Use deterministic local keys for companies, keywords, paid ads, insight submissions, and one company-linked review. For keyword replacement, write the complete new observation set first and remove obsolete identities only after every new record succeeds, making a retry converge safely. Return per-record success/failure results instead of discarding successful writes. The fixture repository loads sanitized JSON into memory and never rewrites its source file.

- [ ] **Step 4: Add and verify the sample budget assertion**

```ts
expect(estimateRecordBudget({companies: 52, keywords: 358, paidAds: 16, insights: 52, reviews: 52, system: 1}))
  .toEqual({total: 531, withinFreeLimit: true});
```

Run: `npm test -- tests/airtable`

Expected: mappings round-trip classified fields, retries are bounded, writes are batched, and the sample budget is 531.

- [ ] **Step 5: Commit persistence contracts**

```bash
git add lib/airtable tests/airtable tests/fixtures/airtable
git commit -m "feat: add idempotent airtable repository"
```

### Task 6: Idempotent Initial Two-File Import

**Files:**
- Create: `lib/workflows/import-initial.ts`
- Create: `jobs/import-initial.ts`
- Create: `tests/workflows/import-initial.test.ts`
- Create: `tests/fixtures/import/existing-identities.json`

**Interfaces:**
- Consumes: provider parsers, `joinRoster`, transforms, and `CompetitorRepository` from Tasks 2-5.
- Produces: `runInitialImport(options): Promise<ImportReport>` with `runId`, `accepted`, `unenriched`, `rejected`, `apifyOnly`, `succeeded`, `failed`, `recordBudget`, and per-company errors.

- [ ] **Step 1: Write the failing import retry test**

```ts
it('imports the fixture twice without changing company IDs or creating duplicates', async () => {
  const first = await runInitialImport(fixtureOptions(repository));
  const second = await runInitialImport(fixtureOptions(repository));
  expect(first.succeeded).toBe(2);
  expect(second.succeeded).toBe(2);
  expect(repository.companyIds()).toEqual(['company-alpha', 'company-beta']);
  expect(repository.counts()).toMatchObject({companies: 2, keywords: 3, paidAds: 1});
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/workflows/import-initial.test.ts`

Expected: FAIL because the import orchestrator does not exist.

- [ ] **Step 3: Implement the workflow and CLI boundary**

The CLI accepts `--apollo`, `--semrush`, and optional `--dry-run`. It validates both files independently, resolves company IDs in the documented order, transforms accepted records, calculates the record/API estimate before writes, stops before writes when the estimate reaches 1,000, writes in dependency order, and prints one JSON summary without raw rows or credentials. Unenriched valid Apollo companies are written with absent metric groups.

- [ ] **Step 4: Run the fixture dry run and workflow suite**

Run: `npm test -- tests/workflows/import-initial.test.ts && npm run import:initial -- --apollo tests/fixtures/providers/apollo-sample.csv --semrush tests/fixtures/providers/semrush-sample.json --dry-run`

Expected: tests pass; the command reports two accepted companies, one deterministic rejection, and zero external writes.

- [ ] **Step 5: Commit the import milestone**

```bash
git add lib/workflows/import-initial.ts jobs/import-initial.ts tests/workflows tests/fixtures/import package.json
git commit -m "feat: add retry-safe initial import"
```

### Task 7: Canonical Evidence Packages, Fingerprints, and Due-Work Preparation

**Files:**
- Create: `lib/agents/types.ts`
- Create: `lib/agents/evidence/build-package.ts`
- Create: `lib/agents/evidence/fingerprint.ts`
- Create: `lib/agents/manifests/select-due.ts`
- Create: `lib/agents/manifests/prepare.ts`
- Create: `jobs/prepare-insights.ts`
- Create: `tests/agents/fingerprint.test.ts`
- Create: `tests/agents/prepare.test.ts`

**Interfaces:**
- Produces: `EvidenceReference`, `PreparedCompany`, `PreparedManifest`, and `DueReason` (`never_generated`, `refresh_due`, `fingerprint_changed`, `skill_version_changed`, `reviewer_requested_regeneration`).
- Produces: `fingerprintEvidence(pkg): string` using canonical stable-key JSON and SHA-256.
- Produces: `prepareInsights({due, limit, companyId}): Promise<PreparedManifest>`; default and maximum `limit` is 10.

- [ ] **Step 1: Write fingerprint and due-selection tests**

```ts
it('is stable across object key order and excludes run metadata', () => {
  expect(fingerprintEvidence({...evidence, runId: 'a'})).toBe(fingerprintEvidence(reordered({...evidence, runId: 'b'})));
});

it.each([
  ['never generated', neverGenerated, 'never_generated'],
  ['changed evidence', changedFingerprint, 'fingerprint_changed'],
  ['new skill', changedSkill, 'skill_version_changed'],
  ['review request', regenerationRequested, 'reviewer_requested_regeneration'],
])('selects %s', (_label, input, reason) => expect(selectDue(input)).toContain(reason));

it('excludes unchanged companies and current active reviews', () => {
  expect(selectDue(unchanged)).toEqual([]);
  expect(selectDue(activeCurrentReview)).toEqual([]);
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/agents/fingerprint.test.ts tests/agents/prepare.test.ts`

Expected: FAIL because evidence packaging and due selection are missing.

- [ ] **Step 3: Implement the bounded manifest**

Build a package only from curated company, keyword, paid-ad, and published/review metadata. Give every evidence row a stable ref such as `company:company-alpha:metric:organic_traffic`, `keyword:<record-key>`, or `paid-ad:<record-key>`. Include source, database, observation/calculation time, classification, and raw dataset reference. Exclude run IDs and generated prose from the fingerprint. Escape all external text as data and include reviewer notes only under an explicit `untrustedReviewerNotes` key.

- [ ] **Step 4: Verify the repository command**

Run: `npm test -- tests/agents && npm run insights:prepare -- --due --limit 2 --fixture-state tests/fixtures/airtable/base-snapshot.json`

Expected: with fixture-repository mode enabled for tests, stdout is a validated manifest of at most two companies and contains no raw payload or secrets.

- [ ] **Step 5: Commit evidence preparation**

```bash
git add lib/agents jobs/prepare-insights.ts tests/agents package.json
git commit -m "feat: prepare bounded insight evidence"
```

### Task 8: Candidate Validation, Review Routing, and Publication

**Files:**
- Create: `lib/schemas/insight-candidate.ts`
- Create: `lib/agents/candidates/validate.ts`
- Create: `lib/agents/publication/submit.ts`
- Create: `lib/agents/publication/publish-approved.ts`
- Create: `jobs/submit-insight.ts`
- Create: `jobs/publish-approved-insights.ts`
- Create: `tests/fixtures/candidates/high-confidence.json`
- Create: `tests/fixtures/candidates/low-confidence.json`
- Create: `tests/fixtures/candidates/conflicting-evidence.json`
- Create: `tests/fixtures/candidates/malformed.json`
- Create: `tests/agents/submission.test.ts`
- Create: `tests/agents/publication.test.ts`

**Interfaces:**
- Produces: `InsightCandidateSchema` with company, provenance, fingerprint, observed themes, material claims, overall confidence, review reasons, and generated timestamp.
- Produces: `submitCandidate(candidate): Promise<{status:'published'|'queued'|'stale'|'rejected'; companyId:string; runId:string; reasons:string[]}>`.
- Produces: `publishApproved(): Promise<{published:number; stale:number; failed:number}>`.

- [ ] **Step 1: Write the publication-gate state-transition tests**

```ts
it('auto-publishes only a current, fully evidenced high-confidence candidate', async () => {
  expect(await submitCandidate(highConfidence)).toMatchObject({status: 'published'});
});

it('queues lower confidence and preserves the published insight', async () => {
  const before = repository.published('company-alpha');
  expect(await submitCandidate(lowConfidence)).toMatchObject({status: 'queued'});
  expect(repository.published('company-alpha')).toEqual(before);
});

it('marks an approved review stale when its fingerprint changed', async () => {
  repository.approve(reviewWithOldFingerprint);
  expect(await publishApproved()).toMatchObject({published: 0, stale: 1});
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/agents/submission.test.ts tests/agents/publication.test.ts`

Expected: FAIL because candidate and publication services are missing.

- [ ] **Step 3: Implement schema, evidence resolution, and idempotent transitions**

Require every claim to contain `conclusion`, `classification`, `confidence`, `confidenceReason`, and one or more `evidenceRefs`. Resolve refs only against the current prepared package. Calculate overall confidence as the lowest material-claim confidence. Reject no-claim and malformed candidates. Treat `prompt_injection_content`, unresolved refs, conflicts, suspicious data, ambiguous identity, insufficient evidence, and reviewer regeneration as review reasons. Reuse one review row per company. Revalidating a repeated submission must return the prior outcome without duplicate writes.

- [ ] **Step 4: Verify all candidate fixtures and CLI outcomes**

Run: `npm test -- tests/agents && npm run insights:submit -- tests/fixtures/candidates/high-confidence.json --fixture-state tests/fixtures/airtable/base-snapshot.json && npm run insights:publish-approved -- --fixture-state tests/fixtures/airtable/base-snapshot.json`

Expected: fixture mode publishes the high-confidence candidate exactly once; low/conflicting candidates queue; malformed rejects; stale approval never publishes.

- [ ] **Step 5: Commit the insight lifecycle**

```bash
git add lib/schemas/insight-candidate.ts lib/agents jobs/submit-insight.ts jobs/publish-approved-insights.ts tests/agents tests/fixtures/candidates package.json
git commit -m "feat: gate and publish evidence-backed insights"
```

### Task 9: Apify Client and Partial-Success Railway Refresh

**Files:**
- Create: `lib/apify/client.ts`
- Create: `lib/apify/run-domain-overview.ts`
- Create: `lib/workflows/enrich.ts`
- Create: `jobs/enrich.ts`
- Create: `tests/apify/client.test.ts`
- Create: `tests/workflows/enrich.test.ts`

**Interfaces:**
- Produces: `ApifyClient.startRun`, `waitForRun`, and `getDatasetItems`, each with `AbortSignal` timeout support.
- Produces: `runEnrichment(options): Promise<EnrichmentReport>` with separate Railway `runId`, `status`, `processed`, `succeeded`, `failed`, `cacheInvalidated`, and company-safe errors.

- [ ] **Step 1: Write failing timeout, retry, and partial-success tests**

```ts
it('retries one failed Apify batch and retains successful companies', async () => {
  const report = await runEnrichment({batchSize: 2, maxAttempts: 2, timeoutMs: 5_000, dependencies});
  expect(report).toMatchObject({status: 'partial', processed: 3, succeeded: 2, failed: 1});
  expect(repository.persistedCompanyIds()).toEqual(['company-alpha', 'company-beta']);
});

it('invalidates only after completed Airtable writes', async () => {
  await runEnrichment({dependencies});
  expect(callOrder).toEqual(['system:running', 'apify', 'airtable:writes', 'system:succeeded', 'cache:invalidate']);
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/apify/client.test.ts tests/workflows/enrich.test.ts`

Expected: FAIL because the Apify and refresh orchestration modules do not exist.

- [ ] **Step 3: Implement deterministic refresh with cleanup**

Read active domains from Airtable, create a Railway run ID, update only Railway status fields, submit bounded batches in Domain Overview mode, poll with bounded exponential backoff and a hard timeout, validate dataset items, transform and persist each successful company, update current fingerprints without touching agent status, and close with `succeeded`, `partial`, or `failed`. In `finally`, abort open requests and set a non-running terminal status. Invalidate cache only after writes and terminal System update succeed. Never require a model token.

- [ ] **Step 4: Run workflow and command checks**

Run: `npm test -- tests/apify tests/workflows/enrich.test.ts && npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json`

Expected: the fixture refresh exits cleanly, emits a secret-free summary, writes deterministic metrics only, and leaves insight records unchanged.

- [ ] **Step 5: Commit the Railway refresh**

```bash
git add lib/apify lib/workflows/enrich.ts jobs/enrich.ts tests/apify tests/workflows/enrich.test.ts package.json
git commit -m "feat: add partial-success metric refresh"
```

### Task 10: Dashboard API Shaping, Last-Successful Cache, and Health

**Files:**
- Create: `lib/domain/dashboard.ts`
- Create: `lib/cache/dashboard-cache.ts`
- Create: `lib/cache/signature.ts`
- Create: `lib/api/shape-landscape.ts`
- Create: `lib/api/shape-company.ts`
- Create: `app/api/dashboard/route.ts`
- Create: `app/api/companies/[companyId]/route.ts`
- Create: `app/api/health/route.ts`
- Create: `app/api/internal/cache/route.ts`
- Create: `tests/api/dashboard.test.ts`
- Create: `tests/api/company.test.ts`
- Create: `tests/api/cache.test.ts`

**Interfaces:**
- Produces: `LandscapeResponse` with `status`, `freshness`, `kpis`, `companies`, `marketMap`, `signals`, and `filters`.
- Produces: `CompanyResponse` with classified `identity`, `status`, `kpis`, `trend`, `demand`, `keywords`, `landingPages`, `competitors`, `countries`, `ai`, `authority`, optional `paid`, `publishedInsight`, optional `reviewCandidate`, and `evidence`.
- Produces: `DashboardCache.getOrLoad`, `replaceAfterSuccess`, `markRefreshState`, and `invalidate`.

- [ ] **Step 1: Write failing API/security/cache tests**

```ts
it('serves the last successful snapshot when a refresh fails', async () => {
  cache.seed(lastSuccessful);
  cache.markRefreshState({status: 'failed', failedCompanies: 2});
  const response = await GET_DASHBOARD();
  expect(await response.json()).toMatchObject({status: 'failed', companies: lastSuccessful.companies});
});

it('never exposes server secrets or raw provider objects', async () => {
  const body = JSON.stringify(await (await GET_COMPANY('company-alpha')).json());
  expect(body).not.toMatch(/AIRTABLE|APIFY_TOKEN|authorization|rawProviderPayload/i);
});

it('rejects unsigned cache invalidation', async () => {
  expect((await INVALIDATE(new Request(url, {method: 'POST'}))).status).toBe(401);
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/api`

Expected: FAIL because API shapers, cache, and routes are missing.

- [ ] **Step 3: Implement server-only response shaping and signed invalidation**

Build the cache on first request, retain it across repository failures in the current process, and expose freshness/status separately from cached data. Verify the invalidation signature with HMAC-SHA256 over the raw request timestamp/body, reject timestamps older than five minutes, and use constant-time comparison. Return 404 for unknown company IDs and structured recovery messages for empty/failed states. Never serialize raw provider records.

- [ ] **Step 4: Run API, security, and build checks**

Run: `npm test -- tests/api && npm run build`

Expected: API tests pass, routes build as server handlers, and the client bundle contains none of the server variable names or credential values.

- [ ] **Step 5: Commit the serving boundary**

```bash
git add lib/domain/dashboard.ts lib/cache lib/api app/api tests/api
git commit -m "feat: serve cached competitor dashboard data"
```

### Task 11: Semantic Tokens, Application Shell, and Shared Status Components

**Files:**
- Create: `styles/tokens.css`
- Create: `styles/globals.scss`
- Create: `components/shared/AppShell.tsx`
- Create: `components/shared/KpiLedger.tsx`
- Create: `components/shared/Freshness.tsx`
- Create: `components/shared/WorkflowStatus.tsx`
- Create: `components/shared/ScreenState.tsx`
- Create: `components/shared/SkipLink.tsx`
- Create: `tests/components/shared-components.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: classified dashboard types from Task 10.
- Produces: accessible shared primitives used by both screens without changing the classification of values.

- [ ] **Step 1: Write failing shell and KPI ledger tests**

```tsx
it('renders one five-value ledger with classification and movement text', () => {
  render(<KpiLedger metrics={metrics} />);
  expect(screen.getByRole('list', {name: /key metrics/i})).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(screen.getByText(/calculated/i)).toBeInTheDocument();
  expect(screen.getByText(/increased 12%/i)).toBeInTheDocument();
});

it('provides skip navigation and textual workflow status', () => {
  render(<AppShell status="partial"><main id="main-content" /></AppShell>);
  expect(screen.getByRole('link', {name: /skip to content/i})).toHaveAttribute('href', '#main-content');
  expect(screen.getByText('Some companies failed')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/components/shared-components.test.tsx`

Expected: FAIL because the shared components do not exist.

- [ ] **Step 3: Implement the approved design foundation**

Define every approved color, type, spacing, radius, layer, breakpoint, and motion duration as semantic CSS variables. Load IBM Plex Sans and IBM Plex Mono through local/browser-safe font configuration. Import one Carbon light theme at the root. Build the 48px header, 192px desktop sidebar, 1600px content maximum, semantic landmarks, visible focus, status text, exact freshness tooltip, reduced-motion rules, and geometry-matched skeleton regions. Do not add gradients, page-module shadows, independent KPI cards, or a second component system.

- [ ] **Step 4: Run component and build checks**

Run: `npm test -- tests/components/shared-components.test.tsx && npm run build`

Expected: shared components pass semantic queries and all visual values resolve through tokens.

- [ ] **Step 5: Commit the design foundation**

```bash
git add styles components/shared app/layout.tsx tests/components/shared-components.test.tsx
git commit -m "feat: add research dashboard design foundation"
```

### Task 12: Landscape-Led All Companies Screen

**Files:**
- Create: `components/landscape/LandscapeScreen.tsx`
- Create: `components/landscape/LandscapeFilters.tsx`
- Create: `components/landscape/MarketMap.tsx`
- Create: `components/landscape/AttentionSignals.tsx`
- Create: `components/landscape/CompanyLeaderboard.tsx`
- Create: `components/landscape/filter-state.ts`
- Create: `tests/components/landscape.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `LandscapeResponse` from Task 10.
- Produces: URL fields `country`, `paid`, `ai`, `trafficMin`, `trafficMax`, `authorityMin`, `authorityMax`, `segment`, `sort`, and `selectedCompany`.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it('applies one filter to KPIs, map, signals, and leaderboard without resetting sort', async () => {
  render(<LandscapeScreen initialData={landscapeFixture} search="?sort=traffic-desc" />);
  await user.selectOptions(screen.getByLabelText('Paid activity'), 'active');
  expect(screen.getByTestId('market-map')).toHaveAttribute('data-count', '1');
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByRole('columnheader', {name: /organic traffic/i})).toHaveAttribute('aria-sort', 'descending');
});

it('links map selection and leaderboard focus', async () => {
  render(<LandscapeScreen initialData={landscapeFixture} />);
  await user.click(screen.getByRole('button', {name: /alpha.*authority 42.*traffic 12000/i}));
  expect(screen.getByRole('row', {name: /alpha.example/i})).toHaveAttribute('aria-selected', 'true');
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/components/landscape.test.tsx`

Expected: FAIL because the landscape components do not exist.

- [ ] **Step 3: Implement one coherent filtered view**

Use Carbon filters and table primitives. Give the market map authority X-axis, explicitly labeled logarithmic organic-traffic Y-axis, tracked-share size, and AI-outperformance accent; make points keyboard-traversable in leaderboard order and provide a structured data table. Show three to five attention signals with company, reason, value, and period. The leaderboard columns are authority, estimated organic traffic, 30-day calculation, non-brand share, keywords, paid activity, AI benchmark gap, referring domains, and freshness. Render `Not available` for missing values.

- [ ] **Step 4: Add empty and mobile behavior, then verify**

At `<768px`, render prioritized disclosure rows with company/domain, traffic/change, authority/AI gap, and freshness. At `768-1279px`, reduce columns and collapse the sidebar. When no companies match, name active constraints and show `Clear filters` only when filters exist.

Run: `npm test -- tests/components/landscape.test.tsx && npm run build`

Expected: filter, URL, sorting, keyboard map, accessible table, empty state, and responsive render tests pass.

- [ ] **Step 5: Commit the landscape screen**

```bash
git add components/landscape app/page.tsx tests/components/landscape.test.tsx
git commit -m "feat: build competitive landscape screen"
```

### Task 13: Company Detail Research Workspaces

**Files:**
- Create: `components/company/CompanyWorkspace.tsx`
- Create: `components/company/HistoricalChart.tsx`
- Create: `components/company/DemandComposition.tsx`
- Create: `components/company/KeywordTable.tsx`
- Create: `components/company/LandingPagePortfolio.tsx`
- Create: `components/company/CompetitorTable.tsx`
- Create: `components/company/AiPresence.tsx`
- Create: `components/company/AuthorityDistribution.tsx`
- Create: `components/company/PaidActivity.tsx`
- Create: `app/companies/[companyId]/page.tsx`
- Create: `tests/components/company-research.test.tsx`

**Interfaces:**
- Consumes: `CompanyResponse` from Task 10.
- Produces: workspace URL field `tab=overview|search|ai|authority|paid|battlecard|evidence`; `paid` is omitted when no meaningful paid evidence exists.

- [ ] **Step 1: Write failing workspace and partial-data tests**

```tsx
it('renders observed samples and omits Paid when meaningful activity is absent', () => {
  render(<CompanyWorkspace company={companyWithoutPaid} tab="overview" />);
  expect(screen.getByText(/observed sample/i)).toBeInTheDocument();
  expect(screen.queryByRole('tab', {name: /paid activity/i})).not.toBeInTheDocument();
  expect(screen.getByText('No meaningful paid-search activity was observed in this enrichment.')).toBeInTheDocument();
});

it('keeps valid summary data when the authority subsection is malformed', () => {
  render(<CompanyWorkspace company={companyWithInvalidAuthority} tab="authority" />);
  expect(screen.getByRole('heading', {name: /alpha/i})).toBeInTheDocument();
  expect(screen.getByText(/authority detail is unavailable/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/components/company-research.test.tsx`

Expected: FAIL because the company workspaces do not exist.

- [ ] **Step 3: Implement the research tabs and accessible visualizations**

Overview includes the continuous KPI ledger, 24-month default organic-traffic chart, branded/non-brand stacked band, core keyword sample, organic competitors without self, and meaningful geography. Metric toggles replace the primary series and compare mode allows at most three companies. Missing observations create gaps. Search, AI, Authority, and conditional Paid tabs expose their complete research modules. Every chart includes an adjacent summary and data table; tooltip content contains exact value, date, source, and database.

- [ ] **Step 4: Verify keyboard, mobile, and data-quality behavior**

Ensure scrollable keyboard tabs, a two-column mobile KPI ledger, full-width minimum-height charts, sticky table headings, right-aligned numeric columns, exact freshness tooltips, and `Not available` for missing values.

Run: `npm test -- tests/components/company-research.test.tsx && npm run build`

Expected: tabs, charts, data tables, partial modules, conditional paid data, and responsive tests pass.

- [ ] **Step 5: Commit company research**

```bash
git add components/company app/companies tests/components/company-research.test.tsx
git commit -m "feat: build company research workspaces"
```

### Task 14: Battlecard and Claim-to-Evidence Trace

**Files:**
- Create: `components/company/Battlecard.tsx`
- Create: `components/company/EvidenceWorkspace.tsx`
- Create: `components/company/EvidenceRow.tsx`
- Create: `components/company/evidence-navigation.ts`
- Create: `tests/components/evidence-trace.test.tsx`
- Modify: `components/company/CompanyWorkspace.tsx`

**Interfaces:**
- Consumes: `publishedInsight`, `reviewCandidate`, and `evidence` from `CompanyResponse`.
- Produces: URL fields `tab=evidence`, `claim=<claimId>`, and `evidence=<comma-separated-ref-ids>` plus return-state containing originating claim and scroll position.

- [ ] **Step 1: Write the failing evidence-navigation test**

```tsx
it('opens exact evidence, highlights it, and returns to the originating claim', async () => {
  render(<CompanyWorkspace company={companyWithInsight} tab="battlecard" />);
  await user.click(screen.getByRole('link', {name: '2 linked observations'}));
  expect(screen.getByRole('tab', {name: 'Evidence'})).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByTestId('highlighted-evidence')).toHaveLength(2);
  expect(window.location.search).toMatch(/claim=claim-search-strength/);
  await user.click(screen.getByRole('button', {name: /return to claim/i}));
  expect(screen.getByTestId('claim-search-strength')).toHaveFocus();
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/components/evidence-trace.test.tsx`

Expected: FAIL because battlecard/evidence components do not exist.

- [ ] **Step 3: Implement traceable inference presentation**

Lead with conclusion and confidence, visually separate observed summaries from inferred recommendations, and give every claim an evidence-count link. Evidence rows show classification, source/provider, database/country, timestamp, safe raw/Airtable reference, fingerprint, run ID, harness/model, skill version, and workflow version. Render external content as text; allow only `http:`/`https:` links with `rel="noopener noreferrer"`. Keep the last published insight visible alongside a non-destructive `Insight review required` notice when a newer candidate exists.

- [ ] **Step 4: Verify stale, review, and reduced-motion states**

Highlight target rows over 160ms and leave them highlighted until focus changes; remove the transition under reduced motion. A fingerprint mismatch displays `Insight stale` and blocks any publish action. The Evidence tab remains a sibling tab, not a drawer.

Run: `npm test -- tests/components/evidence-trace.test.tsx tests/components/company-research.test.tsx`

Expected: direct trace, return focus, URL restoration, safe links, published-plus-review, and stale states pass.

- [ ] **Step 5: Commit the evidence experience**

```bash
git add components/company tests/components/evidence-trace.test.tsx
git commit -m "feat: connect battlecard claims to evidence"
```

### Task 15: Complete UI State Matrix, Accessibility, and Browser Tests

**Files:**
- Create: `tests/fixtures/api/dashboard-states.ts`
- Create: `tests/fixtures/api/company-states.ts`
- Create: `tests/components/state-matrix.test.tsx`
- Create: `tests/e2e/primary-workflows.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/responsive.spec.ts`
- Modify: `components/shared/ScreenState.tsx`
- Modify: `components/landscape/LandscapeScreen.tsx`
- Modify: `components/company/CompanyWorkspace.tsx`

**Interfaces:**
- Consumes: the screen and API state contracts from Tasks 10-14.
- Produces: deterministic fixture coverage for current, empty-cache loading, refreshing-with-data, stale, partial, failed-with-data, empty, no results, no paid, review required, published-plus-review, and fingerprint mismatch.

- [ ] **Step 1: Add the failing state-matrix test**

```tsx
it.each([
  ['loading', /loading competitive landscape/i],
  ['refreshing', /refresh running/i],
  ['stale', /data is stale but remains available/i],
  ['partial', /some companies failed/i],
  ['failed', /refresh failed.*last successful data/i],
  ['empty', /no companies have been imported/i],
])('renders the %s state with recovery language', (state, message) => {
  render(<LandscapeScreen initialData={dashboardStates[state]} />);
  expect(screen.getByText(message)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify missing states fail**

Run: `npm test -- tests/components/state-matrix.test.tsx`

Expected: FAIL for every state not yet represented explicitly.

- [ ] **Step 3: Implement exact state and live-region behavior**

Use geometry-matched skeletons only when the cache is empty. Keep last-successful content visible while refreshing, stale, partial, or failed. Announce completed refreshes and filter result counts through polite live regions, not continuous updates. Associate failures with `Retry refresh`; name active filters in no-result states. Preserve focus after filtering, tab changes, and evidence return.

- [ ] **Step 4: Run browser workflows at three widths**

Test at 1440x1000, 1024x768, and 390x844: filter/share URL, map-to-row selection, company navigation, workspace persistence during company change, chart data alternative, battlecard-to-evidence-return, no-paid state, stale data, and keyboard-only traversal. Assert touch controls are at least 44px on mobile where directly interactive and animations disappear under reduced motion.

Run: `npm test -- tests/components && npx playwright test tests/e2e`

Expected: all state, keyboard, screen-reader-name, focus, responsive, and primary-workflow assertions pass.

- [ ] **Step 5: Commit interface verification**

```bash
git add tests/fixtures/api tests/components tests/e2e components/shared/ScreenState.tsx components/landscape/LandscapeScreen.tsx components/company/CompanyWorkspace.tsx
git commit -m "test: cover dashboard states and accessibility"
```

### Task 16: Railway Configuration, Skill Contracts, Security Audit, and Workshop Rehearsal

**Files:**
- Create: `Dockerfile`
- Create: `railway.toml`
- Create: `docs/operations/deployment.md`
- Create: `docs/operations/workshop-runbook.md`
- Create: `tests/contracts/skills.test.ts`
- Create: `tests/contracts/agent-definitions.test.ts`
- Create: `tests/security/no-secret-exposure.test.ts`
- Create: `tests/e2e/workshop-demo.spec.ts`
- Modify: `.env.example`
- Modify: `README.md` if it exists by execution time; otherwise create `README.md`

**Interfaces:**
- Consumes: all repository commands and application routes.
- Produces: one Railway web service (`npm start`) and one cron service (`npm run enrich`) using the same image and server variable names.
- Produces: a documented non-production smoke sequence and fixture/candidate fallback sequence.

- [ ] **Step 1: Write failing contract and secret-exposure tests**

```ts
it('keeps documented skill commands synchronized with package scripts', () => {
  for (const name of ['enrich', 'insights:prepare', 'insights:submit', 'insights:publish-approved']) {
    expect(packageJson.scripts[name]).toBeTruthy();
    expect(skillAndRunbookText).toContain(`npm run ${name}`);
  }
});

it('keeps pipeline, dashboard, and reviewer role boundaries equivalent across harnesses', () => {
  expect(readRole('codex', 'evidence-reviewer')).toMatch(/read-only/i);
  expect(readRole('claude', 'evidence-reviewer')).toMatch(/read-only/i);
  expect(readRole('codex', 'dashboard-builder')).toMatch(/building-competitor-dashboard/);
});

it('finds no credential value or raw provider payload in browser artifacts', async () => {
  expect(await scanClientBuild()).toEqual([]);
});
```

- [ ] **Step 2: Verify the missing deployment/rehearsal contracts fail**

Run: `npm test -- tests/contracts tests/security`

Expected: FAIL until deployment files, synchronized scripts, safe env documentation, and browser-artifact scanning exist.

- [ ] **Step 3: Add Railway and operational configuration**

Build once with Node 22, run Next with `npm start`, and configure the cron command `npm run enrich` with `0 15 * * 1` UTC, no public domain, restart policy appropriate to a terminating job, and a hard timeout. Document required variable names and present/missing preflight output without values. Document health, cache signature, non-production Airtable smoke checks, before/after System snapshots, and a prohibition on unattended production deployment or destructive cleanup.

- [ ] **Step 4: Rehearse the exact fallback-safe workshop journey**

Run the sanitized initial import; optionally demonstrate one bounded live Apify batch only after explicit operator setup; switch to the sanitized fixture if it is slow or unavailable; open All Companies; navigate to Company Detail; submit the pre-generated high-confidence candidate; submit the low-confidence candidate and show `Needs Review`; mark it approved in the non-production base; run `npm run insights:publish-approved`; verify battlecard evidence and freshness; show independent Railway and agent run IDs.

Automate the local portion in `tests/e2e/workshop-demo.spec.ts` and leave the live-service actions as explicit operator commands with expected status/count assertions, never as default test behavior.

- [ ] **Step 5: Run the complete release gate**

Run: `npm test && npm run build && npx playwright test && node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check data/apify/apollo-accounts-semrush-scraper.json .agents/skills/competitor-data-contracts/references/semrush-domain-overview-schema.md && docker build -t competitor-intelligence:v1 .`

Expected: unit, contract, component, security, and browser suites pass; schema drift is absent; the production image builds; fixture import and both candidate fallbacks remain operational.

- [ ] **Step 6: Perform the final read-only evidence review**

Invoke the repository `evidence-reviewer` role against the implementation and require file-backed findings for unsupported inference, misclassified fields, prompt-injection handling, secret exposure, missing negative tests, non-idempotent writes, and accidental raw-payload delivery. Resolve every high-severity finding and rerun the affected narrow suite followed by the complete release gate.

- [ ] **Step 7: Commit the workshop-ready release**

```bash
git add Dockerfile railway.toml docs/operations tests/contracts tests/security tests/e2e README.md .env.example
git commit -m "docs: prepare railway workshop release"
```

## Acceptance-Criteria Traceability

| Specification criterion | Implemented and verified by |
|---|---|
| Idempotent Apollo/Apify join and deterministic exceptions | Tasks 2, 3, and 6 |
| Enrich the supplied 52 domains | Tasks 6 and 9 |
| Remain below the Airtable Free-plan record limit | Tasks 5, 6, and 16 |
| No Airtable or provider secret reaches the browser | Tasks 1, 10, and 16 |
| All Companies metrics and company navigation | Tasks 10, 12, and 15 |
| Company Detail research modules and conditional paid data | Tasks 10, 13, and 15 |
| Traceable, classified battlecards with complete generation metadata | Tasks 7, 8, and 14 |
| Independent, terminating weekly Railway metric refresh | Tasks 9 and 16 |
| Independent agent-harness due-work catch-up | Tasks 7, 8, and 16 |
| High-confidence auto-publication and bounded review routing | Task 8 |
| Current approval promotion and stale-candidate rejection | Tasks 8 and 14 |
| Retry idempotency, partial success, published-insight preservation, and last-successful cache | Tasks 5-10 |
| Deployed prototype works from a fresh browser session | Tasks 15 and 16 |
| Claude Code and Codex discover equivalent skills and focused roles | Task 16 |
| Fixture fallback, skill-driven workflow, and read-only evidence review | Tasks 2, 7, 8, and 16 |

## Completion Evidence

Before calling Version 1 complete, attach or record:

- The complete test/build commands and passing output summaries.
- Initial-import counts, including 52 companies and one missing-website rejection for the supplied files.
- Airtable record estimate and actual table counts; both must remain under 1,000.
- An idempotent replay showing unchanged company, keyword, ad, insight, and review identities.
- One partial Railway refresh showing successful companies preserved.
- One high-confidence auto-publication and one lower-confidence review route preserving the previous publication.
- One approved-current promotion and one stale-candidate rejection.
- Screenshots at desktop, tablet, and mobile for both primary screens plus loading, stale, partial, empty, review, and failure states.
- Keyboard evidence for filters, tabs, tables, chart alternatives, map points, and claim-to-evidence return.
- A client-artifact scan showing no server secrets or raw provider payloads.
- Health and freshness output from a non-production Railway deployment.
- The evidence-reviewer report and resolution of every high-severity finding.
