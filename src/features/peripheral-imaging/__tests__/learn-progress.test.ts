/**
 * @jest-environment node
 */
import { QUESTION_BY_ID } from '../data/questions'
import {
  createEmptyImagingRecord,
  migrateImagingRecordFromV1,
  parseImagingRecord,
  parseLegacyImagingRecord,
  withFirstAttempt,
  withSectionCompleted,
  withSectionVisited,
} from '../engine/learnProgress'

const NOW = '2026-09-08T12:00:00.000Z'

describe('the module record', () => {
  it('refuses malformed storage and recomputes correctness from the item bank', () => {
    expect(parseImagingRecord('{')).toBeNull()
    expect(parseImagingRecord(JSON.stringify({ version: 1 }))).toBeNull()
    const parsed = parseImagingRecord(
      JSON.stringify({
        version: 2,
        completedSectionIds: ['projection', 'projection'],
        lastSectionId: 'projection',
        firstAttempts: {
          'projection:geometry-1': { choiceId: 'b', correct: true, at: NOW },
          'projection:unknown-9': { choiceId: 'a', correct: true, at: NOW },
          'capstone:case-1': { choiceId: 'zz', correct: true, at: NOW },
        },
        capstoneDebriefViewedAt: null,
        updatedAt: NOW,
      }),
    )
    expect(parsed?.completedSectionIds).toEqual(['projection'])
    expect(parsed?.firstAttempts['projection:geometry-1'].correct).toBe(false)
    expect(parsed?.firstAttempts['projection:unknown-9']).toBeUndefined()
    expect(parsed?.firstAttempts['capstone:case-1']).toBeUndefined()
  })

  it('writes a first attempt once and keeps the first decision', () => {
    const empty = createEmptyImagingRecord()
    const first = withFirstAttempt(empty, 'projection:geometry-1', 'b', NOW)
    expect(first.firstAttempts['projection:geometry-1']).toEqual({
      choiceId: 'b',
      correct: false,
      at: NOW,
    })
    const again = withFirstAttempt(
      first,
      'projection:geometry-1',
      QUESTION_BY_ID['geometry-1'].correct,
      NOW,
    )
    expect(again).toBe(first)
    expect(withFirstAttempt(empty, 'projection:nope', 'a', NOW)).toBe(empty)
  })

  it('records visits and completions without duplicates', () => {
    let record = withSectionVisited(createEmptyImagingRecord(), 'projection', NOW)
    expect(record.lastSectionId).toBe('projection')
    record = withSectionCompleted(record, 'projection', NOW)
    record = withSectionCompleted(record, 'projection', NOW)
    expect(record.completedSectionIds).toEqual(['projection'])
  })

  it('migrates the draft record: answers keep their keys, the cases move under the capstone, credit survives', () => {
    const v1 = parseLegacyImagingRecord(
      JSON.stringify({
        version: 1,
        lessonId: 'signal',
        phase: 'check',
        answers: {
          'imaging-questions:choose-1': { choice: 'b', correct: true },
          'projection:geometry-1': { choice: 'c', correct: true },
          'suite-cases:case-6': { choice: 'b', correct: true },
        },
        reviewed: ['imaging-questions', 'projection'],
        feedbackQuestion: {},
        labValues: {},
      }),
    )
    expect(v1).not.toBeNull()
    const migrated = migrateImagingRecordFromV1(v1!, NOW)
    expect(migrated.version).toBe(2)
    expect(migrated.lastSectionId).toBe('signal')
    expect(migrated.completedSectionIds).toEqual(['imaging-questions', 'projection'])
    expect(migrated.firstAttempts['imaging-questions:choose-1']).toMatchObject({
      choiceId: 'b',
      correct: true,
    })
    expect(migrated.firstAttempts['projection:geometry-1']).toMatchObject({
      choiceId: 'c',
      correct: false,
    })
    expect(migrated.firstAttempts['capstone:case-6']).toMatchObject({
      choiceId: 'b',
      correct: true,
    })
    expect(migrated.firstAttempts['suite-cases:case-6']).toBeUndefined()
  })
})
