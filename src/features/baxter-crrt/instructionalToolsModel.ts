import {
  advanceFluidLedger,
  calculateWholePatientNetBalanceMl,
  emptyExternalFluidRates,
  emptyFluidLedgerTotals,
} from './engine/fluidModel'

export const transportMechanismCandidateSourceIds = Object.freeze([
  'REVIEW-CKRT-CORE-2025',
  'GUID-RRT-ICU-2026',
  'SYNTH-LAB-TRANSPORT-001',
] as const)

export const fluidLedgerCandidateSourceIds = Object.freeze([
  'FLUID-PM-001',
  'FLUID-PM-002',
  'WHITE-2024',
  'GONEUTRAL-2024',
  'SYNTH-LAB-FLUID-001',
] as const)

export interface SyntheticTransportInputs {
  readonly concentrationDifferenceLevel: number
  readonly diffusivePassageLevel: number
  readonly waterMovementLevel: number
  readonly convectivePassageLevel: number
  readonly adsorptiveAffinityLevel: number
  readonly availableBindingSurfaceLevel: number
  readonly moleculeClass: SyntheticMoleculeClass
  readonly flowArrangement: SyntheticFlowArrangement
}

export interface SyntheticTransportResult {
  readonly diffusionIndex: number
  readonly convectionIndex: number
  readonly ultrafiltrationIndex: number
  readonly adsorptionIndex: number
  readonly comparisonText: string
  readonly moleculeObservation: string
  readonly flowObservation: string
  readonly adsorptionObservation: string
}

export type SyntheticMoleculeClass = 'small-analogue' | 'middle-analogue'

export type SyntheticFlowArrangement = 'countercurrent' | 'concurrent'

export type QualitativeCrrtModality = 'scuf' | 'cvvh' | 'cvvhd' | 'cvvhdf'

export type QualitativeEffluentTermStatus =
  | 'contributor'
  | 'conditional contributor'
  | 'not introduced'
  | 'balance context'

export interface QualitativeEffluentTerm {
  readonly label: string
  readonly status: QualitativeEffluentTermStatus
  readonly description: string
}

export interface QualitativeEffluentProfile {
  readonly id: QualitativeCrrtModality
  readonly label: string
  readonly mechanismLabels: readonly string[]
  readonly summary: string
  readonly terms: readonly QualitativeEffluentTerm[]
  readonly boundary: string
}

export interface SyntheticFluidLedgerInputs {
  readonly durationHours: number
  readonly externalInputMlHour: number
  readonly externalOutputMlHour: number
  readonly machinePatientFluidRemovalMlHour: number
}

export interface SyntheticFluidLedgerResult {
  readonly externalInputMl: number
  readonly externalOutputMl: number
  readonly machinePatientFluidRemovalMl: number
  readonly combinedOutputMl: number
  readonly wholePatientNetBalanceMl: number
  readonly direction: 'positive' | 'negative' | 'even'
}

function finiteNonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, nonnegative number.`)
  }
  return value
}

function syntheticLevel(value: number, label: string): number {
  finiteNonnegative(value, label)
  if (value > 100) throw new RangeError(`${label} must not exceed 100.`)
  return value
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

export const qualitativeEffluentProfiles: Readonly<
  Record<QualitativeCrrtModality, QualitativeEffluentProfile>
> = Object.freeze({
  scuf: Object.freeze({
    id: 'scuf',
    label: 'SCUF',
    mechanismLabels: Object.freeze(['ultrafiltration']),
    summary:
      'In this simplified map, collected effluent is membrane ultrafiltrate. There is no dialysate stream.',
    terms: Object.freeze([
      Object.freeze({
        label: 'Patient-derived ultrafiltrate',
        status: 'contributor',
        description:
          'Water crossing the membrane and solutes able to pass with it can appear in the collected effluent.',
      }),
      Object.freeze({
        label: 'Spent dialysate',
        status: 'not introduced',
        description: 'The simplified SCUF map has no dialysate stream.',
      }),
      Object.freeze({
        label: 'Replacement-fluid relationship',
        status: 'not introduced',
        description: 'The simplified SCUF map has no replacement-fluid stream.',
      }),
    ]),
    boundary:
      'This identifies stream types only; it does not predict solute removal or a patient response.',
  }),
  cvvh: Object.freeze({
    id: 'cvvh',
    label: 'CVVH',
    mechanismLabels: Object.freeze(['ultrafiltration', 'convection']),
    summary:
      'In this simplified map, collected effluent is convective ultrafiltrate. There is no dialysate stream.',
    terms: Object.freeze([
      Object.freeze({
        label: 'Patient-derived ultrafiltrate',
        status: 'contributor',
        description:
          'Water crossing the membrane and solutes able to pass with that water contribute to collected effluent.',
      }),
      Object.freeze({
        label: 'Spent dialysate',
        status: 'not introduced',
        description: 'The simplified CVVH map has no dialysate stream.',
      }),
      Object.freeze({
        label: 'Replacement-fluid relationship',
        status: 'balance context',
        description:
          'Replacement fluid enters the circuit or patient-side balance. Its connection point can affect dilution and accounting, but it is not labeled as a separate collected effluent stream.',
      }),
    ]),
    boundary:
      'This identifies stream relationships only; it does not prescribe replacement volume or connection location.',
  }),
  cvvhd: Object.freeze({
    id: 'cvvhd',
    label: 'CVVHD',
    mechanismLabels: Object.freeze(['diffusion', 'ultrafiltration']),
    summary:
      'In this simplified map, collected effluent contains spent dialysate and may also include modeled net ultrafiltration.',
    terms: Object.freeze([
      Object.freeze({
        label: 'Patient-derived ultrafiltrate',
        status: 'conditional contributor',
        description:
          'Water crossing the membrane contributes when net patient-fluid removal is represented in the model.',
      }),
      Object.freeze({
        label: 'Spent dialysate',
        status: 'contributor',
        description:
          'Dialysate leaving the filter carries its post-exchange qualitative composition into the collected effluent.',
      }),
      Object.freeze({
        label: 'Replacement-fluid relationship',
        status: 'not introduced',
        description: 'The simplified CVVHD map has no replacement-fluid stream.',
      }),
    ]),
    boundary:
      'Spent dialysate and patient-fluid removal are distinct accounting concepts; this map assigns neither a quantity nor a target.',
  }),
  cvvhdf: Object.freeze({
    id: 'cvvhdf',
    label: 'CVVHDF',
    mechanismLabels: Object.freeze(['diffusion', 'ultrafiltration', 'convection']),
    summary:
      'In this simplified map, collected effluent combines spent dialysate and ultrafiltrate.',
    terms: Object.freeze([
      Object.freeze({
        label: 'Patient-derived ultrafiltrate',
        status: 'contributor',
        description:
          'Water crossing the membrane and solutes able to pass with that water contribute to collected effluent.',
      }),
      Object.freeze({
        label: 'Spent dialysate',
        status: 'contributor',
        description:
          'Dialysate leaving the filter contributes its post-exchange qualitative composition to collected effluent.',
      }),
      Object.freeze({
        label: 'Replacement-fluid relationship',
        status: 'balance context',
        description:
          'Replacement fluid is separately represented on the circuit or patient side; its connection point can affect dilution and overall accounting.',
      }),
    ]),
    boundary:
      'This stream map does not assign relative amounts, a dose, a prescription, or an expected clinical effect.',
  }),
})

export function getQualitativeEffluentProfile(
  modality: QualitativeCrrtModality,
): QualitativeEffluentProfile {
  return qualitativeEffluentProfiles[modality]
}

/**
 * Produces four unitless teaching indices. These values are deliberately not
 * clearance estimates, prescribed settings, or device outputs.
 */
export function calculateSyntheticTransport(
  inputs: SyntheticTransportInputs,
): SyntheticTransportResult {
  const concentrationDifferenceLevel = syntheticLevel(
    inputs.concentrationDifferenceLevel,
    'Concentration-difference level',
  )
  const diffusivePassageLevel = syntheticLevel(
    inputs.diffusivePassageLevel,
    'Diffusive-passage level',
  )
  const waterMovementLevel = syntheticLevel(inputs.waterMovementLevel, 'Water-movement level')
  const convectivePassageLevel = syntheticLevel(
    inputs.convectivePassageLevel,
    'Convective-passage level',
  )
  const adsorptiveAffinityLevel = syntheticLevel(
    inputs.adsorptiveAffinityLevel,
    'Adsorptive-affinity level',
  )
  const availableBindingSurfaceLevel = syntheticLevel(
    inputs.availableBindingSurfaceLevel,
    'Available-binding-surface level',
  )

  const diffusionIndex = rounded((concentrationDifferenceLevel * diffusivePassageLevel) / 100)
  const convectionIndex = rounded((waterMovementLevel * convectivePassageLevel) / 100)
  const ultrafiltrationIndex = rounded(waterMovementLevel)
  const adsorptionIndex = rounded((adsorptiveAffinityLevel * availableBindingSurfaceLevel) / 100)
  const comparisonText =
    diffusionIndex === convectionIndex
      ? 'The two relative indices are equal in this configuration.'
      : diffusionIndex > convectionIndex
        ? 'The diffusion index is higher in this conceptual configuration.'
        : 'The convection index is higher in this conceptual configuration.'

  const moleculeObservation =
    inputs.moleculeClass === 'small-analogue'
      ? 'In this conceptual analogue, the small-molecule label is paired with greater relative diffusive mobility; this is not a prediction for a named solute or membrane.'
      : 'In this conceptual analogue, the middle-molecule label is paired with less relative diffusive mobility; this is not a prediction for a named solute or membrane.'
  const flowObservation =
    inputs.flowArrangement === 'countercurrent'
      ? 'In this conceptual path, countercurrent blood and dialysate streams run in opposite directions and the concentration difference is sustained along more of the path; no device performance is predicted.'
      : 'In this conceptual path, concurrent blood and dialysate streams run in the same direction and the concentration difference narrows along the path; no device performance is predicted.'
  const adsorptionObservation =
    availableBindingSurfaceLevel === 0 || adsorptiveAffinityLevel === 0
      ? 'The adsorption index is zero because affinity or available binding surface is zero in this configuration.'
      : availableBindingSurfaceLevel < 35
        ? 'The adsorption index is constrained by limited available binding surface in this configuration.'
        : 'The adsorption index reflects both relative binding affinity and available membrane surface; it is not a clearance estimate.'

  return {
    diffusionIndex,
    convectionIndex,
    ultrafiltrationIndex,
    adsorptionIndex,
    comparisonText,
    moleculeObservation,
    flowObservation,
    adsorptionObservation,
  }
}

/**
 * Reuses the simulation engine's conservation math while keeping the exercise
 * disconnected from every case, device setting, score, and progress record.
 */
export function calculateSyntheticFluidLedger(
  inputs: SyntheticFluidLedgerInputs,
): SyntheticFluidLedgerResult {
  const durationHours = finiteNonnegative(inputs.durationHours, 'Observation interval')
  const externalInputMlHour = finiteNonnegative(inputs.externalInputMlHour, 'External-input rate')
  const externalOutputMlHour = finiteNonnegative(
    inputs.externalOutputMlHour,
    'External-output rate',
  )
  const machinePatientFluidRemovalMlHour = finiteNonnegative(
    inputs.machinePatientFluidRemovalMlHour,
    'Machine patient-fluid-removal rate',
  )

  const totals = advanceFluidLedger(
    emptyFluidLedgerTotals,
    {
      ...emptyExternalFluidRates,
      maintenanceInputMlHour: externalInputMlHour,
      urineOutputMlHour: externalOutputMlHour,
    },
    machinePatientFluidRemovalMlHour,
    0,
    durationHours * 3600,
  )
  const externalInputMl = totals.maintenanceInputMl
  const externalOutputMl = totals.urineOutputMl
  const machinePatientFluidRemovalMl = totals.machinePatientFluidRemovalMl
  const combinedOutputMl = externalOutputMl + machinePatientFluidRemovalMl
  const wholePatientNetBalanceMl = calculateWholePatientNetBalanceMl(totals)
  const direction =
    wholePatientNetBalanceMl > 0 ? 'positive' : wholePatientNetBalanceMl < 0 ? 'negative' : 'even'

  return {
    externalInputMl: rounded(externalInputMl),
    externalOutputMl: rounded(externalOutputMl),
    machinePatientFluidRemovalMl: rounded(machinePatientFluidRemovalMl),
    combinedOutputMl: rounded(combinedOutputMl),
    wholePatientNetBalanceMl: rounded(wholePatientNetBalanceMl),
    direction,
  }
}
