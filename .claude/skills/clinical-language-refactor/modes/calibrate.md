# Mode: calibrate — add or refresh source-grounded vocabulary

No application edits. Read `SKILL.md`, the editorial standard, the transcript-calibration rules and
the existing profile for the domain.

1. Work only on the sources supplied for this task. Don't search unrelated private files or fetch
   missing recordings. Keep the raw files unchanged, in the private source folder described in
   `references/transcript-calibration.md`.
2. Build or update the source map: file, SHA-256, line count, episode boundaries, line ranges,
   local timestamps, and explicit metadata only. A timestamp is unique only within its episode. The
   optional indexer helps; it is a structural aid, not validation or de-identification.
3. For each topic, read enough of the surrounding teaching and the later qualifications and Q&A.
   Extract terms, accepted aliases, the contextual definitions the sources support, and how
   findings, uncertainty and reassessment are phrased.
4. Keep raw and normalized expressions apart (exact, editorial or uncertain). Never guess a drug,
   device, number, unit or unseen image finding. Keep editorial confidence separate from the status
   of any clinical claim, and keep authorship on named frameworks and local practice.
5. Flag contradictions, historical claims, advertisements, numeric heuristics, safety-sensitive
   claims and illustrative cases that must not become general teaching. Resolve none of them here.

Deliver:

- **Private, outside the repository**: the source map, the review-coverage log, and the
  terminology sheet with its raw expressions.
- **Committable**: profile additions shown against the prior entries and marked `draft` — never
  overwriting owner-approved wording; authored illustrative examples labeled as such; the queue of
  uncertain normalizations and claims; the coverage gaps. Normalized terms and locators only.
- A closing statement of what the new material can and cannot support in a later E0/E1 pass.
