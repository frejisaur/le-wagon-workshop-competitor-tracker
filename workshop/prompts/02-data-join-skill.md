# Prompt 2 - Refine the data-join skill (segment 3, starts Lane A)

Paste into Claude Code first thing in segment 3, then move on to the exports:

```text
In a background subagent: improve workshop/starters/data-join/SKILL.md so another agent could join an
Apollo CSV with an Apify Semrush export safely. Add only what is missing:
1. how websites are normalized and what counts as the join key,
2. the observed / calculated / inferred classification step,
3. which rows are rejected and how they are reported,
4. the exact verification command and the counts to check.
Keep it under 60 lines. Point to references instead of copying them.
Do not edit .agents/skills/. Return only the line count and the four headings.
```

When Lane A returns (before the dry run), show convergence on screen:

```sh
diff workshop/starters/data-join/SKILL.md .agents/skills/competitor-data-contracts/SKILL.md
```

**Point out**: the production skill is the same idea after weeks of real failures. Skills grow from incidents, not from imagination.
