import { CAPSTONE_CASES } from '../content/capstone'
import { capstoneAttemptKey, capstoneStageItems, type BronchStageItem } from '../content/stageItems'
import type { BronchRecord } from './learnProgress'

/**
 * The capstone standard, evaluated over first decisions.
 *
 * Met when every case is decided, at least seven of the eight decisions hold, every case marked
 * critical holds, and no committed choice is one the item bank marks unsafe. The last rule is the
 * safety exception the verdict card also carries: a count can be high enough and the standard still
 * not met, because one unsafe action on a shared airway is not offset by seven sound ones.
 *
 * The learner's words are "met" and "not yet met". Nothing here is a score.
 */
export const CAPSTONE_MIN_HELD = 7

export const CAPSTONE_TOTAL = CAPSTONE_CASES.length

export interface CaseStandard {
  readonly met: boolean
  readonly decided: number
  readonly held: number
  /** Ids of the critical cases whose first decision did not hold. */
  readonly criticalMissed: readonly string[]
  /** Ids of the cases whose committed choice the item bank marks unsafe. */
  readonly unsafeChosen: readonly string[]
  /** Ids of the cases with no decision on the record yet, in capstone order. */
  readonly notYet: readonly string[]
}

const STAGE_BY_CASE_ID: ReadonlyMap<string, BronchStageItem> = new Map(
  capstoneStageItems.map((entry) => [entry.item.id, entry] as const),
)

/** The stage item behind a capstone case, by the case id (which is also its item id). */
export function capstoneStageItem(caseId: string): BronchStageItem {
  const stage = STAGE_BY_CASE_ID.get(caseId)
  if (!stage) throw new Error(`No capstone item for case ${caseId}`)
  return stage
}

export function evaluateCaseStandard(record: BronchRecord): CaseStandard {
  let decided = 0
  let held = 0
  const criticalMissed: string[] = []
  const unsafeChosen: string[] = []
  const notYet: string[] = []
  for (const entry of CAPSTONE_CASES) {
    const attempt = record.firstAttempts[capstoneAttemptKey(entry.id)]
    if (!attempt) {
      notYet.push(entry.id)
      continue
    }
    decided += 1
    if (attempt.correct) held += 1
    else if (entry.critical) criticalMissed.push(entry.id)
    const choice = capstoneStageItem(entry.id).item.choices.find(
      (candidate) => candidate.id === attempt.choiceId,
    )
    if (choice?.plausibility === 'unsafe') unsafeChosen.push(entry.id)
  }
  return {
    met:
      decided === CAPSTONE_TOTAL &&
      held >= CAPSTONE_MIN_HELD &&
      criticalMissed.length === 0 &&
      unsafeChosen.length === 0,
    decided,
    held,
    criticalMissed,
    unsafeChosen,
    notYet,
  }
}
