import {
  BAXTER_CRRT_LEARN_LESSON_IDS,
  baxterCrrtLearnLessonById,
  baxterCrrtLearnLessons,
} from '../content'

describe('Baxter CRRT Learn lessons', () => {
  it('registers seven substantive, ordered, draft-reviewed lessons', () => {
    expect(baxterCrrtLearnLessons.map(({ id }) => id)).toEqual(BAXTER_CRRT_LEARN_LESSON_IDS)
    expect(baxterCrrtLearnLessons.map(({ ordinal }) => ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7])

    for (const lesson of baxterCrrtLearnLessons) {
      expect(lesson.reviewStatus).toBe('pending')
      expect(lesson.summary.length).toBeGreaterThan(40)
      expect(lesson.paragraphs?.length).toBeGreaterThanOrEqual(2)
      expect(lesson.bullets?.length).toBeGreaterThanOrEqual(3)
      expect(lesson.sourceRecordIds.length).toBeGreaterThan(0)
      expect(baxterCrrtLearnLessonById.get(lesson.id)).toBe(lesson)
      expect(Object.isFrozen(lesson)).toBe(true)
    }
  })

  it('embeds only the prescription and pressure-localization labs in their matching lessons', () => {
    expect(
      baxterCrrtLearnLessons
        .filter(({ embeddedLabId }) => embeddedLabId)
        .map(({ id, embeddedLabId }) => ({ id, embeddedLabId })),
    ).toEqual([
      { id: 'crrt-prescription-dosing', embeddedLabId: 'LAB-PRESCRIPTION' },
      { id: 'crrt-circuit-pressures', embeddedLabId: 'LAB-PRESSURE-LOCALIZATION' },
    ])
  })
})
