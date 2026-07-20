import type { BaxterCrrtDeviceId } from '../../content/deviceProfiles'
import {
  calculateEffluentDoseMlPerKgHour,
  calculatePrismaxEffluentPumpTargetMlPerHour,
  PRISMAX_EFFLUENT_DOSE_SOURCE_ID,
  PRISMAX_EFFLUENT_TARGET_SOURCE_ID,
} from '../clinicalMath'
import {
  calculatePrismaxFilterPressureDropMmHg,
  calculatePrismaxTmpMmHg,
  PRISMAX_FILTER_PRESSURE_DROP_SOURCE_ID,
  PRISMAX_TMP_SOURCE_ID,
} from '../pressureModel'
import type { CrrtFlowRates } from '../types'

export interface DeviceCalculationSourceMap {
  readonly effluentPumpTarget: readonly string[]
  readonly effluentDose: readonly string[]
  readonly transmembranePressure: readonly string[]
  readonly filterPressureDrop: readonly string[]
}

export interface DeviceDisplayedPressureInput {
  readonly rawFilterPressureMmHg: number
  readonly rawReturnPressureMmHg: number
  readonly rawEffluentPressureMmHg: number
}

export interface DeviceDisplayedPressureCalculations {
  readonly transmembranePressureMmHg: number
  readonly rawFilterPressureDropMmHg: number
  readonly displayedFilterPressureDropMmHg: number
}

/**
 * Phase 2's stateless calculation seam. This is deliberately narrower than
 * `CrrtDeviceAdapter`: it owns only source-mapped device math and has no setup,
 * alarm, control, or learner-interface behavior.
 */
export interface CrrtDeviceCalculationAdapter {
  readonly id: BaxterCrrtDeviceId
  readonly status: 'operational-v1'
  readonly sourceIds: DeviceCalculationSourceMap

  calculateEffluentPumpTargetMlPerHour(flows: CrrtFlowRates): number
  calculateEffluentDoseMlPerKgHour(effluentFlowMlPerHour: number, bodyWeightKg: number): number
  calculateDisplayedPressures(
    input: DeviceDisplayedPressureInput,
  ): DeviceDisplayedPressureCalculations
}

export const prismaxCalculationAdapter: CrrtDeviceCalculationAdapter = Object.freeze({
  id: 'prismax-aw8035-2xx',
  status: 'operational-v1',
  sourceIds: Object.freeze({
    effluentPumpTarget: Object.freeze([PRISMAX_EFFLUENT_TARGET_SOURCE_ID]),
    effluentDose: Object.freeze([PRISMAX_EFFLUENT_DOSE_SOURCE_ID]),
    transmembranePressure: Object.freeze([PRISMAX_TMP_SOURCE_ID]),
    filterPressureDrop: Object.freeze([PRISMAX_FILTER_PRESSURE_DROP_SOURCE_ID]),
  }),
  calculateEffluentPumpTargetMlPerHour(flows: CrrtFlowRates) {
    return calculatePrismaxEffluentPumpTargetMlPerHour({
      patientFluidRemovalMlPerHour: flows.patientFluidRemovalMlHour,
      preBloodPumpMlPerHour: flows.pbpFlowMlHour,
      totalReplacementMlPerHour: flows.preReplacementFlowMlHour + flows.postReplacementFlowMlHour,
      dialysateMlPerHour: flows.dialysateFlowMlHour,
      syringeMlPerHour: flows.syringeFlowMlHour,
      makeupMlPerHour: flows.makeupFlowMlHour,
    })
  },
  calculateEffluentDoseMlPerKgHour,
  calculateDisplayedPressures(input: DeviceDisplayedPressureInput) {
    const filterPressureDrop = calculatePrismaxFilterPressureDropMmHg(
      input.rawFilterPressureMmHg,
      input.rawReturnPressureMmHg,
    )
    return {
      transmembranePressureMmHg: calculatePrismaxTmpMmHg(input),
      rawFilterPressureDropMmHg: filterPressureDrop.rawPressureDropMmHg,
      displayedFilterPressureDropMmHg: filterPressureDrop.displayedPressureDropMmHg,
    }
  },
})

/**
 * Resolves the PrisMax calculation surface used by the learner runtime.
 */
export function getCrrtDeviceCalculationAdapter(
  deviceId: BaxterCrrtDeviceId,
): CrrtDeviceCalculationAdapter {
  if (deviceId === 'prismax-aw8035-2xx') return prismaxCalculationAdapter
  return assertNever(deviceId)
}

function assertNever(value: never): never {
  throw new Error(`Unsupported CRRT device calculation profile: ${String(value)}`)
}
