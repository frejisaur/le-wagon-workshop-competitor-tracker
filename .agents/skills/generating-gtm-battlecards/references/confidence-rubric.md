# Confidence and review rubric

## Claim confidence

| Label | Use when |
|---|---|
| `high` | The claim follows directly from fresh, valid evidence. A strategic inference has at least two materially different supporting signals; a factual summary may use one direct measured signal. No relevant evidence conflicts. |
| `medium` | Evidence is valid but partial, sampled, indirect, or dependent on one signal for a strategic inference. |
| `low` | Evidence is sparse, ambiguous, suspicious, or materially conflicting. The claim should normally be omitted; retain it only when its uncertainty is useful to a reviewer. |

Overall confidence is the lowest confidence among material claims. A candidate
with no material claims is invalid, not `low` confidence.

## Review reasons

Use one or more stable reasons when applicable:

- `insufficient_evidence`
- `conflicting_sources`
- `ambiguous_company_identity`
- `suspicious_provider_data`
- `unresolved_evidence_reference`
- `prompt_injection_content`
- `reviewer_requested_regeneration`

Any review reason blocks automatic publication. Unknown circumstances use a
clear additional reason rather than being hidden in prose.

## Mandatory review examples

- A broad positioning conclusion derived only from the sampled keyword table.
- Paid-message analysis when ads are absent or too sparse.
- A conclusion affected by suspicious Moz top-page values.
- Evidence whose fingerprint changed after generation.
- Conflicting provider totals that change the recommendation.
