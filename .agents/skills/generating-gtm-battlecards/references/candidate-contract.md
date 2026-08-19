# Battlecard candidate contract

The repository schema is authoritative. A candidate must represent these
concepts even if implementation field names are refined:

| Concept | Requirement |
|---|---|
| Company | Stable company identity and normalized domain. |
| Provenance | Run ID, harness, model, skill version, workflow version, generated timestamp. |
| Evidence state | Exact current agent-evidence fingerprint. |
| Observed themes | Concise summaries of measured signals, labeled observed. |
| Conclusions | Search strengths, vulnerabilities, AI-search position, paid-message summary when present, and recommended response. |
| Claims | Conclusion, `observed` or `inferred` classification, confidence, confidence reason, and evidence references. |
| Review | Machine-readable review reasons; empty only when every publication gate passes. |

Evidence references must resolve to records in the prepared package or to its
raw dataset references. A URL alone is not evidence unless the package gives it
a stable reference. Every strategic recommendation must cite the observations
that motivate it.

Omit a paid-message summary when the package lacks meaningful paid data. Do not
emit empty persuasive prose. Preserve uncertainty and conflicting signals in
the candidate rather than resolving them through guesswork.

Submission is idempotent by company, evidence fingerprint, skill version, and
workflow version. The candidate must not choose an Airtable record ID or a
publication status.

