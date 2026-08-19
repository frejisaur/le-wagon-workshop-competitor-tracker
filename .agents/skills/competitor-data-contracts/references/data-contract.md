# Competitor data contract

## Observed provider schema

Use [semrush-domain-overview-schema.md](semrush-domain-overview-schema.md) for
the generated field-path inventory, observed types, record coverage, nulls,
object keys, array cardinalities, and detected string formats. Treat it as an
observed sample contract rather than a guarantee of future provider behavior.

## Data layers

| Layer | Examples | Rule |
|---|---|---|
| Observed | Provider traffic, keywords, backlinks, ads, AI mentions | Preserve source, database, raw link, and observation time. |
| Calculated | 30-day change, non-brand share, benchmark gap, tracked-set share | Derive through tested pure functions from observed values. |
| Inferred | Themes, vulnerabilities, recommendations, confidence | Store only through the insight candidate and publication workflow. |

## Required quality rules

1. Label top-keyword rows as observed samples, not complete rankings.
2. Remove the company self-row from organic and paid competitors.
3. Ignore `is_root_domain` in Version 1.
4. Preserve backlink totals independently when provider figures disagree.
5. Omit zero-value AI-country rows from default views.
6. Parse Moz values such as `1.6k` and `3%`, retaining the original string.
7. Validate suspicious Moz top-page records before display.
8. Preserve unknown SERP feature codes without invented labels.
9. Label provider figures as estimates with source, database, and timestamp.
10. Keep observed, calculated, and inferred fields visibly separate.

## Initial Apollo-to-Apify join

The Apollo CSV is the roster and the Apify JSON is enrichment. Join Apollo
`Website` to Apify `domain` using the shared domain normalizer. Extract and
lowercase the hostname, remove a leading `www.` and any trailing dot, and ignore
schemes, ports, paths, queries, and fragments. Preserve both raw values.
Never join by company name: the supplied Apify payload has no company-name field.

Use a left join from valid Apollo rows. A valid Apollo domain without an Apify
match remains an unenriched company with metrics absent, not zero. Reject and
report missing or invalid Apollo websites, Apify-only domains, duplicate
normalized Apollo domains, and conflicting source identities. Canonically
identical Apify duplicates are idempotent; conflicting records for the same
domain, database, and observation time are rejected. Keep different database or
time observations separate.

The supplied Apollo file has 53 rows: 52 unique valid website domains and one
missing website. The supplied Apify file has 52 unique domains, all matching the
52 valid Apollo domains. Expected initial Company count: 52.

## Stable identities

- Company: immutable internal `company_id`, assigned once and persisted.
- Join and natural key: unique `canonical_domain` from normalized Apollo
  `Website` or Apify `domain`; it is not the permanent company identity.
- Provider identities: Apollo Account ID and Apollo Record ID, retained as
  observed source identifiers rather than used as cross-provider join keys.
- Keyword: company + keyword + normalized landing URL.
- Paid ad: hash of company + keyword + title + description + normalized landing URL.
- Insight submission: company + evidence fingerprint + skill version + workflow version.
- Review: one reusable company-linked record.

Normalize domains and URLs in one shared module. Consumers import that module;
they do not implement their own normalization. On retry, resolve an existing
company by Apollo Account ID when available, then by `canonical_domain`; do not
mint a second `company_id` for the same resolved company.

## Evidence fingerprint

The preparation command exports the exact curated evidence package available to
the battlecard skill. Canonically serialize that package with stable key order
and normalized scalar representations, then hash it in one shared function.
Exclude run IDs and generated insight text. Any evidence field addition,
removal, or normalization change requires a fingerprint contract test.

## Airtable budget

Version 1 targets fewer than 1,000 records and 1,000 API calls per workspace per
month. The supplied sample estimate is about 531 records: 52 Companies, 358
Keywords, 16 Paid Ads, up to 52 GTM Insights, up to 52 Insight Reviews, and one
System record. Batch writes and store bounded summaries rather than raw payloads.
