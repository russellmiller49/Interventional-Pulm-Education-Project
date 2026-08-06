# Local-only V3 raw-result validation and merge handoff

> Artifact category: `operator_only`. Never upload or paste this file into a classification
> conversation. This is a local operator handoff, not a model prompt.

Keep every returned CSV byte-for-byte unchanged and run the repository's deterministic local
commands:

```text
npm run literature:validate-gold-enrichment-v3-results -- \
  --run-dir {{RUN_DIRECTORY}} \
  --results-dir {{RAW_RESULTS_DIRECTORY}} \
  --output-dir {{VALIDATION_OUTPUT_DIRECTORY}}

npm run literature:merge-gold-enrichment-v3-raw-results -- \
  --run-dir {{RUN_DIRECTORY}} \
  --results-dir {{RAW_RESULTS_DIRECTORY}} \
  --output-dir {{RAW_MERGE_OUTPUT_DIRECTORY}}
```

## Contract

- Workflow schema version: `3.0.0`
- Prompt template version: `3.0.1`
- Raw result schema version: `3.0.1`
- Raw merge schema version: `1.0.0`
- Taxonomy version: `2.0.0`
- Enrichment label schema version: `2.0.0`
- Enrichment artifact schema version: `2.0.0`

Validation must match packet ID, packet family, source projection hash, source row hash,
`master_row_id`, and PMID; enforce exact packet coverage and row order; and reject missing,
duplicate, extra, changed, unsupported, partial, or version-mismatched rows.

Invalid returned files remain immutable raw evidence. Do not edit, normalize, alias-resolve, infer,
or silently correct them. Obtain a new result file if necessary. Raw merge must not proceed until
all packet families have complete validated coverage. It combines the validated result fields into
one deterministic union-column CSV, preserves every raw value and the raw model request, and adds
only blank cells for columns that do not exist in a packet family's result schema.

A model must not validate or merge results. These commands may read local checksum and provenance
controls solely to validate the preparation, but they do not read coordinator overlay, review
evidence, or decision inputs such as prior enrichment, external-QA evidence, a taxonomy-upgrade
plan, or relevance concerns. They do not apply suggestions, change enrichment values, or determine
a review cohort. This handoff ends after raw-result validation and raw merge. Any later coordinator
merge, overlay, review-cohort, or readiness operation is local-only and outside this file.
