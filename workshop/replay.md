# Replay from checkpoints

Annotated tags map the story, not hidden alternate branches:

1. `workshop/cp0-start`
2. `workshop/cp1-source`
3. `workshop/cp2-data`
4. `workshop/cp3-design`
5. `workshop/cp4-app`
6. `workshop/cp5-deployed`

Inspect a checkpoint with `git show workshop/cp3-design --stat`. Compare the transition from data to design with:

```bash
git diff workshop/cp2-data..workshop/cp3-design --stat
```

Run fixture commands from the checked-out repository and follow `workshop/run-of-show.md`. Deployment state cannot be stored in Git; prove it with `workshop/expected/railway-health-output.json`, then independently check the current service if you have authorization. Never treat the sanitized file as a live health claim.
