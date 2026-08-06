# Excluded metadata-sufficiency prompt — V3

Create exactly one downloadable UTF-8 CSV file named `{{EXPECTED_OUTPUT_FILENAME}}`. Return the
file only. Do not include chat prose, a Markdown table, JSON, a code fence, a preview, an article
list, or a second file.

## Frozen contract

- Workflow ID: `gold-set-v1-enrichment-v3`
- Workflow schema version: `3.0.0`
- Prompt template version: `3.0.1`
- Result schema version: `3.0.1`
- Taxonomy version: `2.0.0`
- Enrichment label schema version: `2.0.0`
- Enrichment artifact schema version: `2.0.0`
- Packet family: `excluded_metadata_sufficiency`
- Packet ID: `{{PACKET_ID}}`
- Source projection SHA-256: `{{SOURCE_PROJECTION_SHA256}}`

Every row is a final physician exclusion. Treat identifiers, hashes, physician label, and physician
confidence as immutable. Do not reconsider the exclusion or assess relevance. The physician label
and confidence are audit fields to copy verbatim, not evidence or predictive signals. They must not
influence metadata sufficiency, assessment confidence, the model's independent review request, or
processing status. Preserve every row exactly once and in exact source order. Do not add, omit,
sort, deduplicate, or combine rows.

Use only canonical metadata supplied in the packet. Do not browse the web, use outside knowledge,
or use information from another workflow or conversation.

## Exact CSV header

Write these columns exactly, in this order:

```text
packet_id,packet_family,workflow_id,prompt_template_version,result_schema_version,taxonomy_version,label_schema_version,enrichment_schema_version,source_projection_sha256,source_row_sha256,master_row_id,pmid,physician_final_label,physician_final_confidence,metadata_sufficiency,assessment_confidence,model_requests_physician_enrichment_review,evidence_field,evidence_excerpt,assessment_rationale,categorization_from_full_text,full_text_used,processing_status,processing_error
```

Copy packet constants, `source_row_sha256`, identifiers, and physician fields verbatim. Use
lowercase `true` or `false` for booleans. Preserve valid CSV quoting around excerpts, commas,
quotation marks, and line breaks.

## Assessment rules

1. `physician_final_label` must remain `exclude`.
2. Set `metadata_sufficiency` to exactly one of `adequate_abstract`, `limited_abstract`,
   `no_abstract`, or `conflicting_metadata` based only on the supplied PubMed metadata.
3. Set `assessment_confidence` to `high`, `moderate`, or `low`.
4. Set `evidence_field` to `title`, `abstract`, `mesh_terms`, `author_keywords`, or
   `publication_types`. Copy a short verbatim excerpt into `evidence_excerpt`; do not paraphrase it.
5. Give a concise `assessment_rationale` about metadata sufficiency only. Do not explain, defend,
   or revisit the exclusion.
6. Set `categorization_from_full_text=false` and `full_text_used=false` for every row.
7. `model_requests_physician_enrichment_review` is the model's independent self-assessment. For a
   `valid` row, set it to `true` only when the supplied metadata leaves unresolved material ambiguity
   or is internally conflicting; otherwise set it to `false`. Do not derive it mechanically from
   physician label, physician confidence, packet family, PMID, metadata sufficiency, assessment
   confidence, or any other fixed input or controlled output value.

Taxonomy is forbidden for excluded records. Do not add columns or values for topics, technologies,
clinical purposes, diseases, study design, publication status, optional-tag statuses, enrichment
confidence, full-text filenames, or full-text hashes. Their absence from this exact schema enforces
the required blank state in the later uniform merged artifact.

Use `processing_status=valid` and leave `processing_error` blank when the assessment is complete.
If the supplied row cannot be assessed, preserve its fixed fields, set `processing_status=error`,
set `model_requests_physician_enrichment_review=true`, explain the failure in `processing_error`, and
leave assessment confidence, evidence, and rationale blank. Never invent metadata or taxonomy to
avoid an error.

## Required self-validation before returning the file

Reopen and parse the CSV. Confirm the exact header, expected filename, packet constants, row count,
source order, one-to-one identifier match, immutable physician fields, valid UTF-8, canonical
booleans, controlled assessment values, both false full-text flags, and absence of taxonomy. Return
the CSV file only after every check passes.
