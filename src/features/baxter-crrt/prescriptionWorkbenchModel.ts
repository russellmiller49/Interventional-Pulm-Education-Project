import {
  PRISMAX_POST_FILTER_ULTRAFILTRATION_GATE,
  PRISMAX_PRE_INFUSION_FLOW_GATE,
  calculateEffluentDoseMlPerKgHour,
  calculatePlasmaFlowMlPerHour,
  calculatePrismaxEffluentPumpTargetMlPerHour,
  calculatePrismaxTotalPredilutionFraction,
} from './engine/clinicalMath'
import {
  assertFiniteNumber,
  assertNonNegativeNumber,
  assertPositiveNumber,
  integrateMillilitersPerHourForHours,
  millilitersPerMinuteToMillilitersPerHour,
} from './engine/units'

export type SyntheticBagStream =
  | 'pre-blood-pump'
  | 'dialysate'
  | 'pre-replacement'
  | 'post-replacement'

export interface PrescriptionWorkbenchInputs {
  readonly simulatedWeightKg: number
  readonly hematocritPercent: number
  readonly bloodFlowMlPerMinute: number
  readonly preBloodPumpMlPerHour: number
  readonly dialysateMlPerHour: number
  readonly preReplacementMlPerHour: number
  readonly postReplacementMlPerHour: number
  readonly patientFluidRemovalMlPerHour: number
  /** Medication-specific instructions are outside this general educational tool. */
  readonly anticoagulationConcept: 'none'
  /** The default build never infers a local solution inventory or configuration. */
  readonly solutionProfileId: null
  /** Optional teaching-only capacity. Null means no bag-duration result is produced. */
  readonly syntheticBagCapacityMl: number | null
  readonly syntheticBagStream: SyntheticBagStream
}

export type QualitativeSplitDirection =
  | 'pre-dominant'
  | 'equal-split'
  | 'post-dominant'
  | 'not-active'

export type QualitativeComparisonLevel = 'lower' | 'middle' | 'higher' | 'not-applicable'

export interface QualitativePrePostDilutionResult {
  readonly direction: QualitativeSplitDirection
  readonly totalReplacementMlPerHour: number
  readonly preReplacementShare: number | null
  readonly postReplacementShare: number | null
  /**
   * A normalized split-position index only. It is not a concentration, device
   * display, or patient-specific clearance estimate.
   */
  readonly filterInletConcentrationSplitIndex: number | null
  readonly filtrationFractionBurdenProxy: QualitativeComparisonLevel
  readonly effectiveClearanceTendencyProxy: QualitativeComparisonLevel
  readonly foulingTendencyProxy: QualitativeComparisonLevel
  readonly proxyStatus: 'authored-qualitative-proxy-source-limited'
  readonly sourceRecordIds: readonly [
    'REVIEW-CKRT-CORE-2025',
    'GUID-RRT-ICU-2026',
    'SYNTH-LAB-PREPOST-001',
  ]
  readonly omittedVariableCaveat: string
  readonly comparisonText: string
}

export interface SyntheticBagDurationResult {
  readonly status: 'available' | 'unavailable-zero-stream'
  readonly stream: SyntheticBagStream
  readonly streamLabel: string
  readonly capacityMl: number
  readonly streamRateMlPerHour: number
  readonly durationHours: number | null
  readonly limitation: string
}

export interface UnavailableWorkbenchOutput {
  readonly id:
    | 'effective-clearance'
    | 'total-circuit-ultrafiltration'
    | 'quantitative-ff'
    | 'whole-patient-net-removal'
  readonly label: string
  readonly status: 'unavailable-source-limited'
  readonly sourceRecordIds: readonly string[]
  readonly reason: string
}

export interface PrescriptionWorkbenchResult {
  readonly effluentPumpTargetMlPerHour: number
  readonly effluentDoseMlPerKgHour: number
  readonly plasmaFlowMlPerHour: number
  readonly machinePatientFluidRemovalTermMlPerHour: number
  readonly aggregateSourcePumpThroughputMlPerDay: number
  readonly totalPredilutionFraction: number | null
  readonly syntheticBagDuration: SyntheticBagDurationResult | null
  readonly prePostExperiment: QualitativePrePostDilutionResult
  readonly unavailableOutputs: readonly UnavailableWorkbenchOutput[]
  readonly sourceRecordIds: readonly string[]
  readonly assumptions: readonly string[]
}

const BAG_STREAM_LABELS: Readonly<Record<SyntheticBagStream, string>> = Object.freeze({
  'pre-blood-pump': 'PBP stream',
  dialysate: 'dialysate stream',
  'pre-replacement': 'pre-replacement stream',
  'post-replacement': 'post-replacement stream',
})

const QUALITATIVE_PROXY_SOURCE_RECORD_IDS = Object.freeze([
  'REVIEW-CKRT-CORE-2025',
  'GUID-RRT-ICU-2026',
  'SYNTH-LAB-PREPOST-001',
] as const)

const QUALITATIVE_PROXY_OMITTED_VARIABLE_CAVEAT =
  'This split-only comparison does not model blood flow, hematocrit, PBP dilution, modality, membrane or solute behavior, anticoagulation, filter condition, device configuration, or patient physiology.'

export const PRESCRIPTION_WORKBENCH_UNAVAILABLE_OUTPUTS: readonly UnavailableWorkbenchOutput[] =
  Object.freeze([
    Object.freeze({
      id: 'effective-clearance',
      label: 'Estimated effective clearance',
      status: 'unavailable-source-limited',
      sourceRecordIds: Object.freeze(['MATH-PM-004', 'MATH-PM-006']),
      reason:
        'The available references do not support estimating effective clearance from these entries alone.',
    }),
    Object.freeze({
      id: 'total-circuit-ultrafiltration',
      label: 'Total-circuit ultrafiltration',
      status: 'unavailable-source-limited',
      sourceRecordIds: Object.freeze([PRISMAX_POST_FILTER_ULTRAFILTRATION_GATE.sourceRecordId]),
      reason:
        'The available references do not support calculating total-circuit ultrafiltration from the entries shown.',
    }),
    Object.freeze({
      id: 'quantitative-ff',
      label: 'Quantitative filtration fraction',
      status: 'unavailable-source-limited',
      sourceRecordIds: Object.freeze([
        'MATH-PM-003',
        PRISMAX_PRE_INFUSION_FLOW_GATE.sourceRecordId,
      ]),
      reason:
        'A verified pre-infusion circuit-flow term is not available, so quantitative filtration fraction is not calculated.',
    }),
    Object.freeze({
      id: 'whole-patient-net-removal',
      label: 'Whole-patient net fluid removal',
      status: 'unavailable-source-limited',
      sourceRecordIds: Object.freeze(['FLUID-PM-001', 'FLUID-PM-002']),
      reason:
        'Whole-patient balance also requires patient inputs, non-machine outputs, actual machine removal, and downtime, which are not entered in this workbench.',
    }),
  ])

function safeRate(value: number, label: string): number {
  return assertNonNegativeNumber(value, label)
}

function getSyntheticBagStreamRate(
  inputs: PrescriptionWorkbenchInputs,
  stream: SyntheticBagStream,
): number {
  switch (stream) {
    case 'pre-blood-pump':
      return inputs.preBloodPumpMlPerHour
    case 'dialysate':
      return inputs.dialysateMlPerHour
    case 'pre-replacement':
      return inputs.preReplacementMlPerHour
    case 'post-replacement':
      return inputs.postReplacementMlPerHour
  }
}

function calculateSyntheticBagDuration(
  inputs: PrescriptionWorkbenchInputs,
): SyntheticBagDurationResult | null {
  if (inputs.syntheticBagCapacityMl === null) return null

  const capacityMl = assertPositiveNumber(inputs.syntheticBagCapacityMl, 'syntheticBagCapacityMl')
  const streamRateMlPerHour = safeRate(
    getSyntheticBagStreamRate(inputs, inputs.syntheticBagStream),
    'selectedSyntheticBagStreamRateMlPerHour',
  )

  if (streamRateMlPerHour === 0) {
    return Object.freeze({
      status: 'unavailable-zero-stream',
      stream: inputs.syntheticBagStream,
      streamLabel: BAG_STREAM_LABELS[inputs.syntheticBagStream],
      capacityMl,
      streamRateMlPerHour,
      durationHours: null,
      limitation:
        'No duration is calculated because the selected entered stream rate is zero. No device reserve or alarm behavior is inferred.',
    })
  }

  return Object.freeze({
    status: 'available',
    stream: inputs.syntheticBagStream,
    streamLabel: BAG_STREAM_LABELS[inputs.syntheticBagStream],
    capacityMl,
    streamRateMlPerHour,
    durationHours: assertFiniteNumber(
      capacityMl / streamRateMlPerHour,
      'syntheticBagDurationHours',
    ),
    limitation:
      'Teaching-only capacity divided by the selected entered stream rate; this is not a PrisMax bag, scale, change-time, reserve, or alarm prediction.',
  })
}

/**
 * Builds a direction-only pre/post comparison without executing the disputed
 * MATH-PM-004 or MATH-PM-006 expressions. No value is a device output or a
 * clinical target.
 */
export function calculateQualitativePrePostDilution(
  preReplacementMlPerHour: number,
  postReplacementMlPerHour: number,
): QualitativePrePostDilutionResult {
  const pre = safeRate(preReplacementMlPerHour, 'preReplacementMlPerHour')
  const post = safeRate(postReplacementMlPerHour, 'postReplacementMlPerHour')
  const total = assertFiniteNumber(pre + post, 'totalReplacementMlPerHour')

  if (total === 0) {
    return Object.freeze({
      direction: 'not-active',
      totalReplacementMlPerHour: 0,
      preReplacementShare: null,
      postReplacementShare: null,
      filterInletConcentrationSplitIndex: null,
      filtrationFractionBurdenProxy: 'not-applicable',
      effectiveClearanceTendencyProxy: 'not-applicable',
      foulingTendencyProxy: 'not-applicable',
      proxyStatus: 'authored-qualitative-proxy-source-limited',
      sourceRecordIds: QUALITATIVE_PROXY_SOURCE_RECORD_IDS,
      omittedVariableCaveat: QUALITATIVE_PROXY_OMITTED_VARIABLE_CAVEAT,
      comparisonText:
        'No replacement stream is entered, so the qualitative pre/post split experiment is inactive.',
    })
  }

  const preShare = pre / total
  const postShare = post / total

  if (pre === post) {
    return Object.freeze({
      direction: 'equal-split',
      totalReplacementMlPerHour: total,
      preReplacementShare: preShare,
      postReplacementShare: postShare,
      filterInletConcentrationSplitIndex: postShare,
      filtrationFractionBurdenProxy: 'middle',
      effectiveClearanceTendencyProxy: 'middle',
      foulingTendencyProxy: 'middle',
      proxyStatus: 'authored-qualitative-proxy-source-limited',
      sourceRecordIds: QUALITATIVE_PROXY_SOURCE_RECORD_IDS,
      omittedVariableCaveat: QUALITATIVE_PROXY_OMITTED_VARIABLE_CAVEAT,
      comparisonText:
        'The entered replacement flow is evenly split. The qualitative indicators sit at their comparison midpoint.',
    })
  }

  const preDominant = pre > post
  return Object.freeze({
    direction: preDominant ? 'pre-dominant' : 'post-dominant',
    totalReplacementMlPerHour: total,
    preReplacementShare: preShare,
    postReplacementShare: postShare,
    filterInletConcentrationSplitIndex: postShare,
    filtrationFractionBurdenProxy: preDominant ? 'lower' : 'higher',
    effectiveClearanceTendencyProxy: preDominant ? 'lower' : 'higher',
    foulingTendencyProxy: preDominant ? 'lower' : 'higher',
    proxyStatus: 'authored-qualitative-proxy-source-limited',
    sourceRecordIds: QUALITATIVE_PROXY_SOURCE_RECORD_IDS,
    omittedVariableCaveat: QUALITATIVE_PROXY_OMITTED_VARIABLE_CAVEAT,
    comparisonText: preDominant
      ? 'More replacement is entered before the filter: the split-only comparison assigns lower inlet-concentration, FF-burden, effective-clearance, and fouling indicator positions than the inverse split.'
      : 'More replacement is entered after the filter: the split-only comparison assigns higher inlet-concentration, FF-burden, effective-clearance, and fouling indicator positions than the inverse split.',
  })
}

/**
 * Learner-available source-linked summary. It intentionally provides no clinical
 * target range, anticoagulation prescription, solution recommendation,
 * delivered-dose estimate, or competency decision.
 */
export function calculatePrescriptionWorkbench(
  inputs: PrescriptionWorkbenchInputs,
): PrescriptionWorkbenchResult {
  if (inputs.anticoagulationConcept !== 'none') {
    throw new RangeError(
      'anticoagulationConcept must remain none because this tool provides no medication protocol',
    )
  }
  if (inputs.solutionProfileId !== null) {
    throw new RangeError(
      'solutionProfileId must remain null because the default build has no local solution registry',
    )
  }

  const simulatedWeightKg = assertPositiveNumber(inputs.simulatedWeightKg, 'simulatedWeightKg')
  const hematocritPercent = assertFiniteNumber(inputs.hematocritPercent, 'hematocritPercent')
  const bloodFlowMlPerMinute = safeRate(inputs.bloodFlowMlPerMinute, 'bloodFlowMlPerMinute')
  const preBloodPumpMlPerHour = safeRate(inputs.preBloodPumpMlPerHour, 'preBloodPumpMlPerHour')
  const dialysateMlPerHour = safeRate(inputs.dialysateMlPerHour, 'dialysateMlPerHour')
  const preReplacementMlPerHour = safeRate(
    inputs.preReplacementMlPerHour,
    'preReplacementMlPerHour',
  )
  const postReplacementMlPerHour = safeRate(
    inputs.postReplacementMlPerHour,
    'postReplacementMlPerHour',
  )
  const patientFluidRemovalMlPerHour = safeRate(
    inputs.patientFluidRemovalMlPerHour,
    'patientFluidRemovalMlPerHour',
  )
  const totalReplacementMlPerHour = assertFiniteNumber(
    preReplacementMlPerHour + postReplacementMlPerHour,
    'totalReplacementMlPerHour',
  )

  const effluentPumpTargetMlPerHour = calculatePrismaxEffluentPumpTargetMlPerHour({
    patientFluidRemovalMlPerHour,
    preBloodPumpMlPerHour,
    totalReplacementMlPerHour,
    dialysateMlPerHour,
    syringeMlPerHour: 0,
    makeupMlPerHour: 0,
  })
  const plasmaFlowMlPerHour = calculatePlasmaFlowMlPerHour(
    millilitersPerMinuteToMillilitersPerHour(bloodFlowMlPerMinute),
    hematocritPercent,
  )
  const aggregateSourcePumpRateMlPerHour = assertFiniteNumber(
    preBloodPumpMlPerHour + dialysateMlPerHour + preReplacementMlPerHour + postReplacementMlPerHour,
    'aggregateSourcePumpRateMlPerHour',
  )
  const totalPredilutionFraction =
    preBloodPumpMlPerHour + totalReplacementMlPerHour === 0
      ? null
      : calculatePrismaxTotalPredilutionFraction({
          preBloodPumpMlPerHour,
          preFilterReplacementMlPerHour: preReplacementMlPerHour,
          totalReplacementMlPerHour,
        })

  return Object.freeze({
    effluentPumpTargetMlPerHour,
    effluentDoseMlPerKgHour: calculateEffluentDoseMlPerKgHour(
      effluentPumpTargetMlPerHour,
      simulatedWeightKg,
    ),
    plasmaFlowMlPerHour,
    machinePatientFluidRemovalTermMlPerHour: patientFluidRemovalMlPerHour,
    aggregateSourcePumpThroughputMlPerDay: integrateMillilitersPerHourForHours(
      aggregateSourcePumpRateMlPerHour,
      24,
    ),
    totalPredilutionFraction,
    syntheticBagDuration: calculateSyntheticBagDuration(inputs),
    prePostExperiment: calculateQualitativePrePostDilution(
      preReplacementMlPerHour,
      postReplacementMlPerHour,
    ),
    unavailableOutputs: PRESCRIPTION_WORKBENCH_UNAVAILABLE_OUTPUTS,
    sourceRecordIds: Object.freeze([
      'MATH-PM-001',
      'DOSE-PM-001',
      'MATH-PM-003',
      'MATH-PM-005',
      'MATH-PM-004',
      'MATH-PM-006',
      'FLUID-PM-001',
      'FLUID-PM-002',
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'SYNTH-LAB-PRESCRIPTION-001',
      'SYNTH-LAB-PREPOST-001',
    ]),
    assumptions: Object.freeze([
      'Syringe and makeup flow terms are held at zero because no reviewed local configuration is bound.',
      'Daily aggregate source-pump throughput sums PBP, dialysate, and replacement pump entries for bag-use arithmetic only. Dialysate remains in its separate dialysate compartment and is not labeled as blood-side or patient input; PFR is excluded.',
      'The effluent result is the source-linked pump-target expression, not measured delivered clearance or a clinical dose target.',
    ]),
  })
}
