# Dashboard product behavior

The product has two primary screens. Search, paid, AI, and authority
intelligence are sections inside them, not separate applications. Layout,
tokens, and components come from
`docs/gtm-competitor-intelligence-design-system.md`; this file defines what
each screen must contain.

## All Companies

Purpose: help a marketer understand the competitive landscape and decide which
companies deserve investigation.

- Portfolio KPIs: companies tracked, combined organic traffic, organic keyword
  footprint, companies growing over 30 days, and companies with paid activity.
- Market map: authority score against organic traffic, with optional encoding
  for AI benchmark performance.
- Attention signals: growth leaders, paid-search leaders, AI benchmark
  outperformers, and companies with majority non-brand demand.
- Sortable company leaderboard with authority, organic traffic, 30-day change,
  non-brand share, keywords, paid activity, AI visibility against benchmark,
  referring domains, and freshness.
- Filters for country, paid activity, AI performance, traffic range, authority
  range, and Apollo segment when present.

## Company Detail

Purpose: turn one company into an evidence-backed GTM battlecard.

- Header with domain, Apollo identity, market, enrichment time, and job status.
- KPI ledger: authority, traffic and movement, keyword footprint, AI visibility
  against benchmark, and link momentum.
- Historical chart with toggles for traffic, keywords, traffic value, branded
  and non-brand traffic, paid activity, and SERP-feature traffic.
- Demand composition for branded against non-brand traffic.
- Observed top-keyword table, labeled as a sample, with position, volume, CPC,
  difficulty, traffic, intent, and landing URL.
- Landing-page portfolio grouped by normalized URL.
- Organic competitors without the company self-row.
- Geographic footprint using only meaningful country values.
- AI search: per-LLM breakdown, benchmark comparison, nonzero countries, and
  cited sources.
- Authority and distribution: link composition, anchors, backlink samples, Moz
  metrics, and linking sources.
- Paid search only when meaningful data exists; otherwise a concise empty
  state.
- Battlecard and Evidence workspace tabs with direct claim-to-source
  navigation.

## Evidence standard

Every displayed battlecard claim shows its conclusion, confidence, and linked
evidence, and the battlecard shows its evidence fingerprint, run ID, agent
harness, model, skill and workflow versions, and generation time. The UI never
presents an inference as a measured field. When the stored battlecard no longer
matches current evidence, the screen withholds it as stale instead of showing
outdated claims.

## Acceptance

- All Companies renders real portfolio metrics and navigates to a company.
- Company Detail renders trends, keyword evidence, competitors, AI presence,
  authority, and conditional paid data.
- Populated, partial, loading, stale, empty, and error states are each covered
  by a component test.
- The deployed app works from a fresh browser session with no provider or
  Airtable secret reaching the browser.
