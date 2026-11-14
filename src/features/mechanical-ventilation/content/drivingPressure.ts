/**
 * Driving pressure, worked from what the screen already shows.
 *
 * The lung-protection section tells the learner to read a driving pressure (plateau minus total
 * PEEP) against a reference, and left the subtraction to them. This works it, and only when there
 * is a plateau to work it from: an occlusion that happened, on a quiet patient, under the settings
 * still in force (`PlateauAcquisition.supportsMechanicsClaim`, the one gate for every claim that
 * needs a valid plateau). In every other state it says why there is no number, in the state's own
 * terms. Nothing is estimated and no threshold is applied here.
 *
 * Total PEEP is set PEEP plus the model's intrinsic PEEP, as the pressure-decomposition panel
 * computes its baseline.
 */
import type { PlateauAcquisition } from './plateauAcquisition'

export interface DrivingPressureReadout {
  readonly shown: boolean
  readonly valueCmH2O: number | null
  readonly text: string
}

const WITHHELD: Record<Exclude<PlateauAcquisition['status'], 'acquired-valid'>, string> = {
  'reference-estimate':
    'waiting for an inspiratory hold. The plateau on screen is an estimate from the trace.',
  'not-acquired': 'waiting for an inspiratory hold.',
  pending: 'the inspiratory hold has not finished.',
  'acquired-invalid': 'not read from this hold. The patient was pulling through it.',
  stale: 'the settings or the patient have changed since the hold. Perform it again.',
}

export function drivingPressureReadout(
  acquisition: PlateauAcquisition,
  setPeepCmH2O: number,
  intrinsicPeepCmH2O: number,
): DrivingPressureReadout {
  if (
    acquisition.status !== 'acquired-valid' ||
    !acquisition.supportsMechanicsClaim ||
    acquisition.valueCmH2O === null
  )
    return {
      shown: false,
      valueCmH2O: null,
      text: `Driving pressure: ${WITHHELD[acquisition.status === 'acquired-valid' ? 'not-acquired' : acquisition.status]}`,
    }
  // Worked from the figures as printed, so the line adds up for a reader checking it.
  const plateau = Number(acquisition.valueCmH2O.toFixed(1))
  const totalPeep = Number((setPeepCmH2O + intrinsicPeepCmH2O).toFixed(1))
  const value = Number((plateau - totalPeep).toFixed(1))
  const intrinsic = Number(intrinsicPeepCmH2O.toFixed(1))
  return {
    shown: true,
    valueCmH2O: value,
    text: `Driving pressure: plateau ${plateau.toFixed(1)} − total PEEP ${totalPeep.toFixed(1)} = ${value.toFixed(1)} cmH₂O. Total PEEP is set PEEP ${setPeepCmH2O.toFixed(1)} plus intrinsic PEEP ${intrinsic.toFixed(1)} (model estimate).`,
  }
}
