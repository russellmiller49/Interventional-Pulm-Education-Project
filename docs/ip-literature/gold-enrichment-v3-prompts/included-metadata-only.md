# Included metadata-only enrichment prompt — V3

Create exactly one downloadable UTF-8 CSV file named `{{EXPECTED_OUTPUT_FILENAME}}`. Return the
file only. Do not include chat prose, a Markdown table, JSON, a code fence, a preview, an article
list, or a second file.

## Frozen contract

- Workflow ID: `gold-set-v1-enrichment-v3`
- Workflow schema version: `3.0.0`
- Prompt template version: `3.0.0`
- Result schema version: `3.0.0`
- Taxonomy version: `2.0.0`
- Enrichment label schema version: `2.0.0`
- Enrichment artifact schema version: `2.0.0`
- Packet family: `included_metadata_only`
- Packet ID: `{{PACKET_ID}}`
- Source projection SHA-256: `{{SOURCE_PROJECTION_SHA256}}`

Treat every identifier, packet field, source hash, physician relevance label, and physician
relevance confidence as immutable. Do not reconsider relevance. Preserve every input row exactly
once and in exact source order. Do not add, omit, sort, deduplicate, or combine rows.

Use only the canonical metadata supplied in the packet. Do not browse the web, retrieve another
record, use outside knowledge, infer held-out membership, or use an old enrichment file. Do not use
external-QA findings, suggested corrections, taxonomy-upgrade candidates, sampling stratum,
sampling reason, deterministic screening scores, selection rationale, or prior AI labels.

## Exact CSV header

Write these columns exactly, in this order:

```text
packet_id,packet_family,workflow_id,prompt_template_version,result_schema_version,taxonomy_version,label_schema_version,enrichment_schema_version,source_projection_sha256,source_row_sha256,master_row_id,pmid,physician_final_label,physician_final_confidence,metadata_sufficiency,topic_ids,technology_tags,technology_tag_status,clinical_purposes,disease_tags,disease_tag_status,study_design,publication_status,categorization_from_full_text,full_text_used,enrichment_confidence,requires_physician_enrichment_review,evidence_1_field,evidence_1_excerpt,evidence_1_location,evidence_2_field,evidence_2_excerpt,evidence_2_location,enrichment_rationale,processing_status,processing_error
```

Copy packet constants, `source_row_sha256`, `master_row_id`, `pmid`, `physician_final_label`, and
`physician_final_confidence` verbatim. Use lowercase `true` or `false` for booleans. Use `|` between
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

1. Assign at least one `topic_ids` value and at least one `clinical_purposes` value.
2. Assign exactly one `study_design` and exactly one `publication_status`.
3. A nonempty `technology_tags` value requires `technology_tag_status=tagged`. An empty value
   requires `not_applicable` or `not_assessable`.
4. A nonempty `disease_tags` value requires `disease_tag_status=tagged`. An empty value requires
   `not_applicable` or `not_assessable`.
5. Never emit `legacy_unspecified`, an alias, a taxonomy child ID, or free text in a controlled
   field.
6. Set `full_text_used=false` and `categorization_from_full_text=false`. A preview, title page,
   abstract page, citation page, or missing file is not full-text evidence.
7. Determine `metadata_sufficiency` from the supplied PubMed metadata only. Do not upgrade it based
   on presumed or outside full text.
8. Supply one or two short verbatim evidence excerpts from the supplied fields. Set each evidence
   field to `title`, `abstract`, `mesh_terms`, `author_keywords`, or `publication_types`, and name
   the exact source field or term in its location. Do not paraphrase an excerpt.
9. Give a concise rationale grounded only in those excerpts.

Set `requires_physician_enrichment_review=true` for every `include_adjacent` row; every `moderate`
or `low` enrichment confidence; limited, absent, or conflicting abstract metadata; either optional
tag status `not_assessable`; a not-assessable study design or publication status; multiple
materially plausible classifications; preview-only or missing-full-text evidence status; and the
two protocol-designated relevance-concern records, PMID `16043961` and PMID `26033136`. This flag
requests enrichment review and must never alter relevance; it does not authorize reconsidering the
fixed physician label.

If a row cannot be processed from the supplied metadata, preserve its fixed fields, set
`processing_status=error`, put a concise explanation in `processing_error`, set
`requires_physician_enrichment_review=true`, leave enrichment/evidence/rationale fields blank, and
keep both full-text flags `false`. Do not invent a classification to avoid an error.

## Required self-validation before returning the file

Reopen and parse the completed CSV. Confirm the exact header, expected filename, packet constants,
row count, source order, one-to-one identifier match, immutable physician fields, valid UTF-8,
canonical booleans, controlled values, optional-tag status consistency, evidence quoting, and
metadata-only full-text flags. Return the CSV file only after every check passes.
