import { SHARED_CRITICAL_CARE_THRESHOLDS } from '@/features/critical-care/content/sharedClinicalThresholds'

export type McsSharedDerivedValueId = 'cardiacPowerOutputW' | 'pulmonaryArteryPulsatilityIndex'

export interface McsDerivedValueGuide {
  readonly id: McsSharedDerivedValueId
  readonly label: string
  readonly formula: string
  readonly normalRange: string
  readonly actionableThresholds: string
  readonly caveats: string
  readonly evidenceIds: readonly string[]
  readonly conceptIds: readonly string[]
}

const cpoThresholds = SHARED_CRITICAL_CARE_THRESHOLDS.cardiacPowerOutput
const papiThresholds = SHARED_CRITICAL_CARE_THRESHOLDS.pulmonaryArteryPulsatilityIndex

/**
 * These interpretations are owned by the MCS curriculum and reused by hemodynamics. They describe
 * context-specific cohort observations, not universal treatment targets.
 */
export const mcsDerivedValueGuides = {
  cardiacPowerOutputW: {
    id: 'cardiacPowerOutputW',
    label: 'CPO',
    formula: 'MAP × effective systemic flow / 451',
    normalRange:
      'No universal normal interval or treatment target is used; read CPO as a pressure-flow summary within the shock phenotype.',
    actionableThresholds: `Values near or below ${cpoThresholds.highRiskTeachingWatts} W identify a high-risk low-power state in shock cohorts; the original acute-cardiac cohort cut point was ${cpoThresholds.originalCohortWatts} W.`,
    caveats:
      'The cut points are cohort observations. CPO inherits error from MAP and flow, and an improved value does not by itself prove organ perfusion.',
    evidenceIds: cpoThresholds.evidenceIds,
    conceptIds: ['cc.perfusion.cardiac-output', 'cc.perfusion.macro-micro-coherence'],
  },
  pulmonaryArteryPulsatilityIndex: {
    id: 'pulmonaryArteryPulsatilityIndex',
    label: 'PAPi',
    formula: '(PASP − PADP) / RAP',
    normalRange:
      'No universal normal interval exists; useful PAPi bands depend strongly on phenotype, signal validity, and trajectory.',
    actionableThresholds: `PAPi at or below ${papiThresholds.acuteRvInfarctionHighRiskMax} was high risk in an acute inferior-RV-infarction cohort; values below ${papiThresholds.advancedHeartFailureTeachingMax} are commonly discussed in advanced-heart-failure/LVAD literature.`,
    caveats:
      'Dynamic response, catheter position, RAP validity, pulmonary vascular load, and the population being studied can materially change interpretation.',
    evidenceIds: papiThresholds.evidenceIds,
    conceptIds: ['cc.flow.rv-lv-coupling', 'cc.measurement.signal-validity'],
  },
} as const satisfies Readonly<Record<McsSharedDerivedValueId, McsDerivedValueGuide>>

/**
 * A deterministic curriculum-model boundary, not a clinical PAPi cutoff.
 * Evidence boundary: mcs-educational-model-v1.
 */
export const MCS_MODEL_BOUNDARIES = {
  rvLimitedPapiMax: 1.5,
} as const

export function interpretMcsCardiacPowerOutput(valueWatts: number): string {
  if (valueWatts <= cpoThresholds.originalCohortWatts) {
    return `At or below the ${cpoThresholds.originalCohortWatts} W cut point reported in the original acute-cardiac cohort.`
  }
  if (valueWatts <= cpoThresholds.highRiskTeachingWatts) {
    return `Inside the high-risk low-power teaching band near ${cpoThresholds.highRiskTeachingWatts} W.`
  }
  return `Above the cited ${cpoThresholds.highRiskTeachingWatts} W cohort band; this alone does not establish adequate perfusion.`
}

export function interpretMcsPapi(value: number): string {
  if (value <= papiThresholds.acuteRvInfarctionHighRiskMax) {
    return `At or below the ${papiThresholds.acuteRvInfarctionHighRiskMax} high-risk band reported for acute inferior RV infarction.`
  }
  if (value < papiThresholds.advancedHeartFailureTeachingMax) {
    return `Below the ${papiThresholds.advancedHeartFailureTeachingMax} context-specific teaching band discussed in advanced heart failure and LVAD cohorts.`
  }
  return `Above the cited cohort teaching bands; this does not exclude RV dysfunction or limited RV delivery.`
}
