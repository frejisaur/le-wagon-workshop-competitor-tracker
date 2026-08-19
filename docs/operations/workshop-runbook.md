# Workshop rehearsal and recovery

All default rehearsal commands below use sanitized local fixtures and make no Airtable, Apify, or Railway request. Run them from the repository root.

## Fixture import and refresh

1. Dry-run the sample import:
   `npm run import:initial -- --apollo tests/fixtures/providers/apollo-sample.csv --semrush tests/fixtures/providers/semrush-sample.json --dry-run`
   Expect 2 accepted, 1 `missing_apollo_website` rejection, 0 provider calls, and 6 projected records. The supplied workshop roster release check remains 52 companies plus one missing-website rejection and must stay below 1,000 records.
2. Rehearse a partial refresh into a new temporary output file:
   `npm run enrich -- --provider-fixture tests/fixtures/providers/semrush-sample.json --fixture-state tests/fixtures/airtable/base-snapshot.json --output-state /tmp/ci-refresh-output.json`
   Expect one company refreshed, one company failure, a new refresh workflow ID, and preserved successful data. Never overwrite the input fixture.

## Candidate lifecycle fallback

Use a new output path for every command so retries are recoverable.

- Inspect due fixture work: `npm run insights:prepare -- --due --fixture-state tests/fixtures/insights/lifecycle-state.json`.
- Publish the high-confidence candidate: `npm run insights:submit -- tests/fixtures/insights/candidate-high.json --fixture-state tests/fixtures/insights/lifecycle-state.json --fixture-output-state /tmp/high-state.json`. Expect `published`.
- Route the conflicting low-confidence candidate from its separate prior-publication fixture: `npm run insights:submit -- tests/fixtures/insights/candidate-low-conflicting.json --fixture-state tests/fixtures/insights/low-preserves-published-state.json --fixture-output-state /tmp/low-state.json`. Expect `queued`/`Needs Review`; compare the input and output `insights` rows and confirm the different-fingerprint `rec-prior-published` row is byte-for-field identical. This is intentionally independent from `/tmp/high-state.json`: feeding the just-published high state into the low demonstration would mix two scenarios and could trigger identity/replay behavior instead of proving preservation.
- Promote an approved current review: `npm run insights:publish-approved -- --fixture-state tests/fixtures/insights/approved-current-state.json --fixture-output-state /tmp/approved-state.json`. Expect one publication.
- Refuse an approved stale review: `npm run insights:publish-approved -- --fixture-state tests/fixtures/insights/approved-stale-state.json --fixture-output-state /tmp/stale-state.json`. Expect one stale result and no replacement publication.

Then run `npm run dev -- --webpack`, open All Companies, navigate to Company Detail, open Battlecard, follow a claim to Evidence, return to the originating claim, and confirm freshness plus independent refresh and agent run IDs.

## Optional live demonstration

Live actions are never a default test. Only after explicit operator approval and a present/missing preflight may an operator run one bounded, non-production batch with `npm run enrich -- --actor-id "$APIFY_ACTOR_ID"`. State the expected company count and exit status before running it. If it is slow or unavailable, stop and use the fixture flow above. Capture sanitized before/after `System` snapshots; never include tokens, cache signatures, provider payloads, or reviewer notes. Do not perform unattended production deployment or destructive cleanup.
