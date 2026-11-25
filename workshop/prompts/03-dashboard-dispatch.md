# Prompt 3 - Dispatch the dashboard builder (segment 4, starts Lane B)

First fill the two `<!-- live -->` lines in `workshop/context/dashboard-brief.md` with the room's choice. Then paste:

```text
Dispatch the dashboard-builder agent in the background with this task packet:

Outcome: restyle the existing All Companies screen to match
workshop/design/option-<X>.html, following workshop/context/dashboard-brief.md.
Owned files: components/landscape/** and the landscape blocks in
styles/globals.scss, as scoped in the brief. components/shared/** is read-only.
Non-goals: no API, data-shape, identity, or deployment changes; no new data.
References: the brief, the chosen option file, docs/gtm-competitor-intelligence-design-system.md.
Proof before returning: npx vitest run tests/components and npx tsc --noEmit pass.
Return at most 10 lines: changed files, what changed in the hierarchy, states
checked, test results, anything you could not match.
```

**Point out**: a bounded packet gives you outcome, ownership, references, proof and return format. Then go back to teaching; do not watch it work.
