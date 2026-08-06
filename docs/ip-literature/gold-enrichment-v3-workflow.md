# Gold-set V3 enrichment workflow

> Artifact category: `coordinator_only`. Never upload or paste this document into a classification
> conversation. It contains post-result policy and global workflow information that are deliberately
> absent from model-facing inputs.

## Purpose and boundary

`gold-set-v1-enrichment-v3` is a deterministic, file-based workflow for independently proposing
taxonomy V2 enrichment for the 630 `gold-set-v1` development records. It preserves the canonical
database-backed metadata source and every final physician relevance decision. It generates manual
ChatGPT packets, validates raw returned files, builds a review candidate and physician workbook,
and audits readiness without importing anything.

This workflow does not call a model or external API, dispatch a worker, mutate a database, import a
review, change active-batch versions, revise physician relevance, apply QA corrections, create
database-import rows, download full text, or access held-out identities.

## Version contract

| Contract                         | Version                     |
| -------------------------------- | --------------------------- |
| Workflow ID                      | `gold-set-v1-enrichment-v3` |
| Workflow schema                  | `3.0.0`                     |
| Prompt template                  | `3.0.1`                     |
| Raw packet result schema         | `3.0.1`                     |
| Raw merge schema                 | `1.0.0`                     |
| Merged artifact schema           | `3.0.1`                     |
| Enrichment taxonomy              | `2.0.0`                     |
| Enrichment label schema          | `2.0.0`                     |
| Enrichment artifact schema       | `2.0.0`                     |
| Historical review taxonomy       | `1.1.0`                     |
| Historical gold-set label schema | `1.1.0`                     |
| Relevance definition             | `1.0.0`                     |

Taxonomy V2 is explicitly selected and has no `latest` alias. Historical review payloads, the gold
review workspace, database RPCs, and the 35-column review import/export contract remain V1. V3
artifacts are standalone and non-importable.

Prompt template `3.0.0` and every preparation generated from it are superseded, non-executable
historical evidence. In particular, `enrichment-v3-real-prep-a`, `enrichment-v3-real-prep-b`,
`enrichment-v3-mergecheck-c`, and `enrichment-v3-mergecheck-d` must never be used for a real
classification. Preserve them unchanged for audit history. Only a corrected preparation using
prompt and raw-result schema `3.0.1` with a passing model-input independence audit is executable.

## Tracked configuration identity

| Path                                                     |  Bytes | SHA-256                                                            |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `config/literature/taxonomy.v2.json`                     | 17,864 | `078e6fca1abcf074846d7acde9a2554d1751039d31608c40a147e5ee88697c7b` |
| `config/literature/enrichment-labels.v2.json`            | 45,208 | `97d33c581b7d72b498ab33b62a2df7d042bf9c8d262d23d87c1c26347d1ec4f9` |
| `config/literature/enrichment-taxonomy-adoption.v2.json` | 68,558 | `7cc3a15f59cbf8f58fc2cc0ce3c7ed1fcd6e2f2d40646b14118ba2648ac53237` |
| `config/literature/taxonomy.v1.json`                     | 15,718 | `70bcd7aea6d9a135368a05a34bc10643bef1e42ff153a734361eaf94a86eb441` |
| `config/literature/gold-set-labels.v1.json`              |  3,594 | `554cf8b0b39d5f9be0f89566939c6336e040605dba05b0ddfa0f41c7badd7ac4` |

The run definition records the path, byte count, and exact byte hash of each selected config. The
V1 hashes are compatibility guards; V1 values are not model input.

## Canonical source fidelity

The only article-metadata authority is the ignored canonical source:

```text
local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv
```

Its expected SHA-256 is
`d2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64`. Its canonical receipt is
`enrichment-source-v2.receipt.json`, expected SHA-256
`38a0316ab5a3161bdf502a8e0c8b9c69753386862c858336f4d3e912a6ad21ef`. The protected physician
projection SHA-256 is
`90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e`.

The source contains 630 unique development records: 283 `include_core`, 75 `include_adjacent`, 272
`exclude`, and zero `uncertain`. The workflow verifies byte hashes, exact headers, membership,
source order, label/confidence counts, physician-field hash, receipt safety claims, valid UTF-8, and
zero held-out rows before packet generation. The old enrichment CSV is comparison evidence only and
must never supply article metadata.

## Immutable run definition

The canonical run definition records:

- all workflow and schema versions;
- repository commit and a clean tracked-state assertion;
- canonical source and receipt paths, bytes, hashes, and physician-field hash;
- tracked configuration paths, bytes, and hashes;
- full-text registry identity and status counts;
- QA findings and taxonomy-upgrade-plan identities;
- packet size limits, deterministic ordering, schemas, prompt hashes, and expected filenames;
- prohibited operations and explicit zero held-out identities.

It has no implicit wall-clock timestamp. A separate noncanonical execution receipt may record when
a command ran. Canonical artifacts use exclusive creation. An identical pre-existing artifact may
return `verified_existing`; a nonidentical collision fails.

## Development scopes

Physician-included records receive independent taxonomy enrichment. Physician-excluded records
receive metadata-sufficiency assessment only. Excluded rows must have blank topics, technologies,
clinical purposes, diseases, study design, publication status, tag statuses, and enrichment
confidence in the uniform merged artifact. Relevance is never reconsidered.

## Full-text evidence registry

The checksum-bound registry contains the 56 included records selected for full-text enrichment and
uses these statuses:

- `matched_complete`
- `preview_only`
- `missing`
- `ambiguous`
- `unreadable`
- `mismatch`

The expected preparation state is 50 `matched_complete`, one `preview_only`, five `missing`, and
zero in the other statuses. Complete text must match PMID and article identity. A title page,
abstract page, first-page preview, citation page, or truncated publisher preview is not complete
full text. Preview-only and missing records remain in metadata-only packets with
`full_text_used=false` and `categorization_from_full_text=false`. The five documented missing files
remain missing; the workflow neither fabricates nor downloads them. Full-text binaries remain
outside Git and are uploaded separately from packet CSVs.

For a matched-complete result, automated validation requires the exact registry filename and
SHA-256 plus a nonblank, located `full_text` excerpt. It does not pretend that arbitrary scanned or
font-encoded PDF text can be proven verbatim from CSV bytes alone. Every one of the 56 manifest
records is therefore in Required Review: the physician verifies the quoted evidence against the
checksum-bound binary. A nonblank excerpt never by itself establishes that the quotation is true.

## Packet families

| Family                          | Rows | Maximum packet size | Evidence                                     |
| ------------------------------- | ---: | ------------------: | -------------------------------------------- |
| `included_metadata_only`        |  308 |                  50 | Canonical metadata only                      |
| `included_full_text`            |   50 |                   5 | Canonical metadata plus exact complete files |
| `excluded_metadata_sufficiency` |  272 |                 100 | Canonical metadata; no taxonomy              |

Every packet has an ID, family, ordinal, row count, exact ordered identity list, source-projection
hash, CSV, operator-only receipt, fully rendered model-facing prompt path and hash, expected output
filename, and expected schema/version. Complete-full-text packets also have a packet-scoped
model-facing file manifest. Every packet bundle references each authorized model-facing input by
its `inventoryPath`. Packetization preserves canonical source order and is byte-deterministic.

Model-facing packet CSVs use family-specific allowlists. All families contain only packet/version
constants, hashes, canonical article metadata, immutable identifiers, and the immutable physician
relevance label and confidence. Only a complete-full-text packet may add its exact expected file
name and SHA-256. Model-facing packets never contain a precomputed metadata-sufficiency constraint,
registry status, selection rationale, coordinator evidence, or post-result decision.

The fixed physician label and confidence are copy-only audit fields. A model must not use them to
determine metadata sufficiency, taxonomy, optional tags, design, publication status, result
confidence, its independent review request, or processing status.

## Prompt and result rules

The tracked source templates are under `docs/ip-literature/gold-enrichment-v3-prompts/` and are
operator-only generator inputs. They must never be pasted directly. Preparation renders one
checksum-bound model-facing prompt per packet with no unresolved placeholders. Each rendered prompt
requires one downloadable CSV only, prohibits web browsing and outside knowledge, preserves exact
row order and immutable fields, selects V2 explicitly, requires verbatim supplied evidence, and
requires the model to reopen and parse its CSV before returning it.

`model_requests_physician_enrichment_review` is only the raw model self-assessment. For a valid row,
it may be true only when the supplied article evidence leaves unresolved material ambiguity or is
internally conflicting. A processing or evidence failure requires it to be true. No fixed input
field, packet family, file cohort, controlled output value, or coordinator rule may determine it.
The model never determines the final coordinator cohort.

Preparation writes a deterministic model-facing inventory and model-input independence audit. The
inventory is the sole authority for what an operator may supply in a single classification
conversation. The audit verifies exact packet columns, rendered-prompt normalization, absence of
article identifiers from prompts, packet-scoped file-manifest membership, category separation, and
forbidden coordinator content. A failing audit makes a preparation non-executable.

The inventory contains exactly 100 logical `model_facing` entries. Fifty are generated artifacts:
20 packet CSVs, 20 rendered prompts, and 10 packet-scoped complete-full-text manifests. The other 50
are checksum-bound external complete-full-text PDFs marked `external=true` and `generated=false`.
External PDFs are logical model inputs, not generated preparation artifacts; preparation neither
copies nor generates them. Each packet bundle binds its generated and external entries through
their `inventoryPath` values.

The exact result schemas are:

- `config/literature/gold-enrichment-v3/included-metadata-only-result.schema.json`
- `config/literature/gold-enrichment-v3/included-full-text-result.schema.json`
- `config/literature/gold-enrichment-v3/excluded-metadata-sufficiency-result.schema.json`
- `config/literature/gold-enrichment-v3/merged-v3.schema.json`

Multi-value CSV cells use `|` between stable IDs and no surrounding spaces. `legacy_unspecified`,
aliases, child topic IDs, duplicates, unsupported values, and silent rewrites are invalid.

## Complete V2 controlled-value catalog

The following stable IDs are the complete enrichment catalog.

- `topic_ids` (20 broad roots): `basic-bronchoscopy`, `ebus-mediastinal-staging`,
  `peripheral-navigation`, `peripheral-biopsy-localization`, `central-airway-obstruction`,
  `airway-stents-stenosis`, `pleural-interventions`, `bronchoscopic-lung-volume-reduction`,
  `persistent-air-leak-fistula`, `transbronchial-cryobiopsy`, `hemoptysis-airway-bleeding`,
  `tracheostomy-airway-access`, `bronchoscopic-tumor-ablation`,
  `other-advanced-bronchoscopy`, `safety-anesthesia-complications`,
  `education-simulation-quality`, `ai-imaging-technology`,
  `adjacent-surgical-procedural-analogue`, `specimen-adequacy-molecular-pathology`,
  `health-services-economics`.
- `technology_tags` (40): `convex-ebus`, `eus-b`, `radial-ebus`, `robotic-bronchoscopy`,
  `electromagnetic-navigation`, `cone-beam-ct`, `augmented-fluoroscopy`,
  `virtual-bronchoscopy`, `transbronchial-cryobiopsy`, `endobronchial-valve`, `airway-stent`,
  `rigid-bronchoscopy`, `electrocautery`, `argon-plasma-coagulation`, `laser`, `cryotherapy`,
  `photodynamic-therapy`, `brachytherapy`, `indwelling-pleural-catheter`, `medical-thoracoscopy`,
  `bronchial-thermoplasty`, `whole-lung-lavage`, `percutaneous-tracheostomy`, `thoracentesis`,
  `chest-tube`, `pleurodesis`, `bronchoalveolar-lavage`, `conventional-tbna`,
  `rapid-on-site-evaluation`, `endobronchial-coils`, `balloon-bronchoplasty`,
  `mediastinal-cryobiopsy`, `foreign-body-removal`, `bronchial-artery-embolization`,
  `narrow-band-imaging`, `autofluorescence-bronchoscopy`, `confocal-laser-endomicroscopy`,
  `topical-hemostatic-agent`, `transbronchial-thermal-ablation`, `surgical-vats`.
- `clinical_purposes` (13): `diagnosis`, `staging`, `treatment`, `palliation`, `surveillance`,
  `localization`, `training`, `safety-complication-prevention`, `multiple-general-overview`,
  `not-assessable-from-available-metadata`, `cost-effectiveness-health-services`,
  `specimen-adequacy`, `workflow-operations-quality`.
- `disease_tags` (19): `lung-cancer`, `mesothelioma`, `emphysema`,
  `interstitial-lung-disease`, `immune-inflammatory-disease`, `infection`, `transplant`,
  `benign-airway-stenosis`, `pleural-disease`, `lymphoma-hematologic-malignancy`,
  `metastatic-extrathoracic-malignancy`, `tracheobronchomalacia-edac`, `asthma`,
  `foreign-body-aspiration`, `hemoptysis`, `bronchiectasis`,
  `pulmonary-alveolar-proteinosis`, `airway-amyloidosis`, `congenital-airway-disorder`.
- `study_design` (20): `randomized-trial`, `prospective-cohort`, `retrospective-cohort`,
  `diagnostic-accuracy`, `systematic-review`, `meta-analysis`, `guideline`, `consensus`,
  `case-series`, `case-report`, `technical-note`, `editorial`, `review-article`,
  `not-assessable-from-available-metadata`, `cross-sectional-survey`, `economic-evaluation`,
  `animal-preclinical`, `bench-in-vitro`, `qualitative-study`, `case-control`.
- `publication_status` (9): `full-article`, `conference-abstract`, `letter`, `editorial`,
  `correction`, `retraction`, `protocol`, `interactive-clinical-case`,
  `not-assessable-from-available-metadata`.

Required topic and clinical-purpose arrays are nonempty for included records. Study design and
publication status each contain exactly one value. Technology and disease arrays may be empty but
must use status `not_applicable` or `not_assessable`; nonempty arrays require `tagged`.

## Returned-result validation

`npm run literature:validate-gold-enrichment-v3-results` validates raw files without modifying them.
It binds packet ID/family, prompt and schema versions, projection and row hashes, exact identifiers,
row order, physician fields, controlled values, optional-tag statuses, evidence flags, full-text
registry status, and complete packet coverage. It rejects duplicates, omissions, extras, changed
metadata or identities, partial packets, malformed booleans, aliases, unsupported terms, taxonomy
on exclusions, incomplete included taxonomy, wrong full-text flags, and preview/missing full-text
claims. It never corrects a returned value.

The validator preserves `model_requests_physician_enrichment_review` as a distinct raw boolean. It
requires `true` for a processing or evidence failure, but it does not infer the flag from relevance,
confidence, packet family, full-text membership, metadata sufficiency, taxonomy, or any other
controlled result. Prompt `3.0.0` results and all other superseded version identities are rejected.

The validator also applies local safety constraints that are deliberately absent from model input.
Those constraints may reject a result, but must never rewrite it or inject a replacement taxonomy
value.

## Operator-only raw-result merge

`npm run literature:merge-gold-enrichment-v3-raw-results` revalidates complete packet coverage and
combines all 630 raw rows into one deterministic union-column CSV. It reads only the preparation
and immutable raw-result directories. Every family-specific raw field is copied byte-for-byte as a
CSV value; only blank cells are added where a column does not exist in that family's result schema.
The raw model request remains distinct. This stage does not read prior enrichment, external-QA
evidence, the taxonomy-upgrade plan, relevance concerns, or other coordinator evidence; compute
review eligibility; apply a suggestion; or change an enrichment value.

## Deterministic coordinator merge and reconciliation

`npm run literature:merge-gold-enrichment-v3` requires complete validated coverage and produces one
630-row candidate in canonical order: 358 enriched inclusions, 272 exclusion assessments, exactly
50 complete-full-text uses, and no held-out rows. Exclusions retain blank taxonomy. Included rows
retain complete required fields and valid optional-tag statuses. The protected physician hash and
all fixed physician fields remain unchanged.

Each uniform merged row is bound to the workflow, source, receipt, protected physician projection,
originating packet, packet projection, and source-row hashes. It preserves the batch/item/display,
master-row, screening-row, and PMID identities plus all eight physician-decision fields. Canonical
title, abstract, journal, and publication year are copied from the authoritative source to retain
review context; prior enrichment never supplies those fields. The row then carries the independent
taxonomy or exclusion assessment, normalized evidence slots, full-text identity when actually
used, the raw `model_requests_physician_enrichment_review` value, the separately computed
`coordinator_requires_physician_enrichment_review` value, three post-merge review-overlay flags,
physician-enrichment review fields, enrichment provenance, and protocol-authorization state.
`import_ready` is fixed to `false`, and `database_mutation_plan` is fixed blank. The merged schema is
`3.0.1`; it rejects historical V1 enrichment as a V3 proposal and prevents unreviewed rows from
claiming physician-confirmed provenance.

The merge also writes packet coverage, controlled-value validation, full-text usage, prior-version
comparison, external-QA overlay, taxonomy-upgrade overlay, and physician-review-candidate reports.
It does not create an import file.

## QA and taxonomy-upgrade overlays

Independent V3 proposals are merged before overlay. External-QA findings and the 133
taxonomy-upgrade candidates never enter prompts or packets and are never accepted automatically.
The overlay reports severity, category, issue, suggested action, whether V3 independently addressed
the concern, whether it remains open, candidate values, independent agreement, and adjudication
need. Direct findings remain auditable, rule-based findings are rerun against V3, global findings
remain in the final report, and every upgrade candidate remains physician-review eligible.

Row-specific hard safety rules may fail validation. They may propose review flags or a
physician-adjudication candidate, but cannot change relevance or inject a taxonomy correction.

## Physician review workbook and QC

`npm run literature:build-gold-enrichment-v3-review` creates an XLSX plus companion CSVs with three
nonoverlapping cohorts:

1. Required Review
2. QC Sample 50
3. Protocol-Based Acceptance Candidates

Required review is the deterministic union of the raw model request and all local coordinator
triggers: adjacent inclusions, full-text-manifest records and exceptions, relevance concerns,
upgrade candidates, direct QA targets, moderate/low-confidence results, not-assessable optional
tags, unresolved design/status, limited or absent metadata, disagreements, and invalid/warning
results. A raw model value of `false` never removes a coordinator-required row, while a value of
`true` adds the row. Duplicate records appear once.

The QC sample contains 25 otherwise eligible `include_core` rows and 25 otherwise eligible
exclusions selected by stable SHA-256 rank. Required-review, relevance-concern, full-text-exception,
direct-QA, and upgrade-candidate rows are ineligible for QC.

Required and QC sheets prefill the independent V3 proposal, require `reviewed=true`, require notes
for modifications, preserve fixed relevance fields, show canonical metadata and available evidence,
and reveal QA/upgrade concerns only after the proposal. Acceptance candidates remain explicitly
unconfirmed until the user authorizes protocol acceptance after QC. The workbook itself imports
nothing.

For the required-review and QC companion CSVs, `physician_metadata_sufficiency` is an editable
controlled field alongside the other `physician_*` enrichment fields. It is prefilled from the V3
`metadata_sufficiency` proposal and participates in accept-versus-modify validation. Fixed source,
proposal, and post-proposal concern cells are checksum- and reconstruction-bound: readiness
reconstructs them from the merged candidate, review-candidate report, and overlay artifacts and
rejects any difference. Only `physician_action`, the editable `physician_*` decision fields, and
`physician_notes` may record reviewer decisions; workbook cell protection remains a usability aid,
not the integrity boundary.

## Provenance

Allowed enrichment provenance values are:

- `physician_confirmed_ai_enrichment`
- `physician_modified_ai_enrichment`
- `ai_generated_enrichment_qc_accepted`
- `legacy_v1_enrichment`
- `full_text_ai_enrichment_pending_physician`
- `unresolved_enrichment`

An unreviewed row can never use physician-confirmed or physician-modified provenance. Protocol
acceptance requires explicit authorization. The candidate remains non-import-ready until required
review and QC are complete, protocol acceptance is authorized when used, controlled-value checks
pass, and relevance concerns are resolved or documented.

## Readiness audit

`npm run literature:audit-gold-enrichment-v3-readiness` reports packet coverage, validation,
required-review and QC completion, modification and field-error rates, protocol authorization,
optional-tag distributions, taxonomy coverage, metadata sufficiency, full-text use, QA and upgrade
status, relevance concerns, provenance, physician hash, zero held-out access, and
`database mutation plan=null`. It never creates import rows and reports `import readiness=false`
unless every explicit gate passes.

Protocol authorization is deliberately bound to the post-QC decision artifacts, not just the
merged proposal. Create it only after the required-review and QC CSVs are final. The JSON must use
this shape, substituting the hashes from the actual files and review receipt:

```json
{
  "workflow_id": "gold-set-v1-enrichment-v3",
  "merged_sha256": "<merged CSV SHA-256>",
  "review_cohorts_receipt_sha256": "<review-cohorts.receipt.json SHA-256>",
  "required_review_sha256": "<completed required-review.csv SHA-256>",
  "qc_review_sha256": "<completed qc-sample-50.csv SHA-256>",
  "protocol_candidate_membership_sha256": "<receipt cohort membership SHA-256>",
  "authorized": true,
  "authorized_after_qc": true,
  "authorized_by": "<reviewer identity>",
  "authorization_note": "<explicit protocol acceptance rationale>"
}
```

A stale authorization fails as soon as either decision CSV changes.

## Storage and reproducibility

Generated workflow files live below ignored
`local-data/literature/gold-sets/gold-set-v1/enrichment-v3/`. Tracked prompts, documentation, and
schemas contain no source records or full-text binaries. Canonical JSON has stable key ordering and
a trailing newline; canonical CSV has an exact header, deterministic quoting, fixed row order, and
strict UTF-8 round-trip validation. Two fresh preparations from identical inputs must produce
byte-identical canonical artifacts. Execution timestamps belong only in separate noncanonical
receipts.

Every generated file and referenced external model input has exactly one category: `model_facing`,
`operator_only`, or `coordinator_only`. The model-facing inventory lists per-packet upload paths and
hashes but is itself operator-only. Operator-only controls—including this workflow's operator guide
and handoff, source prompt templates, packet receipts, raw-result schemas, the packet index, the
global artifact manifest, the model-facing inventory, and audit reports—are never supplied to a
classification conversation. Coordinator-only controls—including the full registry and receipt,
run definition, merged schema, and every post-result artifact—are also never supplied.

## Operator command sequence

Run preparation only from a clean tracked checkout. Set the external evidence paths explicitly;
the workflow never guesses them, downloads replacements, or searches outside the supplied roots.
The two full-text roots may be the same parent only when that parent is the verified source for
both reconciliations.

```bash
V3_SOURCE='local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv'
V3_SOURCE_RECEIPT='local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.receipt.json'
V3_FULL_TEXT_REGISTRY='/absolute/path/gold-set-v1_full-text_audit_v2_56.csv'
V3_NO_ABSTRACT_RECEIPT='/absolute/path/gold-set-v1_full-text-reconciliation_receipt.json'
V3_LIMITED_ABSTRACT_RECEIPT='/absolute/path/gold-set-v1_full-text-reconciliation-v2_receipt.json'
V3_NO_ABSTRACT_ROOT='/absolute/path/Literature/No_abstracts'
V3_LIMITED_ABSTRACT_ROOT='/absolute/path/Literature/limited_abstracts'
V3_QA_FINDINGS='/absolute/path/gold-set-v1_external_QA_findings_v2_status.csv'
V3_QA_REVIEW_1='/absolute/path/gold-set-v1_enrichment_QA_review_1.xlsx'
V3_QA_REVIEW_2='/absolute/path/gold-set-v1_enrichment_QA_review_2.xlsx'
V3_TAXONOMY_AUDIT='local-data/literature/gold-sets/gold-set-v1/taxonomy-v2-audit-run-1.json'
V3_UPGRADE_PLAN='local-data/literature/gold-sets/gold-set-v1/taxonomy-v2-upgrade-plan-run-1.json'
V3_RUN_DIR='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/run'

npm run literature:prepare-gold-enrichment-v3 -- \
  --source "$V3_SOURCE" \
  --source-receipt "$V3_SOURCE_RECEIPT" \
  --full-text-registry "$V3_FULL_TEXT_REGISTRY" \
  --no-abstract-receipt "$V3_NO_ABSTRACT_RECEIPT" \
  --limited-abstract-receipt "$V3_LIMITED_ABSTRACT_RECEIPT" \
  --full-text-root "$V3_NO_ABSTRACT_ROOT" \
  --full-text-root "$V3_LIMITED_ABSTRACT_ROOT" \
  --qa-findings "$V3_QA_FINDINGS" \
  --qa-review-1 "$V3_QA_REVIEW_1" \
  --qa-review-2 "$V3_QA_REVIEW_2" \
  --taxonomy-audit "$V3_TAXONOMY_AUDIT" \
  --upgrade-plan "$V3_UPGRADE_PLAN" \
  --output-dir "$V3_RUN_DIR"
```

After manual packet execution, keep the exact `*.result.csv` files in a dedicated raw-results
directory. The remaining local stages are:

```bash
V3_RAW_RESULTS='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/raw-results'
V3_VALIDATION_DIR='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/validation'
V3_RAW_MERGE_DIR='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/raw-merge'
V3_PRIOR_ENRICHMENT='/absolute/path/gold-set-v1_enrichment_results_full-text-reconciled-v2_quality-cleaned_630.csv'
V3_MERGE_DIR='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/merge'
V3_REVIEW_DIR='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/review'
V3_READINESS_DIR='local-data/literature/gold-sets/gold-set-v1/enrichment-v3/readiness'

npm run literature:validate-gold-enrichment-v3-results -- \
  --run-dir "$V3_RUN_DIR" \
  --results-dir "$V3_RAW_RESULTS" \
  --output-dir "$V3_VALIDATION_DIR"

npm run literature:merge-gold-enrichment-v3-raw-results -- \
  --run-dir "$V3_RUN_DIR" \
  --results-dir "$V3_RAW_RESULTS" \
  --output-dir "$V3_RAW_MERGE_DIR"

# Coordinator-only stages begin here. The raw operator handoff ends above.
npm run literature:merge-gold-enrichment-v3 -- \
  --run-dir "$V3_RUN_DIR" \
  --results-dir "$V3_RAW_RESULTS" \
  --source "$V3_SOURCE" \
  --prior-enrichment "$V3_PRIOR_ENRICHMENT" \
  --qa-findings "$V3_QA_FINDINGS" \
  --upgrade-plan "$V3_UPGRADE_PLAN" \
  --output-dir "$V3_MERGE_DIR"

npm run literature:build-gold-enrichment-v3-review -- \
  --run-dir "$V3_RUN_DIR" \
  --merge-dir "$V3_MERGE_DIR" \
  --output-dir "$V3_REVIEW_DIR"

npm run literature:audit-gold-enrichment-v3-readiness -- \
  --merge-dir "$V3_MERGE_DIR" \
  --review-dir "$V3_REVIEW_DIR" \
  --required-review "$V3_REVIEW_DIR/required-review.csv" \
  --qc-review "$V3_REVIEW_DIR/qc-sample-50.csv" \
  --protocol-authorization '/absolute/path/protocol-authorization.json' \
  --output-dir "$V3_READINESS_DIR"
```

Omit `--protocol-authorization` only when the protocol-acceptance cohort is empty. Create the
authorization after the required-review and QC files are final so its hashes bind the reviewed
bytes.

## Exact artifact inventory

| Stage             | Deterministic outputs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preparation       | `run-definition.json`, `artifact-manifest.json`, `packet-index.json`, `model-facing-inventory.json`, `model-input-independence-audit.json`, `full-text-registry-v3.csv`, `full-text-registry-v3.receipt.json`, operator-only source templates/README/handoff, four schemas, 20 packet CSVs plus their operator-only receipts, 20 rendered model-facing prompts, and ten packet-scoped complete-full-text manifests (50 generated model-facing artifacts total); the inventory additionally records 50 checksum-bound external PDFs as logical model-facing entries, not generated outputs |
| Manual raw result | One `<packet-id>.result.csv` per packet, using the exact filename in its receipt; raw files are never rewritten                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Validation        | `packet-validation-report.json`, `controlled-value-validation-report.json`, `result-coverage-report.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Raw-result merge  | `gold-set-v1-enrichment-v3-raw-merged.csv`, `gold-set-v1-enrichment-v3-raw-merged.receipt.json`; no coordinator inputs or decisions                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Merge             | `gold-set-v1-enrichment-v3-merged.csv`, `gold-set-v1-enrichment-v3-merged.receipt.json`, `packet-coverage-report.json`, `controlled-value-validation-report.json`, `full-text-usage-report.json`, `comparison-against-prior-v1-v2.csv`, `external-qa-overlay.csv`, `taxonomy-v2-upgrade-overlay.csv`, `physician-review-candidate-report.csv`                                                                                                                                                                                                                                             |
| Review            | `gold-set-v1-enrichment-v3-physician-review.xlsx`, `required-review.csv`, `qc-sample-50.csv`, `protocol-acceptance-candidates.csv`, `review-cohorts.receipt.json`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Readiness         | `readiness-audit.json` only; no import file is ever produced                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Preparation also writes a noncanonical
`execution-receipts/execution-<execution-time>.json`. It is intentionally excluded from the
canonical byte-identity comparison.
