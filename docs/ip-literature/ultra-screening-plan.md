# IP literature ultra-screening plan

## Purpose

This workflow performs an auditable, resumable title/abstract/PubMed-metadata relevance screen of
the imported interventional-pulmonology literature corpus. It uses Codex subagents only. It must
not use `OPENAI_API_KEY`, the OpenAI API or SDK, Batch API, full text, or separately billed model
calls.

Screening outputs are suggestions for later physician review. They do not delete, hide, publish,
or otherwise mutate a literature article or its existing review state.

## Source snapshot

The local literature database was inspected read-only on 2026-07-30:

- Imported unique articles: 132,350.
- Articles with abstracts: 96,690.
- Articles with an explicit no-abstract state: 35,660.
- Completed `pilot-v1` development reviews: 100 of 100.
- Gold labels remain hidden from workers and are not queried by packet preparation.

The database schema provides all permitted fields on `literature_articles`. Pilot membership and
completion come from `literature_gold_set_items`; physician relevance labels are queried only by
the coordinator's post-screening evaluation command.

## Agent allocation

- Luna: first-pass title/abstract/metadata screening and the independent exclusion-sensitivity
  pass.
- Terra: Luna disagreements, Luna uncertain or low-confidence decisions, no-abstract boundary
  cases, deterministic random quality-control samples of confident exclusions, and difficult
  animal/preclinical distinctions.
- Sol: repository inspection, deterministic packet preparation, dispatch, manifest maintenance,
  validation, quarantine/retry decisions, evaluation, and reporting.

Sol must not be substituted for Luna screening. Terra must not be used for routine first-pass
volume unless the coordinator records a later explicit user authorization in the run manifest.
Every worker is started with no inherited conversation history and is instructed to read only its
sanitized packet and write only its assigned output.

The requested logical smoke-test fanout is eight Luna worker assignments. The current collaboration
runtime exposes four total slots, including the Sol coordinator, so at most three workers can
execute simultaneously. The eight assignments therefore run in deterministic waves unless runtime
capacity increases. More importantly, dispatch must stop rather than substitute models if Luna is
not a callable model in the current runtime.

## Data boundary

Each packet is a JSON array containing only:

```json
{
  "pmid": "string",
  "title": "string",
  "abstract": "string or [NO ABSTRACT AVAILABLE]",
  "mesh": ["string"],
  "author_keyword": ["string"],
  "publication_type": ["string"],
  "journal": "string or null",
  "year": 2026,
  "language": ["string"]
}
```

No worker packet, prompt, filename, or inherited conversation may contain physician labels,
physician confidence, physician notes, deterministic relevance scores, source queries, sampling
strata, prior AI classifications, review history, or full text. Derived review packets contain the
same article shape and do not disclose why an article was selected for another pass.

The explicit no-abstract marker is `[NO ABSTRACT AVAILABLE]`. Absence of an abstract is not itself
a reason to return `uncertain`.

## Relevance policy

Workers must return exactly one of:

- `include_core`
- `include_adjacent`
- `exclude`
- `uncertain`

Core includes human clinical basic flexible bronchoscopy; procedural BAL; washing, brushing, and
biopsy; EBUS/EUS-B; peripheral navigation and biopsy; therapeutic and rigid bronchoscopy; central
airway obstruction; airway stents and stenosis; bronchoscopic ablation; lung-volume reduction;
persistent air leak and fistula closure; cryobiopsy; hemoptysis intervention; pleural procedures
and medical thoracoscopy; procedural tracheostomy; and bronchoscopy education, quality, safety, or
directly applied technology.

Adjacent includes animal/preclinical procedural studies, animal airway-device and translational
procedure work, bronchoscopy-specific anesthesia or ventilation, pathology or molecular adequacy
tied to bronchoscopic specimens, procedural imaging or localization, and benchtop work with direct
bronchoscopy relevance.

Exclude includes incidental BAL/bronchoscopy specimen collection for unrelated biomarker,
immunology, microbiology, vaccine, or mechanism work; animal respiratory research without a
procedural question; nonprocedural pulmonary/oncology/imaging/AI/surgery/anesthesia/education;
non-airway stents; and nonpulmonary endoscopy.

Before assigning a high-confidence `exclude`, workers must perform a protected-cue check across
the supplied title, abstract, MeSH, and keywords. Direct bronchoscopy, endobronchial,
transbronchial, EBUS/EUS-B, pleural-procedure, and explicit interventional-pulmonology fellowship
or training terms are protected when they occur in the title or are tied to the study cohort,
method, outcome, access/localization, safety, yield, adequacy, or training/workforce question.
Such records receive the established include label when direct, or `uncertain` with
`requiresHumanReview: true` and `scope_boundary` when centrality cannot be resolved. A mere
background, confirmation, or specimen-source mention remains excludable; generic imaging,
anesthesia, pathology, molecular, surgery, and education records are not automatically included.

## Exact worker result schema

One JSON object per line, with no markdown wrapper and no additional properties:

```json
{
  "pmid": "string",
  "relevanceLabel": "include_core | include_adjacent | exclude | uncertain",
  "decisionConfidence": "high | moderate | low",
  "requiresHumanReview": true,
  "reasonCodes": ["controlled_reason_code"],
  "evidence": [
    {
      "field": "title | abstract | mesh | author_keyword | publication_type | journal | year",
      "text": "exact text copied from that supplied field"
    }
  ],
  "conciseRationale": "brief metadata-grounded explanation"
}
```

`reasonCodes` must contain one or more unique values from:

```text
core_procedure_central
basic_bronchoscopy
bal_procedural
bronchoscopic_sampling
ebus_eusb
peripheral_navigation_biopsy
therapeutic_rigid_airway
airway_stent_stenosis
bronchoscopic_ablation
lung_volume_reduction
air_leak_fistula
cryobiopsy
hemoptysis_intervention
pleural_procedure
procedural_tracheostomy
education_quality_safety
applied_technology
adjacent_anesthesia_ventilation
adjacent_specimen_adequacy
adjacent_imaging_localization
adjacent_preclinical_procedural
adjacent_benchtop
incidental_specimen_collection
animal_nonprocedural
unrelated_pulmonary_oncology
unrelated_imaging_ai
unrelated_surgery_anesthesia_education
non_airway_stent
nonpulmonary_endoscopy
insufficient_metadata
scope_boundary
```

Every `uncertain` or `low`-confidence result must set `requiresHumanReview` to `true`.

## Determinism

- Run identifier: supplied explicitly and reused for resume.
- Smoke seed: `ip-literature-ultra-smoke-v1:20260730`.
- Smoke candidates: completed `pilot-v1` development PMIDs only, without querying reviews.
- Smoke selection: sort candidates by SHA-256 of `seed + NUL + PMID`, break ties by numeric PMID,
  and take the first 20.
- Smoke chunking: balance the 20 selected PMIDs across eight ordered assignments, yielding four
  three-article and four two-article packets.
- Pilot ordering: numeric PMID ascending.
- Corpus ordering: numeric PMID ascending.
- Corpus first-pass chunk size: 25 unless smoke-test behavior justifies reducing it.
- QC sampling: SHA-256 rank with a versioned seed; never a process-global random generator.
- Each packet and validated output receives a SHA-256 checksum in the manifest.

## Local artifacts and resume contract

All runtime artifacts are ignored by Git:

```text
local-data/literature/ultra-screening/<run-id>/
  progress-manifest.json
  manifest-history/
  preflight/<phase>.json
  packets/<phase>/<chunk-id>.json
  worker-outputs/<phase>/<chunk-id>.attempt-<n>.jsonl
  validated/<phase>/<chunk-id>.jsonl
  quarantine/<phase>/<chunk-id>.attempt-<n>/
  evaluations/
```

The manifest records, for every worker attempt:

- agent ID;
- actual model;
- reasoning level;
- assigned PMIDs;
- pending/running/invalid/retry-pending/completed/failed status;
- input and output paths;
- start and completion timestamps;
- packet and output checksums;
- validation errors and validation result;
- retry number.

Manifest updates are atomic and snapshot the preceding state under `manifest-history/`. Packet
preparation is idempotent: an existing phase is accepted only when its configuration and packet
checksums match.

## Validation and quarantine

Validation is coordinator-owned and checks:

1. The output is valid JSON Lines with one strict-schema object per nonblank line.
2. Every assigned PMID appears exactly once.
3. No additional PMID appears.
4. Every evidence excerpt occurs verbatim, with case preserved, in the named supplied field.
5. Every label, confidence, evidence field, and reason code is controlled.
6. `uncertain` and `low` confidence always require human review.
7. The rationale and evidence arrays are nonempty and bounded.

Invalid output is preserved in a quarantine directory with its validation report. A chunk receives
at most two retries after the initial attempt. After three invalid attempts it becomes `failed`
and its PMIDs remain visible in the manifest for human follow-up.

Validated chunks are written immediately and never overwritten. Phase aggregation is allowed only
when every chunk is valid; partial progress remains resumable.

## Execution sequence

1. Prepare the deterministic 20-item, eight-assignment Luna smoke test.
2. Dispatch with maximum permitted Luna concurrency and validate every chunk.
3. Query hidden physician labels only after all smoke outputs validate.
4. Report exact-label metrics, binary include sensitivity/specificity, confusion matrix, review
   rate, and dangerous false negatives: physician `include_core`/`include_adjacent` plus
   high-confidence Luna `exclude`.
5. If technically stable, prepare and run Luna over all 100 completed pilot items.
6. Prepare an independent Luna challenge pass for every pilot first-pass exclusion without
   disclosing prior results.
7. Prepare Terra review packets for disagreements, uncertain/low-confidence results, no-abstract
   boundary cases, deterministic QC exclusions, and animal/preclinical boundary cases.
8. Compare Luna first pass, Luna challenge, and Terra against the physician pilot labels.
9. If repeated dangerous false negatives expose a systematic boundary error, add the narrowest
   metadata-operational guardrail and pass a fresh blinded pilot exclusion challenge before corpus
   fanout.
10. Present the required preflight facts before corpus fanout: available article count, chunk size,
    worker count, output location, manifest location, exact schema, and validation status.
11. Prepare corpus packets in deterministic 25-item chunks and dispatch Luna.
12. Validate and persist each completed chunk immediately.
13. Challenge every first-pass exclusion with a second independent Luna pass.
14. Route rescued exclusions and disagreements to Terra or human review.
15. Continue until all packets finish, credits reset, throttling requires a lower concurrency, or a
    genuine runtime blocker is recorded.

## Evaluation

Pilot reports include:

- exact four-class confusion matrix and accuracy;
- per-label precision, recall, and F1;
- binary include (`include_core` or `include_adjacent`) sensitivity, specificity, precision, and
  negative predictive value;
- uncertain/low-confidence/human-review counts;
- first-pass versus challenge agreement;
- Luna versus Terra agreement;
- dangerous false-negative PMIDs and supplied evidence;
- invalid-output, retry, and terminal-failure counts.

The pilot is enriched development data, so metrics are workflow diagnostics rather than corpus
prevalence or a final performance claim.

## Safety and scope

The pipeline is read-only with respect to the literature database. It creates ignored screening
files only. It never writes classifier payloads back to `literature_articles`, changes relevance
or visibility state, imports reviews, reveals held-out gold-test labels, or modifies source NBIB
files.
