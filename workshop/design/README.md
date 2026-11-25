# All Companies design directions

Three directions for the All Companies screen, for the room to vote on, plus one reference for Company Detail. Every direction uses the same data, components and design tokens (`styles/tokens.css`, `docs/gtm-competitor-intelligence-design-system.md`). Only hierarchy, layout, emphasis and density change. No new data fields are introduced.

## How to open

Each file is self-contained static HTML: inline CSS, no build step, no external JavaScript. Fonts load from Google Fonts (IBM Plex); the files fall back to system fonts offline.

```bash
open workshop/design/option-a.html   # macOS; or drag any file into a browser
```

The files work at desktop width (1440px is the reference) and down to 375px. Resize the window to see the mobile layout. Company names in a table or signal link to `company-detail.html`.

## Shared across all options

- **Data:** the fixture companies Alpha, Bravo and Charlie (`tests/fixtures/api/dashboard-states.ts`, with Charlie fully `Not available`), plus Delta through Hotel. These five have the same shape and are added so density is visible. The E2E fixture renders 3 rows; the mockups render 8. KPIs, map positions, traffic share and the signal ranking are computed with the same rules as `selectors.ts` and `MarketMap.tsx`. That includes the 5-signal cap and the priority order AI > growth > paid > non-brand.
- **Classification:** every metric carries its label. A filled square means observed (a provider value), an outlined square means calculated (a deterministic calculation), and a blue diamond means inferred (an agent interpretation). Shape and text always appear together, so color is never the only cue. On All Companies, inferred appears only in the legend, because inferred values live in Company Detail.
- **Coverage:** KPI aggregates show `7 of 8 reporting` where a company is missing values. This reads the `coverage` field that `LandscapeScreen.aggregate()` already returns.
- **Unchanged rules:** the KPI ledger stays one continuous region, investigation blue is the only accent, modules have rule tops and no shadows, the selected row has an accent-subtle fill and a 2px edge, and unknown values read `Not available`.

## Option A: Portfolio ledger

- **Decision it serves:** "Which competitors should I review this week, ranked by size and momentum?"
- **Hierarchy:** heading and legend, then filters. Next comes the **portfolio ledger**: the KPI ledger joined directly onto the full-width leaderboard in one surface with an ink top rule, so the KPIs read as the totals of the table. A "Context" row follows, with the market map (2fr) and attention signals (1fr). On mobile, the KPI grid comes first, then the prioritized company rows, then the map, then the signals as a snap list.
- **Trade-off:** this is the fastest route into Company Detail and the strongest for comparing companies side by side. Positioning and signals drop below the fold, so a mover with low traffic (Echo, +22.5%) ranks near the bottom. On mobile this departs from design-system 9.2, which puts the map above the company list.
- **Components touched:**
  - `LandscapeScreen.tsx`: module order, a ledger wrapper around `KpiLedger` and `CompanyLeaderboard`, the context row, and the classification legend.
  - `KpiLedger.tsx`: a coverage line.
  - `CompanyLeaderboard.tsx`: two-line headers with classification, and a mobile classification key in place of per-row tags.
  - `styles/globals.scss`: the `.kpi-ledger`, `.landscape-modules` and `.company-leaderboard` rules.
  - `MarketMap.tsx` and `AttentionSignals.tsx`: CSS only.

## Option B: Market map first

- **Decision it serves:** "Where does each competitor sit, and who is moving toward our position?"
- **Hierarchy:** heading, filters and a compact KPI strip come first. The **market map** is the dominant module: 460px tall with direct point labels. Next to it is a **selected-company inspector** that keeps the existing tooltip content visible, adds the selected company's signals, and has an `Open Alpha` action. Below that, attention signals run as a five-column row, then a reduced leaderboard with authority, traffic, change, non-brand share, paid activity and AI gap. On mobile the map comes first, then the inspector, the signals snap list and the company rows.
- **Trade-off:** this is the best view of clusters, outliers and whitespace, and it fits a room that thinks in positioning. It relies on reading a log-scale chart. Charlie and any company with missing axis values disappears from the hero; only a note mentions it. Exact numbers sit one step away.
- **Components touched:**
  - `MarketMap.tsx`: direct labels, a height token, and the inspector, which reuses the tooltip `dl` and the `selectedCompany` prop.
  - `AttentionSignals.tsx`: a row layout, and a filter by the selected company for the inspector list.
  - `KpiLedger.tsx`: a compact variant (CSS).
  - `CompanyLeaderboard.tsx`: column visibility classes.
  - `LandscapeScreen.tsx`: order, and passing signals to the map.
  - `styles/globals.scss`: `--landscape-map-min-height` and the module grid.

## Option C: Attention inbox

- **Decision it serves:** "What changed that I should investigate today?"
- **Hierarchy:** the heading summarizes the signal count, then filters. A **"Needs attention" inbox** takes the main column. It shows the 5 ranked signals at large size, each with the company, the reason, the value with its period, observed authority and traffic for context, and an explicit `Open <workspace>` action. Below them is a footnote on hidden signals and data gaps. A right rail holds the portfolio totals as a vertical ledger and a compact map. The full leaderboard sits below. On mobile the order is inbox, totals, map, then company rows. The inbox stays a vertical list, which departs from the horizontal snap list in 9.2 because it is the primary content here.
- **Trade-off:** this direction is the most action-oriented and the easiest to demo. Its quality depends entirely on the signal ranking. The fixed priority and the 5-signal cap mean three of the five slots are AI outperformance (Foxtrot at +3% outranks Delta's growth), and lower-ranked signals stay hidden. Quiet but large competitors get little attention.
- **Components touched:**
  - `AttentionSignals.tsx`: the inbox layout, the action label from the existing `workspace` map, and the authority and traffic context line from `CompanySummary`.
  - `KpiLedger.tsx`: a stacked variant (CSS).
  - `MarketMap.tsx`: a compact height.
  - `LandscapeScreen.tsx`: a two-column top grid.
  - `styles/globals.scss`.

## Company Detail reference (`company-detail.html`)

This file is not up for the vote. It shows the approved workspace hierarchy so the chosen direction stays consistent with Company Detail:

- The identity header, statuses and company switcher, followed by the KPI ledger with an observed value and its calculated movement.
- Workspace tabs, with Battlecard and Evidence as siblings.
- **Frame 1, Battlecard:** the review-required notice, the published conclusion (inferred, high confidence), the `2 linked observations` trace origin, observed findings, inferred recommendations, the evidence summary, and the generation metadata with the fingerprint check.
- **The five-step claim-to-evidence trace**, including the URL shape `/companies/alpha?tab=evidence&claim=claim-search-strength`.
- **Frame 2, Evidence:** opened from the claim, with `Return to claim`, both supporting records highlighted, and the run metadata.

Data comes from `tests/fixtures/api/company-states.ts` (`publishedPlusReview`).

## Known limitations

- Map tick labels (24, 36, 48, 59, 71) copy the current evenly spaced tick logic. Rounded ticks would read better in every option.
- The mockups are static. Sorting, filtering and map-to-row selection are shown in their selected state, not wired up.
