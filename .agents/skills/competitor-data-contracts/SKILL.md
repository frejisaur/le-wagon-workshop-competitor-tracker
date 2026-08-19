---
name: competitor-data-contracts
description: Use when implementing or reviewing Semrush/Apify validation, normalized competitor data, Airtable mappings, deterministic metrics, record identities, evidence fingerprints, sanitized fixtures, or dashboard API shaping in this repository.
---

# Competitor Data Contracts

Keep every value traceable to one of three layers: observed provider data,
reproducible calculation, or agent inference. Never silently move a value
between layers.

## Workflow

1. Read `gtm-competitor-intelligence-design.md`, especially Sections 4, 5, 7,
   and 8. Read [references/data-contract.md](references/data-contract.md) before
   changing schemas, identities, or fingerprint inputs. When a raw field path,
   observed type, coverage, object shape, array cardinality, null, or string
   format matters, also read
   [references/semrush-domain-overview-schema.md](references/semrush-domain-overview-schema.md).
2. Classify each field as `observed`, `calculated`, or `inferred` before adding
   it to a type, transform, Airtable table, API response, or UI.
3. Validate raw records at the provider boundary. For the initial Apollo and
   Apify file import, apply the join, identity, and exception rules in
   [references/data-contract.md](references/data-contract.md). Normalize into
   focused domain types; do not pass raw provider objects into Airtable or
   presentation code.
4. Make calculations pure and reproducible from stored evidence. Preserve the
   source database, raw-record link, and enrichment timestamp.
5. Use stable record identities and the repository's canonical manifest builder
   for evidence fingerprints. Never recreate fingerprint logic in a consumer.
6. Start with the smallest sanitized fixture that reproduces the case. Add a
   failing contract or unit test, implement the smallest change, then run the
   broader relevant suite.
7. Check the estimated Airtable record count and API-call impact whenever a
   persisted collection grows.

## Schema maintenance

Regenerate the observed schema after replacing or intentionally changing the
source payload:

```bash
node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs
```

Detect unreviewed schema drift in verification or CI:

```bash
node .agents/skills/competitor-data-contracts/scripts/generate-semrush-schema.mjs --check
```

Review the source hash, new paths, changed types, coverage, and cardinalities
before accepting regenerated output. Never infer the full schema from one record.

## Required output for contract changes

Report:

- Fields and classification added or changed.
- Validation and normalization behavior.
- Identity or fingerprint impact.
- Tests run and fixture coverage.
- Airtable record/API impact, or `none`.

## Boundaries

- Do not generate battlecard prose or confidence judgments.
- Do not label numeric SERP feature codes without a verified mapping.
- Do not merge provider backlink totals that disagree.
- Do not place secrets or unsanitized provider payloads in fixtures or logs.
