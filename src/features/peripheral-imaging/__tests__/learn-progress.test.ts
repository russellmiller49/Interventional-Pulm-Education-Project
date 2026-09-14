/**
 * @jest-environment node
 */
import {
  LEGACY_IMAGING_RECORD_KEY_V1,
  LEGACY_IMAGING_RECORD_KEY_V2,
  migrateImagingRecordFromV1,
  parseImagingRecord,
  parseLegacyImagingRecord,
} from '../engine/learnProgress'

const NOW = '2026-09-08T12:00:00.000Z'

/*
 * Contract change (PI-01). The course no longer writes these records — the tests for writing a
 * first attempt once, and for recording visits and completions into the v2 record, were retired
 * with the writers. What stays is that historical bytes remain interpretable exactly as before;
 * `self-paced-progress.test.tsx` holds that nothing current reads or writes them.
 */
describe('the legacy records, read-only', () => {
  it('keeps the historical storage keys', () => {
    expect(LEGACY_IMAGING_RECORD_KEY_V2).toBe('ip-peripheral-imaging-v2')
    expect(LEGACY_IMAGING_RECORD_KEY_V1).toBe('ip-peripheral-imaging-v1')
  })

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

  it('interprets a draft record the way the pre-conversion course did', () => {
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
