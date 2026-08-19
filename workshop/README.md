# Live competitor-tracker workshop

A 90-minute, instructor-led Claude Code 101 workshop for marketers. We reverse-reveal the deployed competitor tracker, unpack how context is assembled through skills, focused agents, MCPs, and CLI commands, then replay the data join, Airtable serving layer, UI design, Railway deployment, and scheduled refresh.

The default rehearsal is fixture-first. Live provider and deployment mutations require instructor approval. Attendees watch a prepared environment, receive the GitHub repository, and can replay from annotated checkpoints after the recording.

## Instructor order

1. [Credentials](credentials.md) and [preflight](preflight.md)
2. [Run of show](run-of-show.md) and [speaker script](speaker-script.md)
3. Exact [prompts](prompts/) and compact [context packets](context/)
4. [Visual options and references](design/)
5. [Checkpoint recovery](checkpoints.md) and [replay](replay.md)

Requirements: Node 22, Claude Code Pro, Git, a prepared local app, and—only for live paths—authorized Airtable, Apify, and Railway tools. Run `npm run workshop:verify` before presenting.
