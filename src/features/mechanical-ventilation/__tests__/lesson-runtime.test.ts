import {
  clinicalLearningItemSchema,
  flaggedLearnerCopyTerms,
} from '@/features/learning-module/activity'

import {
  hasVentilationLessonEvidence,
  mechanicalVentilationCaseById,
  mechanicalVentilationLessonItems,
  mechanicalVentilationLessons,
  ventilationEvidenceById,
  ventilationCaseTransferById,
  ventilationLessonActionEvidence,
  ventilationLessonRuntimes,
} from '../content'
import { createInitialSimulationState, ventilationSimulationReducer } from '../engine'

describe('mechanical-ventilation lesson recovery contracts', () => {
  it('assigns every authored case a distinct scored follow-up patient', () => {
    expect(ventilationCaseTransferById.size).toBe(mechanicalVentilationCaseById.size)
    for (const caseId of mechanicalVentilationCaseById.keys()) {
      const transferCaseId = ventilationCaseTransferById.get(caseId)
      expect(transferCaseId).toBeDefined()
      expect(transferCaseId).not.toBe(caseId)
      expect(mechanicalVentilationCaseById.has(transferCaseId!)).toBe(true)
    }
  })

  // The suite previously iterated the learning-item map instead of indexing it per lesson, so a
  // lesson added without items stayed green here and crashed the Learn route at render.
  it('provides prediction and transfer items for every authored lesson', () => {
    for (const lesson of mechanicalVentilationLessons) {
      const items =
        mechanicalVentilationLessonItems[lesson.id as keyof typeof mechanicalVentilationLessonItems]
      expect(items).toBeDefined()
      expect(items.prediction.activityId).toBe(`ventilation:learn:${lesson.id}`)
      expect(items.transfer.activityId).toBe(`ventilation:learn:${lesson.id}`)
    }
  })

  it('provides one engine-backed primary and transfer patient for every lesson', () => {
    expect(ventilationLessonRuntimes).toHaveLength(mechanicalVentilationLessons.length)
    expect(new Set(ventilationLessonRuntimes.map((runtime) => runtime.lessonId)).size).toBe(
      mechanicalVentilationLessons.length,
    )

    for (const runtime of ventilationLessonRuntimes) {
      expect(mechanicalVentilationCaseById.has(runtime.primary.caseId)).toBe(true)
      expect(mechanicalVentilationCaseById.has(runtime.transfer.caseId)).toBe(true)
      expect(runtime.primary.caseId).not.toBe(runtime.transfer.caseId)
      expect(runtime.primary.requiredEvidence.length).toBeGreaterThan(0)
      expect(runtime.transfer.requiredEvidence.length).toBeGreaterThan(0)
    }
  })

  it.each(
    ventilationLessonRuntimes.flatMap((runtime) =>
      (['primary', 'transfer'] as const).map(
        (variant) => [`${runtime.lessonId}:${variant}`, runtime, variant] as const,
      ),
    ),
  )(
    '%s can satisfy its requirements only through accepted simulation actions',
    (_name, runtime, variant) => {
      const definition = runtime[variant]
      let state = createInitialSimulationState(definition.caseId, 'learn', 1, 'hamilton-c6')
      const evidence: string[] = []

      for (const guidedAction of definition.actions) {
        const action = guidedAction.resolve(state)
        const next = ventilationSimulationReducer(state, action)
        const token = ventilationLessonActionEvidence(action, state, next)
        if (token) evidence.push(token)
        state = next
      }

      expect(hasVentilationLessonEvidence(evidence, definition.requiredEvidence)).toBe(true)
    },
  )

  it('keeps all prediction and transfer items source-bound, distinct, and review-gated', () => {
    const allItems = Object.values(mechanicalVentilationLessonItems).flatMap((items) => [
      items.prediction,
      items.transfer,
    ])
    expect(allItems).toHaveLength(mechanicalVentilationLessons.length * 2)
    expect(new Set(allItems.map((item) => item.id)).size).toBe(allItems.length)

    const transferVariantIds = allItems.flatMap((item) =>
      item.transferVariantId ? [item.transferVariantId] : [],
    )
    expect(transferVariantIds).toHaveLength(mechanicalVentilationLessons.length)
    expect(new Set(transferVariantIds).size).toBe(transferVariantIds.length)

    for (const learningItem of allItems) {
      expect(clinicalLearningItemSchema.safeParse(learningItem).success).toBe(true)
      expect(learningItem.reviewStatus).toBe('sme-review')
      expect(learningItem.choices).toHaveLength(3)
      expect(
        learningItem.evidenceIds.every((evidenceId) => ventilationEvidenceById.has(evidenceId)),
      ).toBe(true)

      const learnerCopy = [learningItem.stem, ...learningItem.choices.map((choice) => choice.label)]
        .join(' ')
        .toLowerCase()
      expect(flaggedLearnerCopyTerms(learnerCopy)).toEqual([])
      expect(learnerCopy).not.toMatch(
        /\b(i have reviewed|i would|mark (the )?(lesson )?complete|self[- ]attest)\b/i,
      )
    }
  })
})
