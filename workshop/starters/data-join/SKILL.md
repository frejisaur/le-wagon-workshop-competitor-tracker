---
name: data-join-starter
description: Use when joining an Apollo company export with an Apify Semrush export.
---

# Joining Apollo and Semrush data

Apollo is the list of companies we track. Semrush (through Apify) tells us how
each company performs in search.

## Workflow

1. Load the Apollo CSV and the Semrush JSON.
2. Match each Semrush result to its Apollo company.
3. Import the joined companies into Airtable.
