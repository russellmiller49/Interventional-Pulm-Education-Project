import { BRONCH_SECTION_IDS } from '../content/pathway'
import { bronchStageLesson } from '../content/stageLessons'
import { BRONCH_STORAGE_KEY, createEmptyBronchRecord } from '../engine/learnProgress'
import { createScopeState } from '../engine/scope/scopeReducer'
import {
  BRONCH_SELF_PACED_STORAGE_KEY,
  availableSurveySnapshot,
  createEmptyBronchSelfPacedRecord,
  parseBronchSelfPacedRecord,
  readBronchSelfPacedRecord,
  withReviewLater,
  withSectionOpened,
  withSectionReviewed,
  withSurveySnapshot,
  writeBronchSelfPacedRecord,
} from '../engine/selfPacedProgress'
import { teachingCase } from '../test-support/teachingCase'

const NOW = '2026-09-14T12:00:00.000Z'

beforeEach(() => localStorage.clear())

function surveyLedger() {
  const task = bronchStageLesson('systematic-survey').steps.find(
    (step) => step.interaction.kind === 'scope-task',
  )?.interaction
  if (task?.kind !== 'scope-task') throw new Error('Survey missing')
  return createScopeState(task.view, teachingCase()).ledger
}

describe('the self-paced record (BF-01)', () => {
  it('holds a location, section marks and a finished survey — no answers, attempts or grades', () => {
    const empty = createEmptyBronchSelfPacedRecord()
    expect(Object.keys(empty).sort()).toEqual([
      'lastSectionId',
      'reviewLaterSectionIds',
      'reviewedSectionIds',
      'surveySnapshot',
      'updatedAt',
      'version',
      'visitedSectionIds',
    ])
    expect(parseBronchSelfPacedRecord(JSON.stringify(empty))).toEqual(empty)
    expect(parseBronchSelfPacedRecord(JSON.stringify({ ...empty, firstAttempts: {} }))).toBeNull()
    expect(parseBronchSelfPacedRecord(JSON.stringify({ ...empty, score: 1 }))).toBeNull()
    expect(parseBronchSelfPacedRecord(JSON.stringify({ ...empty, version: 2 }))).toBeNull()
    expect(parseBronchSelfPacedRecord('{')).toBeNull()
    expect(parseBronchSelfPacedRecord(null)).toBeNull()
  })

  it('drops unknown and repeated section ids when reading', () => {
    const [first] = BRONCH_SECTION_IDS
    const parsed = parseBronchSelfPacedRecord(
      JSON.stringify({
        ...createEmptyBronchSelfPacedRecord(),
        lastSectionId: 'not-a-section',
        visitedSectionIds: [first, first, 'not-a-section'],
        reviewedSectionIds: ['not-a-section'],
        reviewLaterSectionIds: [first],
      }),
    )
    expect(parsed).toMatchObject({
      lastSectionId: null,
      visitedSectionIds: [first],
      reviewedSectionIds: [],
      reviewLaterSectionIds: [first],
    })
  })

  it('opens, marks and unmarks sections without duplicates', () => {
    const [first, second] = BRONCH_SECTION_IDS
    let record = withSectionOpened(createEmptyBronchSelfPacedRecord(), first, NOW)
    expect(record).toMatchObject({ lastSectionId: first, visitedSectionIds: [first] })
    expect(withSectionOpened(record, first, NOW)).toBe(record)
    record = withSectionOpened(record, second, NOW)
    expect(record.visitedSectionIds).toEqual([first, second])
    record = withSectionReviewed(record, first, true, NOW)
    expect(withSectionReviewed(record, first, true, NOW)).toBe(record)
    expect(record.reviewedSectionIds).toEqual([first])
    expect(withSectionReviewed(record, first, false, NOW).reviewedSectionIds).toEqual([])
    record = withReviewLater(record, second, true, NOW)
    expect(record.reviewLaterSectionIds).toEqual([second])
    expect(withReviewLater(record, second, false, NOW).reviewLaterSectionIds).toEqual([])
    expect(withSectionOpened(record, 'not-a-section', NOW)).toBe(record)
  })

  it('round-trips through storage and leaves the earlier record’s bytes alone', () => {
    const earlier = JSON.stringify({
      ...createEmptyBronchRecord(),
      completedSectionIds: [BRONCH_SECTION_IDS[0]],
      updatedAt: NOW,
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    const record = withSectionReviewed(
      withSectionOpened(readBronchSelfPacedRecord(), BRONCH_SECTION_IDS[0], NOW),
      BRONCH_SECTION_IDS[0],
      true,
      NOW,
    )
    expect(writeBronchSelfPacedRecord(record)).toBe(true)
    expect(readBronchSelfPacedRecord()).toEqual(record)
    expect(localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })

  it('does not turn an earlier completion into a visit or a reviewed mark', () => {
    localStorage.setItem(
      BRONCH_STORAGE_KEY,
      JSON.stringify({
        ...createEmptyBronchRecord(),
        completedSectionIds: [...BRONCH_SECTION_IDS],
        lastSectionId: BRONCH_SECTION_IDS[3],
        updatedAt: NOW,
      }),
    )
    expect(readBronchSelfPacedRecord()).toEqual(createEmptyBronchSelfPacedRecord())
  })

  it('keeps the learner’s finished survey and leaves one saved under the earlier record unused and unchanged', () => {
    const ledger = surveyLedger()
    const own = withSurveySnapshot(createEmptyBronchSelfPacedRecord(), ledger, NOW)
    expect(own.surveySnapshot?.rows).toEqual(Object.values(ledger))
    expect(availableSurveySnapshot(own)).toBe(own.surveySnapshot)
    expect(availableSurveySnapshot(createEmptyBronchSelfPacedRecord())).toBeNull()

    const earlier = JSON.stringify({
      ...createEmptyBronchRecord(),
      inspectionSnapshot: { sectionId: 'systematic-survey', at: NOW, rows: Object.values(ledger) },
      updatedAt: NOW,
    })
    localStorage.setItem(BRONCH_STORAGE_KEY, earlier)
    // BF-03: a historical survey is not the learner's own and never stands in for it.
    expect(availableSurveySnapshot(createEmptyBronchSelfPacedRecord())).toBeNull()
    expect(availableSurveySnapshot(own)).toBe(own.surveySnapshot)
    expect(readBronchSelfPacedRecord().surveySnapshot).toBeNull()
    expect(localStorage.getItem(BRONCH_STORAGE_KEY)).toBe(earlier)
  })

  it('reports a refused store without throwing', () => {
    const refuse = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota')
    })
    expect(writeBronchSelfPacedRecord(createEmptyBronchSelfPacedRecord())).toBe(false)
    refuse.mockRestore()
  })
})
