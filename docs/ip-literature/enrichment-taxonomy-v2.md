# Literature enrichment taxonomy v2

## Status and scope

This design introduces an additive literature-enrichment contract. It does not amend a gold-set
review, update a batch, seed a database, rerun enrichment, or create import rows.

| Contract                   | Existing                  | Added by this design |
| -------------------------- | ------------------------- | -------------------- |
| Review taxonomy            | `1.1.0`                   | unchanged            |
| Gold-set label schema      | `1.1.0`                   | unchanged            |
| Relevance definition       | `1.0.0`                   | unchanged            |
| Enrichment taxonomy        | implicit review-v1 values | `2.0.0`              |
| Enrichment artifact schema | legacy row shapes         | `2.0.0`              |

The existing `literatureTaxonomy` and `literatureGoldSetLabels` exports remain pinned to their v1
assets. V2 is available only through an explicit version request. There is deliberately no
`latest` alias.

## Evidence and provenance

PR #70 created the canonical, database-backed development source at
`local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv`. The source contains exactly
630 development rows and has SHA-256
`d2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64`. Its receipt has SHA-256
`38a0316ab5a3161bdf502a8e0c8b9c69753386862c858336f4d3e912a6ad21ef` and records a protected
physician-field SHA-256 of
`90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e`.

The controlled-vocabulary review used these development-only QA artifacts:

- `gold-set-v1_enrichment_QA_review_1.xlsx`, SHA-256
  `898159d8c7adf1e0296927d41c42fb8398de40d31823b9584866fb0addceba8d`;
- `gold-set-v1_enrichment_QA_review_2.xlsx`, SHA-256
  `6f88c2705fb92f84fb43a24d09c9579995ae1fa92f58be0a4cb721feabb43f74`;
- `gold-set-v1_external_QA_findings_v2_status.csv`, SHA-256
  `1c7992f29bb7c03afc370f3cb0e7a978a237dc9cbb964966e0dcec0cd07b6edd`.

QA review 1 records 15 recurring vocabulary gaps. QA review 2 records 22 proposals total: 12
technology, three disease, one clinical-purpose, and six study-design proposals. The normalized
adoption report also gives a disposition to the additional technology distinctions required by the
QA row findings and this design brief. Counts in the workbooks are indicative keyword matches, not
physician-adjudicated row corrections.

## Adopted controlled concepts

V2 inherits every v1 controlled value without reinterpreting an ID. New values are appended to the
effective field order.

### Broad topics

| ID                                      | Boundary                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `adjacent-surgical-procedural-analogue` | Surgical procedures or physiology retained because they directly inform an IP analogue; not a bronchoscopic procedure tag. |
| `specimen-adequacy-molecular-pathology` | Adequacy, processing, biomarker, and molecular-pathology questions spanning more than one sampling route.                  |
| `health-services-economics`             | Cost, access, utilization, care-pathway, and delivery-system questions; not a substitute for a clinical procedure topic.   |

The generic proposal `adjacent-procedural-scope-boundary` is deferred because it would become an
unreviewable catch-all. `upper-airway-anesthesia-boundary` maps to the existing
`safety-anesthesia-complications` topic.

### Study design

- `cross-sectional-survey`
- `economic-evaluation`
- `animal-preclinical`
- `bench-in-vitro`
- `qualitative-study`
- `case-control`

`cross-sectional-survey` measures a population at a time point and is not an interview-based
qualitative design. `case-control` samples by outcome and is not a retrospective cohort sampled by
exposure. `animal-preclinical` requires an in-vivo nonhuman model; `bench-in-vitro` covers benchtop,
phantom, cadaveric, or in-vitro testing. `economic-evaluation` compares costs with consequences or
models resource tradeoffs and is not a general health-services observation. `technical-note`
continues to describe a procedural or device report and is not redefined as bench testing.

### Technology

- `thoracentesis`
- `chest-tube`
- `pleurodesis`
- `bronchoalveolar-lavage`
- `conventional-tbna`
- `rapid-on-site-evaluation`
- `endobronchial-coils`
- `balloon-bronchoplasty`
- `mediastinal-cryobiopsy`
- `foreign-body-removal`
- `bronchial-artery-embolization`
- `narrow-band-imaging`
- `autofluorescence-bronchoscopy`
- `confocal-laser-endomicroscopy`
- `topical-hemostatic-agent`
- `transbronchial-thermal-ablation`
- `surgical-vats`

The boundaries are intentional:

- thoracentesis is needle/catheter fluid aspiration; a chest tube is an indwelling pleural drain;
- pleurodesis is an obliterative intervention, not indwelling-pleural-catheter placement;
- diagnostic BAL is not generic flexible bronchoscopy;
- conventional TBNA does not imply convex EBUS;
- ROSE is a specimen-assessment workflow rather than a sampling needle;
- endobronchial coils are not endobronchial valves;
- balloon bronchoplasty dilates an airway and is not an airway stent;
- mediastinal cryobiopsy is not transbronchial lung cryobiopsy;
- foreign-body removal is a treatment technology, while foreign-body aspiration is a disease or
  presenting problem;
- NBI, autofluorescence bronchoscopy, confocal endomicroscopy, and optical coherence tomography are
  not interchangeable imaging modalities;
- a topical endobronchial hemostatic agent is not automatically laser, electrocautery, or APC;
- surgical VATS is an adjacent surgical technology and is never medical thoracoscopy.

The combined/alternate proposals `thoracentesis-chest-tube`, `pleurodesis-agent`,
`balloon-dilation`, and `split-transbronchial-cryobiopsy` receive explicit nonautomatic migration
mappings. `optical-coherence-tomography` is deferred until its evidence can be separated from the
combined confocal/OCT count.

### Disease

- `lymphoma-hematologic-malignancy`
- `metastatic-extrathoracic-malignancy`
- `tracheobronchomalacia-edac`
- `asthma`
- `foreign-body-aspiration`
- `hemoptysis`
- `bronchiectasis`
- `pulmonary-alveolar-proteinosis`
- `airway-amyloidosis`
- `congenital-airway-disorder`

Primary lung cancer is distinct from an endobronchial or pleural metastasis from an extrathoracic
primary. Fixed benign stenosis is distinct from dynamic tracheobronchomalacia or EDAC. Hemoptysis is
the clinical problem; bronchoscopic hemostasis and bronchial-artery embolization are treatments.
Foreign-body aspiration is the condition; extraction is the technology.

The QA spellings `lymphoma-haematologic`, `metastatic-extrathoracic`, and
`tracheobronchomalacia` map explicitly to the longer canonical IDs. They are not accepted silently
by the v2 validator.

### Clinical purpose

- `cost-effectiveness-health-services`
- `specimen-adequacy`
- `workflow-operations-quality`

Economic, operational, and specimen-adequacy objectives must not be coded as `training` or
`multiple-general-overview`. The first identifies the objective of evaluating cost, utilization, or
delivery; `economic-evaluation` independently identifies study design. Workflow and quality are
kept separate from cost-effectiveness so the two dimensions can co-exist.

## Optional-tag completion semantics

V2 gives `technology_tags` and `disease_tags` an explicit status:

| Status               | Array rule                    | Meaning                                                         |
| -------------------- | ----------------------------- | --------------------------------------------------------------- |
| `tagged`             | nonempty                      | At least one controlled concept was assigned.                   |
| `not_applicable`     | empty                         | Available evidence supports that no controlled concept applies. |
| `not_assessable`     | empty                         | Available evidence is insufficient to decide.                   |
| `legacy_unspecified` | empty compatibility view only | The v1 record did not encode why the array was empty.           |

A v2 writer cannot emit `legacy_unspecified`. A v1 compatibility adapter may expose it, but must
never infer `not_applicable` from an old blank array. The artifact contract is explicitly scoped to
records whose existing physician decision is `include_core` or `include_adjacent`, and it binds the
source physician-field checksum. Excluded rows are outside enrichment scope rather than silently
incomplete. Within the included-record scope, a missing row means enrichment has not been
completed; an empty array inside a completed v2 row must carry one of the two explicit empty
statuses.

No evidence supports expanding the same status mechanism to the required multi-value fields in
this revision: topic and clinical-purpose arrays are nonempty in completed v2 records.

## Surgical LVRS scope corrections

PMIDs `41229759` and `18453348` are development articles about surgical lung-volume reduction.
Their v1 enrichment topic is `bronchoscopic-lung-volume-reduction`, which QA correctly identifies as
a scope error. The upgrade plan may identify
`adjacent-surgical-procedural-analogue` as the available v2 path, but it does not change either row,
infer a valve or coil tag, or revisit physician relevance. A later physician/enrichment pass must
supply the final v2 value.

## Compatibility and deterministic behavior

- V1 files, default exports, review payloads, RPCs, JSON export `1.0.0`, and the exact 35-column CSV
  remain unchanged.
- A caller must request taxonomy/enrichment `2.0.0` explicitly.
- V2 parsing rejects unsupported terms at the exact field and array index.
- V2 arrays are unique and serialized in stable lexical order; records use stable identity
  order. Object keys and JSON whitespace are deterministic.
- Aliases are visible only through the migration resolver. A parse never performs an alias rewrite.
- English labels and descriptions are complete. Untranslated locales use the existing English
  fallback principle and remain flagged for later human localization review; no translations are
  invented.

## Read-only audit and upgrade plan

`npm run literature:audit-enrichment-taxonomy-v2` verifies the checksum-bound canonical source,
the two QA workbooks, the findings CSV, the prior development enrichment, and the normalized
adoption report. It rejects test/all/held-out path semantics before reading a file, never connects
to a database or network, and writes only deterministic JSON below ignored `local-data`.

The audit reports current value use, proposal dispositions, study-design schema-gap candidates,
conservative optional-tag status counts, direct QA counts, both surgical-LVRS errors, migration-map
completeness, and physician-field hashes. Its upgrade-plan artifact lists candidate fields and
evidence only. It never contains a final changed value, physician confirmation, or import row.

### Verified real audit

The checksum-bound command was run twice on 2026-08-05. Both audit files are byte-identical at
SHA-256 `289fb2d862e55438db5bf51bac57ba44916c28bf919a2c6f316cee8785b76f18`;
both upgrade plans are byte-identical at SHA-256
`aa5667614b284f005346d6c79c992235936b4d78e056e7655692d6c95ca9ea28`.
The ignored artifacts are stored beside the canonical source as `taxonomy-v2-audit-run-{1,2}.json`
and `taxonomy-v2-upgrade-plan-run-{1,2}.json`.

The audit verified 630 unique development records, 46 proposal dispositions, 13 nonautomatic
migration mappings, 166 QA findings, and 133 candidate-only upgrade-plan rows. The prior artifact
contains 26—not the external summary's earlier 30—`not-assessable-from-available-metadata` study
designs. V2 rules identify candidates for 19 of those rows, including all 16 with adequate
abstracts; seven remain unresolved. No candidate is treated as a final classification.

Among the 358 included records, 168 technology arrays and 139 disease arrays are blank. Existing
metadata supports only two technology and five disease `not_assessable` candidates; it supports no
deterministic `not_applicable` assignment, so the remaining 166 and 134 blanks stay unresolved.
The physician-field checksum remained
`90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e`. The audit recorded zero
database or network access, mutations, test access, import rows, and physician-decision changes.

## Future active-batch amendment plan

The active batch must not be changed by ordinary update or by the current taxonomy seed command.
The current topic table is keyed only by topic ID, so seeding v2 would overwrite shared v1 rows.
A future amendment should:

1. add version-aware taxonomy/enrichment-contract storage without altering v1 topic rows;
2. add an append-only amendment ledger containing batch ID, from/to versions, actor, reason,
   source hashes, audit hash, and timestamp;
3. require a dry-run proving frozen review rows, membership, split, stratum, display order,
   relevance, and confidence are unchanged;
4. require an explicit authorized operation to attach enrichment contract `2.0.0` to a future run;
5. leave the batch's historical review taxonomy stamp intact unless a separately reviewed batch
   amendment design explicitly requires otherwise.

## Future persistence and rerun plan

An additive database migration should create versioned enrichment-run and enrichment-result tables
rather than add meaning to old review columns. Results need the enrichment schema/taxonomy versions,
canonical-source hash, physician-field hash, tag statuses, run provenance, validation state, and an
append-only audit trail. Import must reject `legacy_unspecified` and unsupported terms.

A later rerun should read only the checksum-bound canonical development source, request v2
explicitly, preserve physician relevance fields by hash, and select the 358 already-included records
without revisiting the 272 exclusions. It should produce a candidate artifact outside the database,
validate it, and undergo physician enrichment review before a separate import PR. It must not read
held-out membership, dispatch a relevance screener, or treat QA suggestions as confirmed row
corrections.

## Non-negotiable safety boundaries

- Enrichment never reclassifies physician relevance or confidence.
- Old blank tag arrays never mean `not_applicable` without new evidence.
- QA suggestions never become row corrections automatically.
- Held-out test membership and identities remain locked and unenumerated.
- This change performs no database migration, seed, import, worker dispatch, model run, or batch
  update.
