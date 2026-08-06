# Included complete-full-text enrichment prompt — V3

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
- Packet family: `included_full_text`
- Packet ID: `{{PACKET_ID}}`
- Source projection SHA-256: `{{SOURCE_PROJECTION_SHA256}}`

Treat every identifier, packet field, source hash, file identity, physician relevance label, and
physician relevance confidence as immutable. Do not reconsider relevance. The physician label and
confidence are audit fields to copy verbatim, not evidence or predictive signals. They must not
influence metadata sufficiency, taxonomy values, tag statuses, study design, publication status,
enrichment confidence, the model's independent review request, or processing status. Preserve every
packet row exactly once and in exact source order. Do not add, omit, sort, deduplicate, or combine
rows.

Use only the canonical metadata in the packet and the exact complete-full-text files uploaded with
it. Do not browse the web, retrieve another record, use outside knowledge, infer missing pages, or
use information from another workflow or conversation.

## Verify the evidence files before classification

For each row, match the uploaded file by expected filename, PMID, title/article identity, and
manifest SHA-256 when checksum tools are available. Fail closed for any missing, duplicate,
ambiguous, unreadable, truncated, partial, citation-only, or mismatched file. A title page, abstract
page, citation page, or incomplete publisher document is not complete full text. Never substitute
one row's file for another.

## Exact CSV header

Write these columns exactly, in this order:

```text
packet_id,packet_family,workflow_id,prompt_template_version,result_schema_version,taxonomy_version,label_schema_version,enrichment_schema_version,source_projection_sha256,source_row_sha256,master_row_id,pmid,physician_final_label,physician_final_confidence,metadata_sufficiency,topic_ids,technology_tags,technology_tag_status,clinical_purposes,disease_tags,disease_tag_status,study_design,publication_status,categorization_from_full_text,full_text_used,full_text_filename,full_text_sha256,enrichment_confidence,model_requests_physician_enrichment_review,evidence_1_field,evidence_1_excerpt,evidence_1_location,evidence_2_field,evidence_2_excerpt,evidence_2_location,enrichment_rationale,processing_status,processing_error
```

Copy packet constants, `source_row_sha256`, identifiers, physician fields, expected filename, and
expected file SHA-256 verbatim. Use lowercase `true` or `false` for booleans. Use `|` between
multiple controlled IDs, with no surrounding spaces; do not use JSON arrays. Preserve valid CSV
quoting around excerpts, commas, quotation marks, and line breaks.

## Complete V2 controlled-value catalog

Use only these case-sensitive IDs.

`topic_ids` — one or more broad roots:

```text
basic-bronchoscopy
ebus-mediastinal-staging
peripheral-navigation
peripheral-biopsy-localization
central-airway-obstruction
airway-stents-stenosis
pleural-interventions
bronchoscopic-lung-volume-reduction
persistent-air-leak-fistula
transbronchial-cryobiopsy
hemoptysis-airway-bleeding
tracheostomy-airway-access
bronchoscopic-tumor-ablation
other-advanced-bronchoscopy
safety-anesthesia-complications
education-simulation-quality
ai-imaging-technology
adjacent-surgical-procedural-analogue
specimen-adequacy-molecular-pathology
health-services-economics
```

Taxonomy child IDs are display-only and must not appear in `topic_ids`.

`technology_tags` — zero or more:

```text
convex-ebus
eus-b
radial-ebus
robotic-bronchoscopy
electromagnetic-navigation
cone-beam-ct
augmented-fluoroscopy
virtual-bronchoscopy
transbronchial-cryobiopsy
endobronchial-valve
airway-stent
rigid-bronchoscopy
electrocautery
argon-plasma-coagulation
laser
cryotherapy
photodynamic-therapy
brachytherapy
indwelling-pleural-catheter
medical-thoracoscopy
bronchial-thermoplasty
whole-lung-lavage
percutaneous-tracheostomy
thoracentesis
chest-tube
pleurodesis
bronchoalveolar-lavage
conventional-tbna
rapid-on-site-evaluation
endobronchial-coils
balloon-bronchoplasty
mediastinal-cryobiopsy
foreign-body-removal
bronchial-artery-embolization
narrow-band-imaging
autofluorescence-bronchoscopy
confocal-laser-endomicroscopy
topical-hemostatic-agent
transbronchial-thermal-ablation
surgical-vats
```

`clinical_purposes` — one or more:

```text
diagnosis
staging
treatment
palliation
surveillance
localization
training
safety-complication-prevention
multiple-general-overview
not-assessable-from-available-metadata
cost-effectiveness-health-services
specimen-adequacy
workflow-operations-quality
```

`disease_tags` — zero or more:

```text
lung-cancer
mesothelioma
emphysema
interstitial-lung-disease
immune-inflammatory-disease
infection
transplant
benign-airway-stenosis
pleural-disease
lymphoma-hematologic-malignancy
metastatic-extrathoracic-malignancy
tracheobronchomalacia-edac
asthma
foreign-body-aspiration
hemoptysis
bronchiectasis
pulmonary-alveolar-proteinosis
airway-amyloidosis
congenital-airway-disorder
```

`study_design` — exactly one:

```text
randomized-trial
prospective-cohort
retrospective-cohort
diagnostic-accuracy
systematic-review
meta-analysis
guideline
consensus
case-series
case-report
technical-note
editorial
review-article
not-assessable-from-available-metadata
cross-sectional-survey
economic-evaluation
animal-preclinical
bench-in-vitro
qualitative-study
case-control
```

`publication_status` — exactly one:

```text
full-article
conference-abstract
letter
editorial
correction
retraction
protocol
interactive-clinical-case
not-assessable-from-available-metadata
```

Other controlled values:

- `metadata_sufficiency`: `adequate_abstract`, `limited_abstract`, `no_abstract`, or
  `conflicting_metadata`.
- `technology_tag_status` and `disease_tag_status`: `tagged`, `not_applicable`, or
  `not_assessable`.
- `enrichment_confidence`: `high`, `moderate`, or `low`.
- `processing_status`: `valid` or `error`.

## Classification rules

For every `valid` row:

1. Assign at least one broad `topic_ids` value and one `clinical_purposes` value, exactly one
   `study_design`, and exactly one `publication_status`.
2. Nonempty optional tags require status `tagged`; an empty optional-tag field requires
   `not_applicable` or `not_assessable`. Never emit `legacy_unspecified`, aliases, child topic IDs,
   or free text in controlled fields.
3. Set `full_text_used=true` and `categorization_from_full_text=true` only after the exact complete
   file passes the evidence checks above.
4. Preserve `metadata_sufficiency` as an assessment of the supplied PubMed metadata. `no_abstract`
   remains `no_abstract`, and `limited_abstract` remains `limited_abstract`, even when complete full
   text resolves the taxonomy.
5. `evidence_1_field` must be `full_text`. Provide a short verbatim excerpt and an exact page plus
   section, heading, table, or figure location. A second short excerpt may come from `full_text`,
   `title`, `abstract`, `mesh_terms`, `author_keywords`, or `publication_types`. Do not paraphrase
   excerpts.
6. Give a concise rationale grounded only in the recorded evidence.

`model_requests_physician_enrichment_review` is the model's independent self-assessment. For a
`valid` row, set it to `true` only when the supplied article evidence leaves unresolved material
ambiguity or is internally conflicting; otherwise set it to `false`. Do not derive it mechanically
from any immutable input field or controlled output value, including physician label, physician
confidence, packet family, PMID, the presence of complete text, metadata sufficiency, enrichment
confidence, optional-tag status, study design, or publication status. The flag does not determine
any final review cohort and must never alter relevance.

If any evidence check fails, preserve the row and fixed fields, expected filename, and expected
hash; set `processing_status=error`, explain the exact failure in `processing_error`, set
`model_requests_physician_enrichment_review=true`, leave classification/evidence/rationale fields blank,
and set `full_text_used=false` and `categorization_from_full_text=false`. Do not fall back to a
partial document or outside source and do not fabricate a classification.

## Required self-validation before returning the file

Reopen and parse the completed CSV. Confirm the exact header, filename, packet constants, row count,
source order, one-to-one identifier match, immutable physician fields, file identities, valid
UTF-8, canonical booleans, controlled values, optional-tag statuses, evidence excerpts and
locations, and full-text flags. Return the CSV file only after every check passes.
