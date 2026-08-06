# Local-only V3 result validation and merge handoff prompt

Create exactly one downloadable UTF-8 plain-text file named
`gold-set-v1-enrichment-v3-local-merge-instructions.txt`. Return the file only. Do not include chat
prose, a Markdown table, JSON, a code fence, an article list, a merged CSV, a corrected result, or a
second file.

The text file must instruct the operator to keep every returned CSV byte-for-byte unchanged and run
the repository's local deterministic commands:

```text
npm run literature:validate-gold-enrichment-v3-results -- \
  --run-dir {{RUN_DIRECTORY}} \
  --results-dir {{RAW_RESULTS_DIRECTORY}} \
  --output-dir {{VALIDATION_OUTPUT_DIRECTORY}}

npm run literature:merge-gold-enrichment-v3 -- \
  --run-dir {{RUN_DIRECTORY}} \
  --results-dir {{RAW_RESULTS_DIRECTORY}} \
  --source {{CANONICAL_SOURCE_CSV}} \
  --prior-enrichment {{PRIOR_ENRICHMENT_CSV}} \
  --qa-findings {{EXTERNAL_QA_FINDINGS_CSV}} \
  --upgrade-plan {{TAXONOMY_V2_UPGRADE_PLAN_JSON}} \
  --output-dir {{MERGE_OUTPUT_DIRECTORY}}

npm run literature:build-gold-enrichment-v3-review -- \
  --run-dir {{RUN_DIRECTORY}} \
  --merge-dir {{MERGE_OUTPUT_DIRECTORY}} \
  --output-dir {{REVIEW_OUTPUT_DIRECTORY}}

npm run literature:audit-gold-enrichment-v3-readiness -- \
  --merge-dir {{MERGE_OUTPUT_DIRECTORY}} \
  --review-dir {{REVIEW_OUTPUT_DIRECTORY}} \
  --output-dir {{READINESS_OUTPUT_DIRECTORY}} \
  --required-review {{REQUIRED_REVIEW_DECISIONS_CSV}} \
  --qc-review {{QC_REVIEW_DECISIONS_CSV}} \
  --protocol-authorization {{PROTOCOL_AUTHORIZATION_JSON}}
```

The last three readiness paths are optional CLI overrides. Use the generated required-review and
QC companion CSV paths when decisions are supplied, and include the authorization path only after
an explicit protocol-acceptance authorization file exists. Otherwise omit the corresponding
optional flag rather than inventing a file.
The authorization JSON must bind the merged CSV, review-cohort receipt, completed required-review
CSV, completed QC CSV, and protocol-candidate membership hashes and must set
`authorized_after_qc=true`; see the workflow document for the exact shape.

The text file must also state all of the following:

1. Workflow, prompt, and result schema versions are `3.0.0`; taxonomy, enrichment label schema, and
   enrichment artifact schema versions are `2.0.0`.
2. Validation must match packet ID, packet family, source projection hash, source row hash,
   `master_row_id`, and PMID; enforce exact packet coverage and row order; and reject missing,
   duplicate, extra, changed, unsupported, partial, or version-mismatched rows.
3. Invalid returned files remain immutable raw evidence. Do not edit, normalize, alias-resolve,
   infer, or silently correct them. Obtain a new result file if necessary.
4. A model must not merge results, adjudicate disagreements, apply QA suggestions, apply taxonomy
   upgrade candidates, change physician relevance, create import rows, or access a database.
5. External-QA and taxonomy-upgrade evidence may be overlaid only after independent V3 results are
   locally validated and merged, and only as review flags.
6. The local merge must not proceed until all packet families have complete validated coverage. It
   must produce deterministic reports and a non-import-ready candidate artifact under ignored
   `local-data`.
7. Review construction must use the checksum-bound run and merge outputs. In required-review and
   QC companion CSVs, only the physician decision fields are editable, including
   `physician_metadata_sufficiency`; fixed source, proposal, and post-proposal concern fields are
   reconstructed locally and any change is rejected.
8. Readiness must use the merge and review directories, validate supplied decision CSVs and any
   explicit protocol authorization, and remain non-import-ready unless every gate passes.

Do not inspect uploaded result contents or propose corrections. This prompt creates local-command
instructions only; it does not authorize a model-based merge.
