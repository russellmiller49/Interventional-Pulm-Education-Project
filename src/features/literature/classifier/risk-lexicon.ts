/**
 * Deterministic coordinator risk layer for Stage-A triage.
 *
 * This is an independent defense that never reads, trusts, or depends on Luna's reason codes.
 * It scans the bibliographic fields of a record with a fixed, versioned lexicon; any hit marks
 * the record risk-enriched, which bars it from the low-risk automatic deprioritization pool
 * and routes it to mandatory physician review.
 *
 * The layer is deliberately over-inclusive: a false flag costs one physician glance, while a
 * missed flag could let a relevant article ride an incorrect model negative. Pure and
 * browser-safe; no node imports.
 */

export const COORDINATOR_RISK_LEXICON_VERSION = 'literature-luna-risk-lexicon/1.0.0'

export const COORDINATOR_RISK_FLAGS = [
  'signal_pulmonary',
  'signal_thoracic',
  'signal_airway',
  'signal_pleural',
  'signal_lung_cancer',
  'signal_mediastinal',
  'signal_bronchoscopy',
  'signal_pulmonary_procedure',
  'signal_thoracic_oncology',
  'signal_respiratory_failure',
  'signal_critical_care',
  'signal_anesthesia',
  'signal_pathology',
  'signal_imaging',
  'signal_procedural_complication',
  'signal_legacy_terminology',
  'signal_title_abstract_mismatch',
] as const

export type CoordinatorRiskFlag = (typeof COORDINATOR_RISK_FLAGS)[number]

/** The bibliographic surface the lexicon scans. Never includes model output. */
export interface RiskScanFields {
  readonly title: string
  readonly abstract: string | null
  readonly journal: string | null
  readonly meshTerms: readonly string[]
  readonly keywords: readonly string[]
  readonly publicationTypes: readonly string[]
}

interface LexiconDomain {
  readonly flag: Exclude<CoordinatorRiskFlag, 'signal_title_abstract_mismatch'>
  readonly patterns: readonly RegExp[]
}

const domain = (flag: LexiconDomain['flag'], sources: readonly string[]): LexiconDomain => ({
  flag,
  patterns: sources.map((source) => new RegExp(source, 'iu')),
})

/**
 * The versioned lexicon. Patterns are word-boundary anchored and case-insensitive. Changing
 * any entry is a new lexicon version and, once a calibration is frozen, a new calibration.
 */
export const COORDINATOR_RISK_LEXICON: readonly LexiconDomain[] = [
  domain('signal_pulmonary', [
    String.raw`\bpulmonar\w*`,
    String.raw`\blungs?\b`,
    String.raw`\brespirat\w*`,
    String.raw`\bpneumon\w*`,
    String.raw`\balveol\w*`,
    String.raw`\bbronchiol\w*`,
    String.raw`\bcopd\b`,
    String.raw`\basthma\w*`,
    String.raw`\bemphysema\w*`,
    String.raw`\btubercul\w*`,
    String.raw`\bcystic fibrosis\b`,
    String.raw`\binterstitial lung\b`,
    String.raw`\bpleuropulmonary\b`,
  ]),
  domain('signal_thoracic', [
    String.raw`\bthorax\b`,
    String.raw`\bthoracic\w*`,
    String.raw`\bintrathoracic\b`,
    String.raw`\btransthoracic\b`,
    String.raw`\bchest\b`,
    String.raw`\bcardiothoracic\b`,
  ]),
  domain('signal_airway', [
    String.raw`\bairways?\b`,
    String.raw`\btrachea\w*`,
    String.raw`\btracheo\w*`,
    String.raw`\bendobronchial\b`,
    String.raw`\bbronchus\b`,
    String.raw`\bbronchial\b`,
    String.raw`\bcarina\w*`,
    String.raw`\bsubglottic\b`,
    String.raw`\blaryngotracheal\b`,
    String.raw`\bstridor\b`,
  ]),
  domain('signal_pleural', [
    String.raw`\bpleur\w*`,
    String.raw`\bpneumothorax\w*`,
    String.raw`\bempyema\w*`,
    String.raw`\bthoracentesis\b`,
    String.raw`\bchylothorax\b`,
    String.raw`\bhemothorax\b`,
    String.raw`\bhydrothorax\b`,
    String.raw`\bmesothelioma\w*`,
  ]),
  domain('signal_lung_cancer', [
    String.raw`\blung (?:cancer|carcinoma|neoplasm|tumor|tumour|malignanc\w*|adenocarcinoma)`,
    String.raw`\bpulmonary (?:nodule|nodules|carcinoma|neoplasm|malignanc\w*|metastas\w*)`,
    String.raw`\blung nodules?\b`,
    String.raw`\bnsclc\b`,
    String.raw`\bsclc\b`,
    String.raw`\bnon[- ]small[- ]cell\b`,
    String.raw`\bsmall[- ]cell lung\b`,
    String.raw`\bbronchogenic carcinoma\b`,
  ]),
  domain('signal_mediastinal', [
    String.raw`\bmediastin\w*`,
    String.raw`\bhilar\b`,
    String.raw`\bthymoma\w*`,
    String.raw`\bthymic\b`,
    String.raw`\bsuperior vena cava\b`,
  ]),
  domain('signal_bronchoscopy', [
    String.raw`\bbronchoscop\w*`,
    String.raw`\bebus\b`,
    String.raw`\beus-b\b`,
    String.raw`\bendobronchial ultrasound\b`,
    String.raw`\btransbronchial\b`,
    String.raw`\bbronchoalveolar\b`,
    String.raw`\bcryobiops\w*`,
    String.raw`\bnavigational bronch\w*`,
    String.raw`\brigid bronch\w*`,
  ]),
  domain('signal_pulmonary_procedure', [
    String.raw`\bthoracentesis\b`,
    String.raw`\bpleurodesis\b`,
    String.raw`\bthoracostomy\b`,
    String.raw`\bthoracotomy\b`,
    String.raw`\bthoracoscop\w*`,
    String.raw`\bpleuroscop\w*`,
    String.raw`\btracheostomy\b`,
    String.raw`\bchest (?:tube|drain)`,
    String.raw`\blung biops\w*`,
    String.raw`\blobectom\w*`,
    String.raw`\bpneumonectom\w*`,
    String.raw`\bsegmentectom\w*`,
    String.raw`\bbullectom\w*`,
    String.raw`\blung volume reduction\b`,
    String.raw`\bairway stent\w*`,
    String.raw`\blung transplant\w*`,
    String.raw`\bwhole lung lavage\b`,
  ]),
  domain('signal_thoracic_oncology', [
    String.raw`\bmesothelioma\w*`,
    String.raw`\bpancoast\b`,
    String.raw`\bchest wall (?:tumor|tumour|mass|resection)`,
    String.raw`\besophageal (?:cancer|carcinoma)`,
    String.raw`\bthoracic (?:oncolog\w*|malignanc\w*|radiation|radiotherapy)`,
    String.raw`\bpulmonary metastas\w*`,
    String.raw`\bmalignant (?:pleural|airway|central airway)`,
  ]),
  domain('signal_respiratory_failure', [
    String.raw`\brespiratory failure\b`,
    String.raw`\bmechanical ventilation\b`,
    String.raw`\bventilator\w*`,
    String.raw`\bards\b`,
    String.raw`\bacute respiratory distress\b`,
    String.raw`\bhypoxemi\w*`,
    String.raw`\bhypoxaemi\w*`,
    String.raw`\bhypercapni\w*`,
    String.raw`\bnoninvasive ventilation\b`,
    String.raw`\bhigh[- ]flow nasal\b`,
  ]),
  domain('signal_critical_care', [
    String.raw`\bintensive care\b`,
    String.raw`\bcritical care\b`,
    String.raw`\bcritically ill\b`,
    String.raw`\bicu\b`,
    String.raw`\bsepsis\b`,
    String.raw`\bseptic shock\b`,
    String.raw`\bresuscitat\w*`,
    String.raw`\becmo\b`,
    String.raw`\bextracorporeal membrane\b`,
  ]),
  domain('signal_anesthesia', [
    String.raw`\ban(?:a)?esthes\w*`,
    String.raw`\ban(?:a)?esthetic\w*`,
    String.raw`\bairway management\b`,
    String.raw`\bintubation\b`,
    String.raw`\bendotracheal\b`,
    String.raw`\blaryngeal mask\b`,
    String.raw`\bdouble[- ]lumen\b`,
    String.raw`\bone[- ]lung ventilation\b`,
    String.raw`\bjet ventilation\b`,
    String.raw`\bprocedural sedation\b`,
  ]),
  domain('signal_pathology', [
    String.raw`\bcytolog\w*`,
    String.raw`\bcytopatholog\w*`,
    String.raw`\bhistopatholog\w*`,
    String.raw`\bfine[- ]needle aspiration\b`,
    String.raw`\bfrozen section\b`,
    String.raw`\brapid on[- ]site\b`,
    String.raw`\bimmunohistochem\w*`,
    String.raw`\bsurgical pathology\b`,
  ]),
  domain('signal_imaging', [
    String.raw`\bchest (?:x[- ]ray|radiograph\w*|ct\b|computed tomography|imaging|ultrasound)`,
    String.raw`\b(?:lung|pulmonary|thoracic) (?:imaging|ultrasound|ultrasonography|ct\b|mri\b)`,
    String.raw`\blow[- ]dose (?:ct|computed tomography)`,
    String.raw`\blung[- ]rads\b`,
    String.raw`\bfluoroscop\w*`,
    String.raw`\bcone[- ]beam\b`,
    String.raw`\bradiomics\b`,
  ]),
  domain('signal_procedural_complication', [
    String.raw`\bhemoptysis\b`,
    String.raw`\bhaemoptysis\b`,
    String.raw`\bbronchopleural fistula\w*`,
    String.raw`\btracheoesophageal fistula\w*`,
    String.raw`\bairway (?:obstruction|injury|perforation|stenosis)`,
    String.raw`\btracheal (?:injury|stenosis|rupture)`,
    String.raw`\bstent (?:migration|fracture|obstruction)`,
    String.raw`\biatrogenic (?:pneumothorax|airway|tracheal)`,
    String.raw`\bmassive hemoptysis\b`,
  ]),
  domain('signal_legacy_terminology', [
    String.raw`\bphthisis\b`,
    String.raw`\bplombage\b`,
    String.raw`\bthoracoplasty\b`,
    String.raw`\bpneumonolysis\b`,
    String.raw`\bpneumolysis\b`,
    String.raw`\bartificial pneumothorax\b`,
    String.raw`\bbronchograph\w*`,
    String.raw`\boleothorax\b`,
    String.raw`\bpneumoperitoneum therapy\b`,
    String.raw`\bcollapse therapy\b`,
    String.raw`\beloesser\b`,
    String.raw`\bmonaldi\b`,
  ]),
]

function matchDomains(text: string): ReadonlySet<CoordinatorRiskFlag> {
  const matched = new Set<CoordinatorRiskFlag>()
  if (text.length === 0) {
    return matched
  }
  for (const entry of COORDINATOR_RISK_LEXICON) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      matched.add(entry.flag)
    }
  }
  return matched
}

function joinFieldText(fields: RiskScanFields): string {
  return [
    fields.title,
    fields.abstract ?? '',
    fields.journal ?? '',
    fields.meshTerms.join('\n'),
    fields.keywords.join('\n'),
    fields.publicationTypes.join('\n'),
  ].join('\n')
}

/**
 * Evaluate the full deterministic risk profile for one record. Domain flags are computed over
 * the combined bibliographic text; the title/abstract mismatch flag compares the title's
 * domain signals against the abstract's when an abstract exists, so a record whose two
 * narratives disagree is always surfaced to a physician even if the model was confident.
 */
export function evaluateCoordinatorRiskFlags(fields: RiskScanFields): CoordinatorRiskFlag[] {
  const flags = new Set<CoordinatorRiskFlag>(matchDomains(joinFieldText(fields)))
  if (fields.abstract !== null && fields.abstract.trim().length > 0) {
    const titleDomains = matchDomains(fields.title)
    const abstractDomains = matchDomains(fields.abstract)
    const disagreement =
      (titleDomains.size > 0 && abstractDomains.size === 0) ||
      (titleDomains.size === 0 && abstractDomains.size > 0)
    if (disagreement) {
      flags.add('signal_title_abstract_mismatch')
    }
  }
  return COORDINATOR_RISK_FLAGS.filter((flag) => flags.has(flag))
}
