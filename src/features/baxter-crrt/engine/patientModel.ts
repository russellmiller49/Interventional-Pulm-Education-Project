import type { ConfiguredPatientModelState, HemodynamicModelParameters } from './types'

function nonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and nonnegative.`)
  }
  return value
}

/**
 * Updates a bounded educational tolerance index without predicting a real
 * blood pressure. All response coefficients are supplied by reviewed content.
 */
export function advancePatientFluidTolerance(
  patient: ConfiguredPatientModelState,
  actualMachinePfrMlHour: number,
  wholePatientBalanceDeltaMl: number,
  parameters: HemodynamicModelParameters | null,
  durationSeconds: number,
): ConfiguredPatientModelState {
  const durationHours = nonnegative(durationSeconds, 'Duration') / 3600
  const pfr = nonnegative(actualMachinePfrMlHour, 'Actual machine PFR')
  if (!Number.isFinite(wholePatientBalanceDeltaMl)) {
    throw new RangeError('Whole-patient balance delta must be finite.')
  }
  const excessRemovalRateMlHour = Math.max(0, pfr - patient.vascularRefillCapacityMlHour)
  const requestedReserveUseMl = excessRemovalRateMlHour * durationHours
  const reserveUseMl = Math.min(patient.intravascularReserveMl, requestedReserveUseMl)
  const uncompensatedRemovalLiters = Math.max(0, requestedReserveUseMl - reserveUseMl) / 1000

  let hemodynamicStressIndex = patient.hemodynamicStressIndex
  if (parameters) {
    nonnegative(parameters.stressGainPerExcessRemovalLiter, 'Hemodynamic stress gain')
    nonnegative(parameters.stressRecoveryPerHour, 'Hemodynamic stress recovery')
    hemodynamicStressIndex = Math.min(
      1,
      Math.max(
        0,
        hemodynamicStressIndex +
          uncompensatedRemovalLiters * parameters.stressGainPerExcessRemovalLiter -
          (excessRemovalRateMlHour === 0 ? parameters.stressRecoveryPerHour * durationHours : 0),
      ),
    )
  }

  return {
    ...patient,
    intravascularReserveMl: patient.intravascularReserveMl - reserveUseMl,
    totalFluidOverloadMl: patient.totalFluidOverloadMl + wholePatientBalanceDeltaMl,
    hemodynamicStressIndex,
  }
}
