export type ClinicalContextId =
  | 'uncertain'
  | 'heart-failure-diuresis'
  | 'hepatic-renal-systemic'
  | 'pneumonia-infection'
  | 'tb-exposure'
  | 'malignancy'
  | 'post-procedure-lymphatic'
  | 'trauma-hemothorax'
  | 'pancreatic-esophageal'
  | 'autoimmune'

export type UltrasoundPattern =
  | 'anechoic-unilateral'
  | 'anechoic-bilateral'
  | 'septated'
  | 'complex-homogeneous'
  | 'nodular-thickened'
  | 'hematocrit-sign'
  | 'too-small'

export type FluidAppearance =
  | 'straw'
  | 'serous'
  | 'serosanguineous'
  | 'bloody'
  | 'milky'
  | 'turbid'
  | 'purulent'
  | 'green'
  | 'food-particles'
  | 'urine-odor'

export interface PleuralFluidInput {
  clinicalContext: ClinicalContextId
  ultrasound: UltrasoundPattern
  appearance: FluidAppearance
  serumProtein: number
  pleuralProtein: number
  serumLdh: number
  pleuralLdh: number
  serumLdhUpperLimit: number
  serumAlbumin?: number
  pleuralAlbumin?: number
  ntProBnp?: number
  pleuralPH: number
  pleuralGlucose: number
  nucleatedCells: number
  neutrophils: number
  lymphocytes: number
  eosinophils: number
  mesothelialCells: number
  triglycerides?: number
  cholesterol?: number
  ada?: number
  amylase?: number
  pleuralToBloodHematocritRatio?: number
  pleuralToSerumCreatinineRatio?: number
  pleuralToSerumBilirubinRatio?: number
  negativeCytologyCount?: number
  cytologyPositive: boolean
  microbiologyPositive: boolean
  chylomicronsPresent: boolean
}

export interface PleuralFluidCase {
  id: string
  title: string
  subtitle: string
  patient: string
  clinicalClues: readonly string[]
  teachingFocus: string
  input: PleuralFluidInput
}

export type FluidCategory = 'transudate' | 'exudate'

export interface LightCriteriaResult {
  proteinRatio: number
  ldhRatio: number
  ldhUpperLimitRatio: number
  proteinCriterion: boolean
  ldhRatioCriterion: boolean
  ldhUpperLimitCriterion: boolean
  positiveCriteria: readonly string[]
  classification: FluidCategory
}

export type FindingStrength = 'definitive' | 'highly suggestive' | 'supportive' | 'pitfall'

/**
 * Stable, locale-independent identifiers for each interpretation finding. The UI
 * maps these to localized strings (messages `pleuralFluidAnalysis.findings.*`) so
 * the conditional logic lives in one place instead of being duplicated per
 * language. The English `diagnosis` / `rationale` / `action` strings mirror these
 * for tests/non-UI use. See docs/i18n-localization.md.
 */
export type InterpretationFindingCode =
  | 'empyema'
  | 'malignantEffusion'
  | 'chylothorax'
  | 'hemothorax'
  | 'urinothoraxCreatinine'
  | 'bilothorax'
  | 'pancreaticopleuralFistula'
  | 'esophagealPerforation'
  | 'urinothoraxOdor'
  | 'parapneumonic'
  | 'tuberculous'
  | 'malignancyInPlay'
  | 'repeatedNegativeCytology'
  | 'autoimmunePleuritis'
  | 'eosinophilic'
  | 'lymphocytePredominant'
  | 'lymphaticLeak'
  | 'bloodInPleuralSpace'

/** Headline summarising the overall interpretation, as a stable code. */
export type InterpretationHeadlineCode =
  | 'pseudoexudate'
  | 'definitiveSignal'
  | 'exudatePattern'
  | 'transudatePattern'

/** Reconciliation paragraph variants, as stable codes. */
export type InterpretationReconciliationCode =
  | 'tooSmall'
  | 'pseudoexudate'
  | 'transudateButPretest'
  | 'exudateInfection'
  | 'exudateTb'
  | 'transudateAligned'
  | 'probabilityShifter'

/** Pseudoexudate-reason variants, as stable codes (values carry numeric args). */
export type PseudoexudateReasonCode =
  | 'proteinGradient'
  | 'albuminGradient'
  | 'ntProBnp'
  | 'weaklyPositive'

/** Next-action bundle variants, as stable codes (each maps to an array of strings). */
export type NextActionsCode =
  | 'tooSmall'
  | 'bilateralSystemic'
  | 'definitive'
  | 'pseudoexudate'
  | 'infection'
  | 'tb'
  | 'malignancyEscalate'
  | 'malignancyCytology'
  | 'transudate'
  | 'exudateGeneric'

/** Pitfall variants, as stable codes. */
export type PitfallCode =
  | 'pairedSerum'
  | 'diuresisCrossesLight'
  | 'systemicGradientCheck'
  | 'fragilePH'
  | 'milkyTurbid'
  | 'negativeCytology'
  | 'repeatedCytologyDelay'
  | 'mesothelialTb'

/** Routine-study variants, as stable codes. */
export type RoutineStudyCode =
  | 'grossAppearance'
  | 'proteinLdh'
  | 'ph'
  | 'glucose'
  | 'cellCount'
  | 'gramStainCulture'
  | 'cytology'

/** Targeted-study variants, as stable codes. */
export type TargetedStudyCode =
  | 'lipids'
  | 'hematocrit'
  | 'ada'
  | 'amylase'
  | 'bilirubin'
  | 'creatinine'
  | 'autoimmune'
  | 'branchPoint'

export interface PseudoexudateReason {
  code: PseudoexudateReasonCode
  /** Interpolation args for the localized template (e.g. gradient value). */
  args?: Record<string, string | number>
}

export interface InterpretationFinding {
  diagnosis: string
  strength: FindingStrength
  rationale: string
  action: string
  code: InterpretationFindingCode
}

export interface PleuralInterpretation {
  lightCriteria: LightCriteriaResult
  reconciledCategory: FluidCategory
  headline: string
  headlineCode: InterpretationHeadlineCode
  /** Diagnosis name for the `definitiveSignal` headline (as a finding code). */
  headlineDiagnosisCode?: InterpretationFindingCode
  reconciliation: string
  reconciliationCode: InterpretationReconciliationCode
  pseudoexudateReasons: readonly string[]
  pseudoexudateReasonDetails: readonly PseudoexudateReason[]
  findings: readonly InterpretationFinding[]
  nextActions: readonly string[]
  nextActionsCode: NextActionsCode
  pitfalls: readonly string[]
  pitfallCodes: readonly PitfallCode[]
  routineStudies: readonly string[]
  routineStudyCodes: readonly RoutineStudyCode[]
  targetedStudies: readonly string[]
  targetedStudyCodes: readonly TargetedStudyCode[]
}

export type DiseaseRarity = 'common' | 'uncommon' | 'rare' | 'very rare'

export type DifferentialRuleDomain = 'fluid' | 'targeted' | 'context'

export type DifferentialRuleKey =
  | keyof PleuralFluidInput
  | 'lightCategory'
  | 'reconciledCategory'
  | 'proteinRatio'
  | 'ldhRatio'
  | 'ldhUpperLimitRatio'
  | 'proteinGradient'
  | 'albuminGradient'

export type DifferentialRuleOperator =
  | 'eq'
  | 'oneOf'
  | 'gte'
  | 'lte'
  | 'between'
  | 'truthy'
  | 'falsy'

export interface DifferentialRule {
  key: DifferentialRuleKey
  operator: DifferentialRuleOperator
  value?: string | number | boolean
  values?: readonly (string | number | boolean)[]
  min?: number
  max?: number
  weight: number
  domain: DifferentialRuleDomain
  evidence: string
}

export interface DiseaseProfile {
  id: string
  name: string
  rarity: DiseaseRarity
  category: FluidCategory | 'either'
  family: string
  summary: string
  teachingPearl: string
  nextStep: string
  rules: readonly DifferentialRule[]
}

export interface DifferentialOptions {
  contextEmphasis: number
  raritySensitivity: number
  maxResults?: number
}

/**
 * Stable, locale-independent identifier for the diagnostic-lens label. The UI
 * maps it to a localized string (messages `pleuralFluidAnalysis.lens.*`).
 */
export type LensLabelCode =
  | 'broadCommon'
  | 'broadLabFirst'
  | 'contextHeavyRare'
  | 'narrowContext'
  | 'balanced'

export interface DifferentialResult {
  disease: DiseaseProfile
  score: number
  rank: number
  matchedEvidence: readonly string[]
  missingEvidence: readonly string[]
  rawScore: number
  maxScore: number
}

export interface DifferentialSummary {
  results: readonly DifferentialResult[]
  visibleResults: readonly DifferentialResult[]
  hiddenCount: number
  lensLabelCode: LensLabelCode
  lensLabel: string
}
