import { CAPSTONE_MIN_HELD, capstoneItemId, imagingCases } from '../content/cases'
import { peripheralImagingSectionIds } from '../content/pathway'
import { isSectionCompleted, type ImagingRecord } from './learnProgress'

/**
 * The capstone standard, evaluated over first decisions: at least seven of eight held, and every
 * safety-critical decision held. Kept exactly as the draft's `casePassed` rule; only the record
 * it reads has changed.
 */
export interface CapstoneStandard {
  readonly total: number
  readonly decided: number
  readonly held: number
  readonly criticalTotal: number
  readonly criticalHeld: number
  readonly complete: boolean
  readonly met: boolean
}

export function capstoneStandard(record: ImagingRecord): CapstoneStandard {
  let decided = 0
  let held = 0
  let criticalTotal = 0
  let criticalHeld = 0
  for (const imagingCase of imagingCases) {
    const attempt = record.firstAttempts[capstoneItemId(imagingCase.id)]
    if (imagingCase.critical) criticalTotal += 1
    if (!attempt) continue
    decided += 1
    if (attempt.correct) {
      held += 1
      if (imagingCase.critical) criticalHeld += 1
    }
  }
  const complete = decided === imagingCases.length
  return {
    total: imagingCases.length,
    decided,
    held,
    criticalTotal,
    criticalHeld,
    complete,
    met: complete && held >= CAPSTONE_MIN_HELD && criticalHeld === criticalTotal,
  }
}

/** The capstone opens only once every section has been worked through. */
export function capstoneUnlocked(record: ImagingRecord): {
  readonly unlocked: boolean
  readonly remaining: readonly string[]
} {
  const remaining = peripheralImagingSectionIds.filter((id) => !isSectionCompleted(record, id))
  return { unlocked: remaining.length === 0, remaining }
}
