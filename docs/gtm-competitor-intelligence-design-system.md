# GTM Competitor Intelligence - Interface Design System

Date: 2026-08-18

Status: Approved visual direction

Companion specification: [`gtm-competitor-intelligence-design.md`](../gtm-competitor-intelligence-design.md)

## 1. Design intent

The interface is a calm research instrument for marketers who need to compare competitors, investigate one company, and verify generated recommendations. It should feel credible, precise, and approachable rather than promotional, futuristic, or operationally intense.

The interface has two approved hierarchy decisions:

1. The landscape-led All Companies screen is the home experience.
2. The Company Detail screen uses workspace tabs, with Battlecard and Evidence as sibling views.

The visual system is built on IBM Carbon patterns for enterprise data interfaces. Carbon provides accessible primitives and interaction conventions. Product-specific tokens, layouts, charts, and evidence patterns provide the identity.

### 1.1 Design dials

| Dial | Value | Consequence |
| --- | ---: | --- |
| Design variance | 4/10 | Offset hierarchy is allowed, but the application uses a stable grid. |
| Motion intensity | 2/10 | Motion communicates state change only. No ambient or decorative animation. |
| Visual density | 7/10 | Comparison views are compact, while battlecard reading surfaces have more space. |

### 1.2 Principles

1. **Comparison first.** The home screen helps marketers identify where to look next.
2. **Evidence stays reachable.** Every interpretation provides a direct path to supporting observations.
3. **Measured and inferred are visually distinct.** Provider facts, deterministic calculations, and agent conclusions never share the same treatment.
4. **Freshness is part of meaning.** Dates and workflow status appear where they affect trust.
5. **Density comes from structure.** Use alignment, type, and rules before adding containers.
6. **One interface voice.** Labels are plain, active, and consistent across navigation, controls, states, and feedback.

## 2. Foundation

### 2.1 Component foundation

Use `@carbon/react` and `@carbon/styles` for accessible primitives and expected enterprise behaviors. Do not mix Carbon with another full design system.

Suitable Carbon foundations include:

- Buttons, icon buttons, overflow menus, and tooltips.
- Text inputs, search, dropdowns, multi-selects, and date controls.
- Tabs, pagination, modal dialogs, inline notifications, and skeletons.
- Data-table interaction behavior, adapted to the product's typography and density.
- Focus handling, keyboard interaction, and screen-reader semantics.

Product-owned components include the market map, KPI ledger, attention signals, evidence trace, demand composition, battlecard layout, freshness treatment, and chart specifications.

### 2.2 Theme scope

Version 1 is light-first and ships with one application theme. A dark theme is excluded from the workshop scope so chart semantics, screenshots, and teaching remain consistent. All product colors must be expressed as semantic tokens so a future dark theme does not require component rewrites.

The theme is applied once at the application root. Individual sections do not invert their theme.

## 3. Design tokens

### 3.1 Color

#### Core interface colors

| Token | Value | Use |
| --- | --- | --- |
| `color.canvas` | `#F3F6F7` | Application background |
| `color.surface` | `#FCFDFD` | Primary working surface |
| `color.surface.raised` | `#FFFFFF` | Menus, dialogs, and selected overlays |
| `color.surface.subtle` | `#E9EEF0` | Secondary regions and inactive controls |
| `color.ink` | `#172126` | Primary text and strong rules |
| `color.text.secondary` | `#5D6B72` | Supporting labels and descriptions |
| `color.text.quiet` | `#77868D` | Metadata that remains readable but recedes |
| `color.rule` | `#D5DEE1` | Standard dividers and input borders |
| `color.rule.strong` | `#AAB8BE` | Selected boundaries and table grouping |
| `color.accent` | `#245EB5` | Primary actions, active navigation, selected data, and evidence links |
| `color.accent.subtle` | `#E8F0FB` | Active navigation and selected-row background |

Investigation blue is the only brand accent. It must not compete with multiple decorative colors or gradients.

#### Semantic data colors

| Token | Value | Use |
| --- | --- | --- |
| `color.positive` | `#2E7254` | Verified growth and successful status |
| `color.warning` | `#8A621B` | Stale data and review-required status |
| `color.negative` | `#A54640` | Verified decline and failed status |
| `color.neutral` | `#66767D` | Unchanged or unavailable values |

Semantic colors communicate meaning only. They are not used for decoration, navigation, or arbitrary chart series.

### 3.2 Typography

| Role | Typeface | Specification |
| --- | --- | --- |
| Interface | IBM Plex Sans | Navigation, labels, controls, narrative text |
| Data | IBM Plex Mono | Metrics, dates, percentages, run IDs, fingerprints, and source metadata |

Use tabular numerals for every comparable number. Do not abbreviate values differently within one column or metric group.

| Style | Size / line height | Weight | Use |
| --- | --- | ---: | --- |
| Page title | `24 / 30px` | 500 | Screen identity |
| Section title | `16 / 22px` | 600 | Major research modules |
| Panel title | `13 / 18px` | 600 | Local component heading |
| Body | `14 / 21px` | 400 | Explanations and battlecard prose |
| Compact body | `12 / 18px` | 400 | Tables, filters, and dense modules |
| Label | `11 / 16px` | 500 | Field and metric labels |
| Data large | `24 / 28px` | 500 | Primary KPIs |
| Data standard | `12 / 18px` | 400 | Tables and chart labels |
| Metadata | `11 / 16px` | 400 | Freshness, sources, and run information |

Sentence case is the default. Uppercase is limited to short system categories and must not become a recurring decorative eyebrow.

### 3.3 Spacing

Use a `4px` base unit.

| Token | Value | Typical use |
| --- | ---: | --- |
| `space.1` | `4px` | Tight icon and label gap |
| `space.2` | `8px` | Inline control gap |
| `space.3` | `12px` | Compact cell padding |
| `space.4` | `16px` | Standard component padding |
| `space.5` | `24px` | Module separation |
| `space.6` | `32px` | Page section separation |
| `space.7` | `48px` | Major reading break |

### 3.4 Shape, elevation, and layers

- Inputs and buttons: `4px` radius.
- Panels and menus: `6px` radius.
- Tags and statuses: full radius only when the shape identifies the component as a compact label.
- Data tables and KPI ledgers: no outer radius unless they sit in an overlay.
- Shadows: overlays only. Page modules use borders, spacing, and surface contrast.
- Selected table row: accent-subtle fill plus a `2px` accent edge.

Layer scale:

| Layer | Value | Use |
| --- | ---: | --- |
| Base | `0` | Page content |
| Sticky | `20` | Header and fixed table headings |
| Popover | `40` | Menus and tooltips |
| Overlay | `60` | Drawers and modal backdrops |
| Modal | `80` | Dialog content |

## 4. Application shell

### 4.1 Desktop

- Header height: `48px`.
- Left navigation width: `192px`.
- Content maximum width: `1600px`.
- Content gutter: `24px` below 1440px and `32px` at wider sizes.
- Header contains the product mark, breadcrumb, global freshness, and utility actions.
- Sidebar contains screen-level navigation. Company Detail research areas use workspace tabs inside the content canvas.

```text
+---------------------------------------------------------------+
| Product | Breadcrumb                          Data current     |
+---------+-----------------------------------------------------+
|         |                                                     |
| Sidebar | Page title, filters, and primary working surface    |
|         |                                                     |
+---------+-----------------------------------------------------+
```

### 4.2 Navigation

Primary destinations:

- All companies
- Saved views
- Insight reviews
- Evidence sources
- Refresh status

Company Detail workspace tabs:

- Overview
- Search
- AI presence
- Authority
- Paid activity, shown only when meaningful data exists
- Battlecard
- Evidence

The active item uses accent text, an accent left edge or bottom edge, and `color.accent.subtle`. Decorative status dots are not used.

## 5. Screen anatomy

### 5.1 All Companies

The landscape-led screen is the product home.

```text
+---------------------------------------------------------------+
| Competitive landscape                         Filters          |
| 52 companies across the selected market                         |
+-----------+-----------+-----------+-----------+---------------+
| Companies | Traffic   | Keywords  | Growing   | Paid active   |
+-------------------------------+-------------------------------+
| Authority and organic reach   | Attention signals             |
| Market map                    | Ranked investigation prompts  |
+-------------------------------+-------------------------------+
| Company leaderboard                                           |
| Sortable, filterable, freshness-aware comparison table         |
+---------------------------------------------------------------+
```

Rules:

- KPI metrics form one ledger separated by vertical rules. Do not render five independent cards.
- The market map receives more width than attention signals.
- Attention signals show the reason a company deserves investigation, not a second leaderboard.
- The leaderboard is the dominant navigation mechanism into Company Detail.
- Selecting a market-map point highlights the corresponding leaderboard row and vice versa.
- Filters update KPIs, map, signals, and table as one coherent view.
- Filter state is reflected in the URL for sharing and workshop recovery.

### 5.2 Company Detail

Company Detail preserves the application shell and opens an investigation workspace.

```text
+---------------------------------------------------------------+
| Klue                                            Data current   |
| Identity, market, enrichment time, and status                  |
+---------------------------------------------------------------+
| Overview | Search | AI | Authority | Paid | Battlecard | Evidence |
+---------------------------------------------------------------+
| KPI ledger                                                    |
+---------------------------------------------------------------+
| Active workspace content                                     |
+---------------------------------------------------------------+
```

Rules:

- Overview contains the historical chart, demand composition, core keyword evidence, competitors, and geographic summary.
- Specialized tabs hold complete research modules without producing an extremely long page.
- Battlecard is a focused reading workspace with conclusion, strengths, vulnerabilities, and recommended response.
- Evidence is a sibling workspace, not a persistent drawer.
- Company-to-company navigation remains available in the sidebar or breadcrumb without losing the current workspace tab.

### 5.3 Battlecard workspace

The Battlecard tab balances readable narrative with a compact evidence summary.

- Lead with the conclusion, not generation metadata.
- Show confidence next to the conclusion.
- Keep observed facts visually separate from recommendations.
- Each claim includes a linked evidence count.
- Generation metadata sits after the evidence summary and remains available without dominating the page.
- The last published insight remains visible when a newer candidate requires review.

### 5.4 Evidence trace

The evidence trace is the system's signature interaction.

1. A battlecard claim shows a link such as `4 linked observations`.
2. Activating it opens the Evidence tab.
3. The Evidence tab scrolls to and highlights the exact supporting records.
4. A return control restores the originating claim and scroll position.
5. The URL retains company, workspace tab, and claim identifier.

Evidence rows identify:

- Source type and provider.
- Database or country when relevant.
- Observation or calculation timestamp.
- Raw dataset or Airtable reference.
- Whether the value is observed, calculated, or inferred.
- Agent-evidence fingerprint and run metadata for generated claims.

## 6. Component specifications

### 6.1 KPI ledger

- One continuous region with internal dividers.
- Five metrics maximum on desktop.
- Primary value uses the data face.
- Movement is adjacent to the related value and includes a text or icon cue, never color alone.
- No progress tracks, decorative icons, or shadows.

### 6.2 Market map

- X-axis: authority score.
- Y-axis: organic traffic on an explicitly labeled logarithmic scale when necessary.
- Point size may encode tracked-set traffic share.
- Accent fill may encode AI benchmark outperformance.
- Neutral points remain quiet until hovered, focused, or selected.
- Tooltip includes company, both axis values, encoding value, data source, and freshness.
- Keyboard users can traverse companies in leaderboard order.

### 6.3 Attention signals

- Show three to five signals.
- Each row contains company, reason, value, and affected period.
- Signal categories include growth, paid activity, AI outperformance, and non-brand demand.
- Selecting a signal navigates to the relevant Company Detail workspace.

### 6.4 Tables

- Sticky header on vertically scrolling tables.
- Left-align identity and text columns. Right-align numeric columns.
- Use consistent units within a column.
- Sorting is available only for meaningful comparable fields.
- Unknown values show `Not available`, not `0` or a bare dash.
- Freshness uses relative time in the cell and an exact timestamp in its tooltip.
- Row hover is subtle. Keyboard focus is stronger and never dependent on hover.
- Pagination or controlled virtualization is required before rendering more than 100 rows.

### 6.5 Filters

- Frequently used filters stay visible: country, paid activity, and AI performance.
- Traffic, authority, and Apollo segment live in the expanded filter panel.
- Active filters appear in a compact summary with individual removal controls.
- `Clear filters` is available only when filters are active.
- Updating filters does not reset an unrelated sort choice.

### 6.6 Status and freshness

Use plain labels:

- Data current
- Refresh running
- Some companies failed
- Refresh failed
- Insight review required
- Insight stale

Status badges may use semantic color, but always include text. A dot alone is insufficient.

### 6.7 Empty and partial data

- Paid activity absent: `No meaningful paid-search activity was observed in this enrichment.`
- AI values all zero: explain that zero-value country rows are hidden.
- Keyword sample absent: explain that no observed keyword records were returned.
- Malformed subsection: omit the invalid visualization and show the valid company summary.
- No companies match filters: identify the active constraint and offer `Clear filters`.

## 7. Data visualization

### 7.1 Chart palette

- Primary selected series: investigation blue.
- Comparison series: cool gray values with sufficient luminance separation.
- Branded demand: slate.
- Non-brand demand: investigation blue.
- Positive, warning, and negative colors appear only when the metric has that meaning.

Do not assign a different bright color to every competitor. Direct labels, selection, and controlled opacity establish series identity.

### 7.2 Historical charts

- Default metric: organic traffic.
- Default period: 24 months.
- Metric toggles replace the primary series rather than layering every available metric.
- Compare mode adds no more than three companies.
- Tooltips identify date, exact value, source, and database.
- Missing observations create visible gaps rather than interpolated certainty.

### 7.3 Demand composition

- Use a single stacked band for branded and non-brand share.
- Print both values directly beside the legend.
- Do not use a donut chart for a two-part composition.

### 7.4 Accessibility fallback

Every chart provides an adjacent summary and an accessible data table or equivalent structured values. Color never carries the only distinction.

## 8. Interaction and motion

Motion communicates feedback or continuity only.

| Interaction | Behavior |
| --- | --- |
| Tab change | `120ms` opacity transition, no directional slide |
| Table sort | Rows reposition instantly; sorted header updates visibly |
| Filter update | Affected values use a short skeleton or opacity transition |
| Row press | `translateY(1px)` tactile response |
| Evidence trace | Highlight fades in over `160ms` and remains until focus changes |
| Tooltip | Appears after a short intentional delay and remains keyboard accessible |

All animation uses opacity or transform. `prefers-reduced-motion` removes nonessential transitions.

## 9. Responsive behavior

### 9.1 Breakpoints

| Range | Behavior |
| --- | --- |
| `>= 1280px` | Full sidebar, five-metric ledger, split market map and signals |
| `768-1279px` | Collapsible sidebar, scrollable workspace tabs, reduced table columns |
| `< 768px` | Single content column, compact header, prioritized rows instead of wide tables |

### 9.2 Mobile priorities

All Companies mobile rows show:

1. Company and domain.
2. Organic traffic and 30-day change.
3. Authority and AI benchmark gap.
4. Freshness.

Additional fields open in a row disclosure. The market map becomes a full-width panel above the company list. Attention signals become a horizontal snap list with one complete signal per viewport.

Company Detail mobile behavior:

- Workspace tabs scroll horizontally and remain keyboard accessible.
- KPI ledger becomes a two-column grid with shared dividers.
- Charts remain full width and use a minimum readable height.
- Battlecard prose becomes one column.
- Evidence trace preserves the return link and claim context.

## 10. Content language

- Use concrete nouns and active verbs.
- Name actions by their result: `Clear filters`, `View evidence`, `Publish approved`, and `Retry refresh`.
- Use `observed sample` wherever keyword coverage is incomplete.
- Use `estimated` for provider figures that are not direct measurements.
- Use `agent interpretation` for generated conclusions.
- Do not describe confidence as certainty.
- Avoid promotional language, clever labels, and unexplained acronyms.

## 11. Accessibility requirements

- Meet WCAG AA contrast for text, controls, charts, and states.
- Maintain visible focus on every interactive control.
- Provide skip navigation and semantic landmarks.
- Preserve a logical heading order within every workspace tab.
- Support keyboard operation for filters, tabs, tables, tooltips, and market-map points.
- Use live regions for completed refreshes and filter-result counts, not for continuous updates.
- Associate errors with the affected controls and explain recovery.
- Never rely on color, position, or icon shape alone to communicate meaning.
- Keep touch targets at least `44px` where the mobile layout permits direct interaction.

## 12. Required interface states

Both primary screens require these fixtures and tests:

- Populated and current.
- Loading from an empty cache.
- Refreshing while the last successful data remains visible.
- Stale but usable.
- Partial company failure.
- Complete refresh failure with last successful data.
- Empty data source.
- No filter results.
- Paid activity absent.
- Insight review required.
- Published insight plus newer review candidate.
- Evidence fingerprint mismatch.

Skeletons match the final component geometry. Generic centered spinners are not used for full-screen loading.

## 13. Implementation acceptance criteria

The interface system is implemented successfully when:

1. Both screens use the approved landscape-led and workspace-tab hierarchies.
2. Carbon is the only component-system dependency.
3. All colors, spacing, type, radii, and layers resolve through semantic tokens.
4. Measured values, calculations, and agent interpretations remain visually distinct.
5. Evidence links open the Evidence tab at the correct supporting records and return to the originating claim.
6. The All Companies filters update KPIs, map, signals, and leaderboard consistently.
7. Keyboard and screen-reader users can operate every primary workflow.
8. Desktop, tablet, and mobile layouts pass the stated responsive rules.
9. Loading, partial, stale, empty, review, and failure states are component-tested.
10. No screen depends on decorative gradients, generic card grids, excessive shadows, or animation for identity.

## 14. Mockup decisions

The local visual-companion session established these decisions:

- Selected home hierarchy: Landscape-led.
- Selected company-detail hierarchy: Battlecard as a workspace tab.
- Rejected alternative: Evidence as a permanently open right rail.

The generated browser mockups are exploratory references under `.superpowers/brainstorm/`. This document is the authoritative implementation source.
