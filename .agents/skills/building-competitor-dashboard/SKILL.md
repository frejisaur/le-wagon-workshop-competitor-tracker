---
name: building-competitor-dashboard
description: Use when implementing or reviewing competitor dashboard screens, navigation, tables, charts, filters, evidence presentation, responsive behavior, accessibility, loading states, empty states, stale data, or visual regressions in this repository.
---

# Building the Competitor Dashboard

Implement a calm research instrument that makes comparison efficient and every
agent interpretation traceable to evidence.

## Required context

Before changing interface code:

1. Read `gtm-competitor-intelligence-design.md`, especially Sections 5, 6, 11,
   12, 14, and 16, for data quality, product behavior, failure handling,
   security, testing, and acceptance criteria.
2. Read `gtm-competitor-intelligence-design-system.md`. Use its tokens,
   application shell, screen anatomy, component rules, chart rules, responsive
   behavior, content language, accessibility requirements, and required states
   as the authoritative interface contract.
3. Load `competitor-data-contracts` before changing API response shapes,
   dashboard types, value classification, fixtures, or field formatting.

Read the full design-system document for a new screen or system-wide change. For
a focused component change, read its foundations plus the matching component,
state, responsive, and accessibility sections.

## Workflow

1. Identify the affected screen and user decision: portfolio triage on All
   Companies or company investigation on Company Detail.
2. Use validated domain types and the smallest sanitized fixture that exercises
   the populated, partial, loading, stale, empty, review, or failure state.
3. Write the focused component or interaction test before implementation.
4. Build with Carbon primitives where the design system assigns Carbon
   ownership. Keep product-owned visualizations and evidence patterns local to
   focused components.
5. Keep observed values, deterministic calculations, and agent interpretations
   visibly distinct. Never infer display truth from presentation copy.
6. Implement the explicit desktop, tablet, and mobile behavior. Preserve
   keyboard operation, visible focus, reduced motion, and chart alternatives.
7. Visually compare the populated and non-happy-path states against the design
   system. Then run the focused test and the broader relevant suite.

## Non-negotiable interface contracts

- All Companies is the landscape-led home experience.
- Company Detail uses workspace tabs. Battlecard and Evidence are sibling
  views.
- Linked evidence counts open the Evidence tab at the exact supporting records
  and preserve a route back to the originating claim.
- The KPI row is a continuous ledger, not a row of independent cards.
- Investigation blue is the only interface accent. Semantic colors communicate
  measured status only.
- Provider source, database, and freshness remain available wherever they
  affect interpretation.
- Missing data is labeled explicitly. It is never rendered as zero.
- Paid activity appears only when meaningful data exists; otherwise use the
  specified empty state.
- Do not expose raw provider payloads, secrets, or untrusted external content as
  executable markup.

## Required handoff

Report:

- Screen, component, and states changed.
- Design-system sections applied.
- Data classifications displayed or changed.
- Desktop, tablet, mobile, keyboard, and screen-reader behavior checked.
- Focused and broader tests run.
- Any intentional deviation from the design system and its approval status.
