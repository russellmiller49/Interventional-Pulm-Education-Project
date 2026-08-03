# IP literature screening policy

Version: `1.0.0`

Classify only the supplied PubMed title, abstract, MeSH terms, author keywords, publication types,
journal, year, and language. Do not use outside knowledge, full text, prior classifications,
physician labels, sampling strata, selection reasons, or coordinator-only data.

Return exactly one JSON object per supplied PMID and no Markdown. Each object must contain only:
`pmid`, `relevanceLabel`, `decisionConfidence`, `requiresHumanReview`, `reasonCodes`, `evidence`,
and `conciseRationale`. Evidence text must occur verbatim in its named supplied field.

Allowed relevance labels are `include_core`, `include_adjacent`, `exclude`, and `uncertain`.
Allowed confidence levels are `high`, `moderate`, and `low`. Every `uncertain` or low-confidence
result must set `requiresHumanReview` to `true`.

`include_core` covers human clinical flexible bronchoscopy; procedural BAL, washing, brushing, and
biopsy; EBUS/EUS-B; peripheral navigation and biopsy; therapeutic or rigid bronchoscopy; central
airway obstruction; airway stents and stenosis; bronchoscopic ablation; lung-volume reduction;
persistent air leak and fistula closure; cryobiopsy; hemoptysis intervention; pleural procedures
and medical thoracoscopy; procedural tracheostomy; and bronchoscopy education, quality, safety, or
directly applied technology.

`include_adjacent` covers animal or preclinical procedural studies, animal airway-device and
translational procedure work, bronchoscopy-specific anesthesia or ventilation, pathology or
molecular adequacy tied to bronchoscopic specimens, procedural imaging or localization, and
benchtop work with direct bronchoscopy relevance.

`exclude` covers incidental BAL or bronchoscopy specimen collection for unrelated biomarker,
immunology, microbiology, vaccine, or mechanism work; animal respiratory research without a
procedural question; nonprocedural pulmonary, oncology, imaging, AI, surgery, anesthesia, or
education work; non-airway stents; and nonpulmonary endoscopy.

Before a high-confidence exclusion, check title, abstract, MeSH, and keywords for direct
bronchoscopy, endobronchial, transbronchial, EBUS/EUS-B, pleural-procedure, and explicit
interventional-pulmonology training terms. Treat them as protected when tied to the cohort,
method, outcome, access or localization, safety, yield, adequacy, or training/workforce question.
Use the applicable include label when direct. If centrality cannot be resolved, use `uncertain`,
require human review, and add `scope_boundary`. A background, confirmation, or specimen-source
mention alone remains excludable.

Allowed reason codes:

`core_procedure_central`, `basic_bronchoscopy`, `bal_procedural`, `bronchoscopic_sampling`,
`ebus_eusb`, `peripheral_navigation_biopsy`, `therapeutic_rigid_airway`,
`airway_stent_stenosis`, `bronchoscopic_ablation`, `lung_volume_reduction`,
`air_leak_fistula`, `cryobiopsy`, `hemoptysis_intervention`, `pleural_procedure`,
`procedural_tracheostomy`, `education_quality_safety`, `applied_technology`,
`adjacent_anesthesia_ventilation`, `adjacent_specimen_adequacy`,
`adjacent_imaging_localization`, `adjacent_preclinical_procedural`, `adjacent_benchtop`,
`incidental_specimen_collection`, `animal_nonprocedural`, `unrelated_pulmonary_oncology`,
`unrelated_imaging_ai`, `unrelated_surgery_anesthesia_education`, `non_airway_stent`,
`nonpulmonary_endoscopy`, `insufficient_metadata`, and `scope_boundary`.
