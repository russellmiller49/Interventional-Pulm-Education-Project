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

export interface InterpretationFinding {
  diagnosis: string
  strength: FindingStrength
  rationale: string
  action: string
}

export interface PleuralInterpretation {
  lightCriteria: LightCriteriaResult
  reconciledCategory: FluidCategory
  headline: string
  reconciliation: string
  pseudoexudateReasons: readonly string[]
  findings: readonly InterpretationFinding[]
  nextActions: readonly string[]
  pitfalls: readonly string[]
  routineStudies: readonly string[]
  targetedStudies: readonly string[]
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
  lensLabel: string
}
