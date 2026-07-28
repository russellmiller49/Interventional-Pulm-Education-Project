import {
  registerCriticalCareDerivedValueGuides,
  resolveInterpretation,
  type CriticalCareDerivedValueGuide,
} from '@/features/critical-care/content/derivedValueGuides'
import { SHARED_CRITICAL_CARE_THRESHOLDS } from '@/features/critical-care/content/sharedClinicalThresholds'

/**
 * MCS owns the interpretation of CPO and PAPi; hemodynamics cross-links to it.
 *
 * This file is now a thin binding over the shared model. The numbers and their meanings are
 * unchanged from the previous `normalRange` / `actionableThresholds` version — what changed is that
 * each one now declares what kind of reference it is, so a cohort cut point can no longer be
 * rendered as though it were a treatment target.
 */
export type McsSharedDerivedValueId = 'cardiacPowerOutputW' | 'pulmonaryArteryPulsatilityIndex'

const cpoThresholds = SHARED_CRITICAL_CARE_THRESHOLDS.cardiacPowerOutput
const papiThresholds = SHARED_CRITICAL_CARE_THRESHOLDS.pulmonaryArteryPulsatilityIndex

const cardiacPowerOutput: CriticalCareDerivedValueGuide = {
  id: 'mcs.cardiacPowerOutputW',
  label: 'CPO',
  unit: 'W',
  formula: 'MAP × effective systemic flow / 451',
  liveValueType: 'derived',
  interpretation:
    'Read CPO as a pressure–flow summary within the shock phenotype in front of you. No universal normal interval or treatment target is used.',
  references: [
    {
      id: 'mcs.cpo.original-cohort',
      kind: 'cohort-observation',
      statement: `A cut point of ${cpoThresholds.originalCohortWatts} W identified a high-risk group.`,
      appliesWhen:
        'The original acute-cardiac cohort in which this cut point was derived. It is an observation in that population, not a definition of adequate perfusion.',
      evidenceIds: [...cpoThresholds.evidenceIds],
    },
    {
      id: 'mcs.cpo.high-risk-teaching-band',
      kind: 'cohort-observation',
      statement: `Values near or below ${cpoThresholds.highRiskTeachingWatts} W are commonly discussed as a high-risk low-power state.`,
      appliesWhen:
        'Shock cohorts discussed in the cited reviews. A teaching band drawn from those cohorts, not a threshold for action.',
      evidenceIds: [...cpoThresholds.evidenceIds],
    },
    {
      id: 'mcs.cpo.formula',
      kind: 'formula-definition',
      statement: 'CPO = MAP × effective systemic flow / 451.',
      appliesWhen: 'Wherever both inputs are themselves valid measurements.',
      evidenceIds: [...cpoThresholds.evidenceIds],
      caveat: 'CPO inherits the error of both inputs.',
    },
  ],
  rules: [
    {
      id: 'mcs.cpo.at-or-below-cohort-cut-point',
      interval: { lte: cpoThresholds.originalCohortWatts },
      statement: `At or below the ${cpoThresholds.originalCohortWatts} W cut point reported in the original acute-cardiac cohort.`,
      referenceIds: ['mcs.cpo.original-cohort'],
    },
    {
      id: 'mcs.cpo.inside-teaching-band',
      interval: { lte: cpoThresholds.highRiskTeachingWatts },
      statement: `Inside the high-risk low-power teaching band near ${cpoThresholds.highRiskTeachingWatts} W.`,
      referenceIds: ['mcs.cpo.high-risk-teaching-band'],
    },
    {
      id: 'mcs.cpo.above-cited-bands',
      statement: `Above the cited ${cpoThresholds.highRiskTeachingWatts} W cohort band; this alone does not establish adequate perfusion.`,
      referenceIds: ['mcs.cpo.high-risk-teaching-band'],
    },
  ],
  caveats:
    'The cut points are cohort observations. CPO inherits error from MAP and flow, and an improved value does not by itself prove organ perfusion.',
  doNotInfer:
    'Do not read a CPO above the cited bands as evidence that perfusion is adequate, and do not treat either cut point as a target to drive a patient toward.',
  conceptIds: ['cc.perfusion.cardiac-output', 'cc.perfusion.macro-micro-coherence'],
  reviewStatus: 'sme-review',
}

const pulmonaryArteryPulsatilityIndex: CriticalCareDerivedValueGuide = {
  id: 'mcs.pulmonaryArteryPulsatilityIndex',
  label: 'PAPi',
  formula: '(PASP − PADP) / RAP',
  liveValueType: 'derived',
  interpretation:
    'Useful PAPi bands depend strongly on phenotype, signal validity, and trajectory. No universal normal interval exists.',
  references: [
    {
      id: 'mcs.papi.acute-rv-infarction-cohort',
      kind: 'cohort-observation',
      statement: `PAPi at or below ${papiThresholds.acuteRvInfarctionHighRiskMax} was high risk.`,
      appliesWhen:
        'An acute inferior-RV-infarction cohort. The band is specific to that population and presentation.',
      evidenceIds: [...papiThresholds.evidenceIds],
    },
    {
      id: 'mcs.papi.advanced-heart-failure-band',
      kind: 'cohort-observation',
      statement: `Values below ${papiThresholds.advancedHeartFailureTeachingMax} are commonly discussed in advanced-heart-failure and LVAD literature.`,
      appliesWhen:
        'Advanced heart failure and durable LVAD populations. Context-specific, and not an engine alarm or a universal definition of RV failure.',
      evidenceIds: [...papiThresholds.evidenceIds],
    },
    {
      id: 'mcs.papi.formula',
      kind: 'formula-definition',
      statement: 'PAPi = (PASP − PADP) / RAP.',
      appliesWhen: 'Wherever the pulmonary artery and right atrial signals are themselves valid.',
      evidenceIds: [...papiThresholds.evidenceIds],
      caveat: 'A PAPi computed from an invalid RAP is not a PAPi.',
    },
  ],
  rules: [
    {
      id: 'mcs.papi.at-or-below-rv-infarction-band',
      interval: { lte: papiThresholds.acuteRvInfarctionHighRiskMax },
      statement: `At or below the ${papiThresholds.acuteRvInfarctionHighRiskMax} high-risk band reported for acute inferior RV infarction.`,
      referenceIds: ['mcs.papi.acute-rv-infarction-cohort'],
    },
    {
      id: 'mcs.papi.below-advanced-hf-band',
      interval: { lt: papiThresholds.advancedHeartFailureTeachingMax },
      statement: `Below the ${papiThresholds.advancedHeartFailureTeachingMax} context-specific teaching band discussed in advanced heart failure and LVAD cohorts.`,
      referenceIds: ['mcs.papi.advanced-heart-failure-band'],
    },
    {
      id: 'mcs.papi.above-cited-bands',
      statement:
        'Above the cited cohort teaching bands; this does not exclude RV dysfunction or limited RV delivery.',
      referenceIds: ['mcs.papi.advanced-heart-failure-band'],
    },
  ],
  caveats:
    'Dynamic response, catheter position, RAP validity, pulmonary vascular load, and the population being studied can materially change interpretation.',
  doNotInfer:
    'Do not read a PAPi above the cited bands as excluding RV dysfunction, and do not use either band as a definition of RV failure.',
  conceptIds: ['cc.flow.rv-lv-coupling', 'cc.measurement.signal-validity'],
  reviewStatus: 'sme-review',
}

export const mcsDerivedValueGuideList = registerCriticalCareDerivedValueGuides([
  cardiacPowerOutput,
  pulmonaryArteryPulsatilityIndex,
])

export const mcsDerivedValueGuides = {
  cardiacPowerOutputW: cardiacPowerOutput,
  pulmonaryArteryPulsatilityIndex,
} as const satisfies Readonly<Record<McsSharedDerivedValueId, CriticalCareDerivedValueGuide>>

/**
 * A deterministic curriculum-model boundary, not a clinical PAPi cutoff.
 *
 * Paired with an explicit `educational-model-boundary` reference so nothing can render it as a
 * literature-derived definition of RV failure. Evidence boundary: mcs-educational-model-v1.
 */
export const MCS_MODEL_BOUNDARIES = {
  rvLimitedPapiMax: 1.5,
} as const

export const MCS_MODEL_BOUNDARY_REFERENCES = Object.freeze({
  rvLimitedPapiMax: {
    id: 'mcs.papi.simulator-rv-limited-boundary',
    kind: 'educational-model-boundary' as const,
    statement: `This simulator treats a PAPi below ${MCS_MODEL_BOUNDARIES.rvLimitedPapiMax} as its RV-limited state.`,
    appliesWhen:
      'Inside this simulation only. It is a rule this model follows in order to behave deterministically, and carries no clinical authority.',
    evidenceIds: ['mcs-educational-model-v1'] as readonly string[],
  },
})

/** Interpretation now resolves through the shared rule engine rather than a private if-chain. */
export function interpretMcsCardiacPowerOutput(valueWatts: number): string {
  return resolveInterpretation(cardiacPowerOutput, valueWatts)?.rule.statement ?? ''
}

export function interpretMcsPapi(value: number): string {
  return resolveInterpretation(pulmonaryArteryPulsatilityIndex, value)?.rule.statement ?? ''
}

/** The reference IDs behind whatever interpretation a value resolves to. */
export function mcsCardiacPowerOutputReferenceIds(valueWatts: number): readonly string[] {
  return resolveInterpretation(cardiacPowerOutput, valueWatts)?.rule.referenceIds ?? []
}

export function mcsPapiReferenceIds(value: number): readonly string[] {
  return resolveInterpretation(pulmonaryArteryPulsatilityIndex, value)?.rule.referenceIds ?? []
}
