import { clinicalLearningItemSchema } from '@/features/learning-module/activity'

import {
  BAXTER_CRRT_LEARN_LESSON_IDS,
  baxterCrrtLessonClinicalAnchors,
  baxterCrrtLearnLessonById,
  baxterCrrtLearnLessons,
  baxterCrrtSupplementalSourceReferences,
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

  it('pairs every lesson with a patient-based, rationale-complete application item', () => {
    expect(Object.keys(baxterCrrtLessonClinicalAnchors)).toEqual(BAXTER_CRRT_LEARN_LESSON_IDS)

    for (const lessonId of BAXTER_CRRT_LEARN_LESSON_IDS) {
      const anchor = baxterCrrtLessonClinicalAnchors[lessonId]
      const item = anchor.applicationItem

      expect(anchor.contextItems.length).toBeGreaterThanOrEqual(4)
      expect(item.contextRequirement).toBe('patient')
      expect(item.clinicalContextId).toBeDefined()
      expect(item.choices).toHaveLength(3)
      expect(item.choices.every((choice) => choice.rationale.length > 20)).toBe(true)
      expect(item.evidenceIds.length).toBeGreaterThan(0)
      expect(item.reviewStatus).toBe('sme-review')
      expect(clinicalLearningItemSchema.safeParse(item).success).toBe(true)
    }
  })

  it('registers the supplied CRRT references with human-readable provenance', () => {
    const sourceById = new Map(
      baxterCrrtSupplementalSourceReferences.map((source) => [source.id, source]),
    )

    expect(sourceById.get('TEXT-CRRT-NEYRA-2026')).toMatchObject({
      sourceTitle: 'Critical Care Nephrology',
      sourceType: 'textbook',
    })
    expect(sourceById.get('TEXT-RRT-HOSTE-2024')).toMatchObject({
      sourceTitle: 'Basic principles of renal replacement therapy',
      sourceType: 'textbook',
    })
    expect(sourceById.get('REVIEW-CRRT-PRINCIPLES-2021')).toMatchObject({
      sourceTitle: 'Continuous renal replacement therapy principles',
      sourceType: 'peer-reviewed',
    })
    expect(sourceById.get('STD-NEPHROLOGY-COMPETENCIES-2025')).toMatchObject({
      sourceTitle: 'Nephrology Competencies',
      sourceType: 'professional-standard',
    })
  })
})
