/**
 * @jest-environment node
 */
import { CAPSTONE_CASES } from '../content/capstone'
import { BRONCH_SECTION_IDS } from '../content/pathway'
import { capstoneAttemptKey, capstoneStageItems } from '../content/stageItems'
import {
  CAPSTONE_MIN_HELD,
  CAPSTONE_TOTAL,
  capstoneStageItem,
  evaluateCaseStandard,
} from '../engine/caseStandard'
import {
  createEmptyBronchRecord,
  withFirstAttempt,
  type BronchRecord,
} from '../engine/learnProgress'

type Pick = 'best' | 'unsafe' | 'not-unsafe' | 'not-best'

/** A choice of the given kind on a case, by plausibility alone. */
function choiceOf(caseId: string, pick: Pick): string {
  const { item } = capstoneStageItem(caseId)
  const choice = item.choices.find((candidate) =>
    pick === 'best'
      ? candidate.plausibility === 'best'
      : pick === 'unsafe'
        ? candidate.plausibility === 'unsafe'
        : pick === 'not-best'
          ? candidate.plausibility !== 'best'
          : candidate.plausibility !== 'best' && candidate.plausibility !== 'unsafe',
  )
  if (!choice) throw new Error(`Case ${caseId} has no ${pick} choice`)
  return choice.id
}

function decideAll(overrides: Readonly<Record<string, Pick>> = {}): BronchRecord {
  let record = createEmptyBronchRecord()
  for (const entry of CAPSTONE_CASES) {
    record = withFirstAttempt(
      record,
      capstoneAttemptKey(entry.id),
      choiceOf(entry.id, overrides[entry.id] ?? 'best'),
    )
  }
  return record
}

const critical = CAPSTONE_CASES.filter((entry) => entry.critical).map((entry) => entry.id)
const optional = CAPSTONE_CASES.filter((entry) => !entry.critical).map((entry) => entry.id)

describe('the capstone set', () => {
  it('holds eight cases, each backed by one stage item and paired to a section', () => {
    expect(CAPSTONE_CASES).toHaveLength(8)
    expect(CAPSTONE_TOTAL).toBe(8)
    expect(CAPSTONE_MIN_HELD).toBe(7)
    expect(capstoneStageItems.map((entry) => entry.item.id)).toEqual(
      CAPSTONE_CASES.map((entry) => entry.id),
    )
    for (const entry of CAPSTONE_CASES) {
      expect(BRONCH_SECTION_IDS).toContain(entry.pairedSectionId)
      expect(capstoneStageItem(entry.id).item.correctChoiceIds).toHaveLength(1)
    }
    expect(critical.length).toBeGreaterThan(0)
    expect(optional.length).toBeGreaterThanOrEqual(2)
  })
})

describe('the capstone standard', () => {
  it('is not yet met with nothing decided, and names what is still to decide', () => {
    expect(evaluateCaseStandard(createEmptyBronchRecord())).toEqual({
      met: false,
      decided: 0,
      held: 0,
      criticalMissed: [],
      unsafeChosen: [],
      notYet: CAPSTONE_CASES.map((entry) => entry.id),
    })
  })

  it('is met when every decision holds', () => {
    expect(evaluateCaseStandard(decideAll())).toEqual({
      met: true,
      decided: 8,
      held: 8,
      criticalMissed: [],
      unsafeChosen: [],
      notYet: [],
    })
  })

  it('is met at seven of eight when the miss is neither critical nor unsafe', () => {
    const standard = evaluateCaseStandard(decideAll({ [optional[0]]: 'not-unsafe' }))
    expect(standard).toMatchObject({ met: true, decided: 8, held: 7 })
  })

  it('is not yet met at seven of eight when the miss is a critical case', () => {
    // A critical case may offer only unsafe distractors, so the miss is any choice but the keyed
    // one; the critical rule is what this checks, whether or not the unsafe rule also fires.
    for (const caseId of critical) {
      const standard = evaluateCaseStandard(decideAll({ [caseId]: 'not-best' }))
      expect(standard).toMatchObject({ met: false, held: 7, criticalMissed: [caseId] })
    }
  })

  it('is not yet met when any committed choice is unsafe, whatever the count', () => {
    const standard = evaluateCaseStandard(decideAll({ [optional[0]]: 'unsafe' }))
    expect(standard).toMatchObject({
      met: false,
      held: 7,
      criticalMissed: [],
      unsafeChosen: [optional[0]],
    })
  })

  it('is not yet met below seven held, and not yet met while any case is undecided', () => {
    const [a, b] = optional
    expect(evaluateCaseStandard(decideAll({ [a]: 'not-unsafe', [b]: 'not-unsafe' }))).toMatchObject(
      { met: false, held: 6 },
    )
    let record = createEmptyBronchRecord()
    for (const entry of CAPSTONE_CASES.slice(0, -1)) {
      record = withFirstAttempt(record, capstoneAttemptKey(entry.id), choiceOf(entry.id, 'best'))
    }
    expect(evaluateCaseStandard(record)).toMatchObject({
      met: false,
      decided: 7,
      held: 7,
      notYet: [CAPSTONE_CASES[CAPSTONE_CASES.length - 1].id],
    })
  })
})
