import { calculateEffluentDoseMlPerKgHour } from '../clinicalMath'
import type { CrrtFlowRates } from '../types'
import { assertFiniteNumber, assertNonNegativeNumber } from '../units'
import type {
  CrrtDeviceCalculationAdapter,
  DeviceCalculationSourceMap,
  DeviceDisplayedPressureCalculations,
  DeviceDisplayedPressureInput,
} from './calculations'

export const PRISMAFLEX_EFFLUENT_PUMP_TARGET_SOURCE_ID = 'DEV-PF-006' as const
export const PRISMAFLEX_DOSE_SECTION_EFFLUENT_SOURCE_ID = 'DEV-PF-006' as const
export const PRISMAFLEX_TMP_SOURCE_ID = 'DEV-PF-006' as const
export const PRISMAFLEX_FILTER_PRESSURE_DROP_SOURCE_ID = 'DEV-PF-005' as const
export const PRISMAFLEX_QEFF_DEFINITION_CONFLICT_ID = 'CONFLICT-010' as const

/** Device-display correction from G5036003 section 5:13-5:14; not an alarm limit. */
export const PRISMAFLEX_TMP_HYDROSTATIC_OFFSET_MMHG = -18
/** Device-display correction from G5036003 section 3:7; not an alarm limit. */
export const PRISMAFLEX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG = -25

export interface PrismaflexDeviceCalculationAdapter extends Omit<
  CrrtDeviceCalculationAdapter,
  'id' | 'status' | 'sourceIds'
> {
  readonly id: 'prismaflex-g5036003-6xx'
  readonly status: 'reviewer-only-phase-8-calculation-candidate'
  readonly sourceIds: DeviceCalculationSourceMap &
    Readonly<{
      doseSectionEffluentFlow: readonly string[]
    }>
  readonly unresolvedConflictIds: readonly ['CONFLICT-010']

  calculateDoseSectionEffluentFlowMlPerHour(flows: CrrtFlowRates): number
  calculateDoseSectionEffluentDoseMlPerKgHour(flows: CrrtFlowRates, bodyWeightKg: number): number
}

function prismaflexFlowTerm(value: number, name: keyof CrrtFlowRates): number {
  return assertNonNegativeNumber(value, name)
}

function assertPrismaflexMakeupFlowIsUnsupported(flows: CrrtFlowRates): void {
  const makeup = prismaflexFlowTerm(flows.makeupFlowMlHour, 'makeupFlowMlHour')
  if (makeup !== 0) {
    throw new RangeError(
      'Prismaflex G5036003 CRRT Qeff calculations do not include a sourced makeup-flow term.',
    )
  }
}

/**
 * Prismaflex CRRT effluent-pump target from G5036003 p5:12 / PDF p106.
 * The pump-control equation includes syringe flow. It is intentionally not
 * reused for the later dose-section Qeff definition (CONFLICT-010).
 */
export function calculatePrismaflexEffluentPumpTargetMlPerHour(flows: CrrtFlowRates): number {
  assertPrismaflexMakeupFlowIsUnsupported(flows)
  const patientFluidRemoval = prismaflexFlowTerm(
    flows.patientFluidRemovalMlHour,
    'patientFluidRemovalMlHour',
  )
  const preBloodPump = prismaflexFlowTerm(flows.pbpFlowMlHour, 'pbpFlowMlHour')
  const replacement =
    prismaflexFlowTerm(flows.preReplacementFlowMlHour, 'preReplacementFlowMlHour') +
    prismaflexFlowTerm(flows.postReplacementFlowMlHour, 'postReplacementFlowMlHour')
  const dialysate = prismaflexFlowTerm(flows.dialysateFlowMlHour, 'dialysateFlowMlHour')
  const syringe = prismaflexFlowTerm(flows.syringeFlowMlHour, 'syringeFlowMlHour')

  return assertFiniteNumber(
    patientFluidRemoval + preBloodPump + replacement + dialysate + syringe,
    'prismaflexEffluentPumpTargetMlPerHour',
  )
}

/**
 * Prismaflex Qeff as printed in the CRRT dose equations at G5036003 p5:19 /
 * PDF p113. This definition omits syringe flow, unlike the pump-control Qeff.
 * Both are retained under distinct names pending CONFLICT-010 review.
 */
export function calculatePrismaflexDoseSectionEffluentFlowMlPerHour(flows: CrrtFlowRates): number {
  assertPrismaflexMakeupFlowIsUnsupported(flows)
  const patientFluidRemoval = prismaflexFlowTerm(
    flows.patientFluidRemovalMlHour,
    'patientFluidRemovalMlHour',
  )
  const preBloodPump = prismaflexFlowTerm(flows.pbpFlowMlHour, 'pbpFlowMlHour')
  const replacement =
    prismaflexFlowTerm(flows.preReplacementFlowMlHour, 'preReplacementFlowMlHour') +
    prismaflexFlowTerm(flows.postReplacementFlowMlHour, 'postReplacementFlowMlHour')
  const dialysate = prismaflexFlowTerm(flows.dialysateFlowMlHour, 'dialysateFlowMlHour')

  return assertFiniteNumber(
    patientFluidRemoval + preBloodPump + replacement + dialysate,
    'prismaflexDoseSectionEffluentFlowMlPerHour',
  )
}

export function calculatePrismaflexDoseSectionEffluentDoseMlPerKgHour(
  flows: CrrtFlowRates,
  bodyWeightKg: number,
): number {
  return calculateEffluentDoseMlPerKgHour(
    calculatePrismaflexDoseSectionEffluentFlowMlPerHour(flows),
    bodyWeightKg,
  )
}

export function calculatePrismaflexTmpMmHg(input: DeviceDisplayedPressureInput): number {
  const filter = assertFiniteNumber(input.rawFilterPressureMmHg, 'rawFilterPressureMmHg')
  const returnPressure = assertFiniteNumber(input.rawReturnPressureMmHg, 'rawReturnPressureMmHg')
  const effluent = assertFiniteNumber(input.rawEffluentPressureMmHg, 'rawEffluentPressureMmHg')

  return assertFiniteNumber(
    (filter + returnPressure) / 2 - effluent + PRISMAFLEX_TMP_HYDROSTATIC_OFFSET_MMHG,
    'prismaflexTransmembranePressureMmHg',
  )
}

export interface PrismaflexFilterPressureDrop {
  readonly rawFilterPressureDropMmHg: number
  readonly displayedFilterPressureDropMmHg: number
}

export function calculatePrismaflexFilterPressureDropMmHg(
  rawFilterPressureMmHg: number,
  rawReturnPressureMmHg: number,
): PrismaflexFilterPressureDrop {
  const filter = assertFiniteNumber(rawFilterPressureMmHg, 'rawFilterPressureMmHg')
  const returnPressure = assertFiniteNumber(rawReturnPressureMmHg, 'rawReturnPressureMmHg')
  const rawFilterPressureDropMmHg = assertFiniteNumber(
    filter - returnPressure,
    'prismaflexRawFilterPressureDropMmHg',
  )

  return Object.freeze({
    rawFilterPressureDropMmHg,
    displayedFilterPressureDropMmHg: assertFiniteNumber(
      rawFilterPressureDropMmHg + PRISMAFLEX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
      'prismaflexDisplayedFilterPressureDropMmHg',
    ),
  })
}

/** Separate Prismaflex implementation; no PrisMax pressure helper is reused. */
export function calculatePrismaflexDisplayedPressures(
  input: DeviceDisplayedPressureInput,
): DeviceDisplayedPressureCalculations {
  const filterPressureDrop = calculatePrismaflexFilterPressureDropMmHg(
    input.rawFilterPressureMmHg,
    input.rawReturnPressureMmHg,
  )

  return Object.freeze({
    transmembranePressureMmHg: calculatePrismaflexTmpMmHg(input),
    rawFilterPressureDropMmHg: filterPressureDrop.rawFilterPressureDropMmHg,
    displayedFilterPressureDropMmHg: filterPressureDrop.displayedFilterPressureDropMmHg,
  })
}

/** Reviewer-only calculation candidate, intentionally outside the learner engine graph. */
export const prismaflexCalculationAdapter: PrismaflexDeviceCalculationAdapter = Object.freeze({
  id: 'prismaflex-g5036003-6xx',
  status: 'reviewer-only-phase-8-calculation-candidate',
  sourceIds: Object.freeze({
    effluentPumpTarget: Object.freeze([PRISMAFLEX_EFFLUENT_PUMP_TARGET_SOURCE_ID]),
    doseSectionEffluentFlow: Object.freeze([PRISMAFLEX_DOSE_SECTION_EFFLUENT_SOURCE_ID]),
    effluentDose: Object.freeze([PRISMAFLEX_DOSE_SECTION_EFFLUENT_SOURCE_ID]),
    transmembranePressure: Object.freeze([PRISMAFLEX_TMP_SOURCE_ID]),
    filterPressureDrop: Object.freeze([PRISMAFLEX_FILTER_PRESSURE_DROP_SOURCE_ID]),
  }),
  unresolvedConflictIds: Object.freeze([PRISMAFLEX_QEFF_DEFINITION_CONFLICT_ID] as const),
  calculateEffluentPumpTargetMlPerHour: calculatePrismaflexEffluentPumpTargetMlPerHour,
  calculateDoseSectionEffluentFlowMlPerHour: calculatePrismaflexDoseSectionEffluentFlowMlPerHour,
  calculateEffluentDoseMlPerKgHour,
  calculateDoseSectionEffluentDoseMlPerKgHour(flows: CrrtFlowRates, bodyWeightKg: number) {
    return calculatePrismaflexDoseSectionEffluentDoseMlPerKgHour(flows, bodyWeightKg)
  },
  calculateDisplayedPressures: calculatePrismaflexDisplayedPressures,
})
