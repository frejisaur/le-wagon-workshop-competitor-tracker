# Live recovery checkpoints

Never switch branches or detach HEAD during the live session. The audience sees the prepared artifact, a spoken disclosure, and the same next command they can replay.

| Trigger | Artifact | Proof | Spoken disclosure | Resume command |
|---|---|---|---|---|
| Provider call exceeds **90 seconds** | `workshop/expected/data-join-output.json` | Sanitized fixture counts | “The live provider is slow, so I’m using the prepared output from the same validated contract.” | `npm run import:initial -- --apollo tests/fixtures/providers/apollo-sample.csv --semrush tests/fixtures/providers/semrush-sample.json --dry-run` |
| A command **fails twice** | Matching manifest fallback | Expected compact status | “We hit the rehearsed recovery threshold; this artifact keeps the lesson moving and I’ll show the failure in the replay notes.” | Open the next prompt file |
| We reach a **segment boundary** | Next segment’s primary artifact | Manifest timing | “I’m protecting the final proof block and moving to the prepared checkpoint.” | `npm run workshop:preflight -- --phase all` |
| Projected output is **unreadable** | Selected HTML/reference JSON | Large, high-contrast reference | “I’m switching to the presentation reference so everyone can inspect the same evidence.” | Open `workshop/design/selected-all-companies.html` |

For Airtable use `workshop/expected/airtable-import-output.json`; for deploy use `workshop/expected/railway-health-output.json`. Disclose every fallback immediately—never imply it is a live result.
