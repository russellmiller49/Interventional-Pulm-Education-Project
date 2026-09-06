import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { criticalCareActivities } from '@/features/critical-care/content/activities'
import {
  ventilationLearningUnits,
  ventilationPracticeOrder,
  ventilationStages,
  ventilationUnitById,
} from '../content/learningCurriculum'
import { mechanicalVentilationLessonIds } from '../content/lessons'
import { mechanicalVentilationCases } from '../content/runtimeCases'
import { ventilationEvidenceById } from '../content/evidence'
import {
  unitQuestion,
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  ventilationUnitQuestions,
} from '../content/learningQuestions'
import {
  commitVentilationAnswer,
  emptyVentilationLearningProgress,
  emptyVentilationUnitProgress,
  hasFocusedGuidance,
  missingVentilationUnits,
  nextVentilationUnit,
  parseVentilationLearningProgress,
  requiredUnitQuestionIds,
  scoreVentilationQuestions,
  unitReadyToComplete,
  ventilationReviewQueue,
  type VentilationAnswer,
} from '../engine/learningProgress'

const now = '2026-09-05T01:00:00.000Z'
const answer = (choiceId: string, reviewed = true): VentilationAnswer => ({
  choiceId,
  confidence: 'sure',
  reviewed,
  answeredAt: now,
})

describe('ventilation curriculum alignment', () => {
  it('has one order across the course, shared pathway, and activity catalog', () => {
    const ids = ventilationLearningUnits.map((unit) => unit.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(
      criticalCareLearningPathway('mechanical-ventilation').sections.map((section) => section.id),
    ).toEqual(ids)
    expect(
      criticalCareActivities
        .filter((activity) => activity.id.startsWith('ventilation:learn:'))
        .map((activity) => activity.id.split(':').at(-1)),
    ).toEqual(ids)
    expect(nextVentilationUnit(emptyVentilationLearningProgress())?.id).toBe(ids[0])
    for (const id of mechanicalVentilationLessonIds) expect(ids).toContain(id)
  })

  it('teaches every prerequisite earlier, advances stages monotonically, and schedules earlier retrieval', () => {
    let previousStage = -1
    ventilationLearningUnits.forEach((unit, index) => {
      const stage = ventilationStages.findIndex((entry) => entry.id === unit.stage)
      expect(stage).toBeGreaterThanOrEqual(previousStage)
      previousStage = stage
      for (const id of unit.prerequisites)
        expect(ventilationLearningUnits.findIndex((entry) => entry.id === id)).toBeLessThan(index)
      if (index > 0) {
        expect(unit.recallUnit).toBeDefined()
        expect(ventilationLearningUnits.slice(0, index).map((entry) => entry.id)).toContain(
          unit.recallUnit,
        )
      }
      for (const source of unit.evidenceIds) expect(ventilationEvidenceById.has(source)).toBe(true)
      expect(unitQuestion(unit.id, 'check').objective).toBe(unit.objective)
      expect(unitQuestion(unit.id, 'transfer').prompt).not.toBe(
        unitQuestion(unit.id, 'check').prompt,
      )
    })
  })

  it('retains all cases and provides mechanism matches from the learning layer', () => {
    const ids = mechanicalVentilationCases.map((entry) => entry.id)
    expect([...ventilationPracticeOrder].sort()).toEqual([...ids].sort())
    for (const id of ids)
      expect(ventilationLearningUnits.some((unit) => unit.caseIds.includes(id))).toBe(true)
    for (const unit of ventilationLearningUnits)
      for (const id of unit.caseIds) expect(ids).toContain(id)
  })

  it('keeps final questions distinct and balances keys across the complete set', () => {
    const questions = [
      ...ventilationUnitQuestions,
      ...ventilationPlacementQuestions,
      ...ventilationFinalQuestions,
    ]
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(questions.length)
    const first = questions.filter((q) => q.correctId === '0').length / questions.length
    expect(first).toBeLessThan(0.4)
    for (const question of questions) {
      expect(question.choices).toHaveLength(3)
      expect(question.choices.every((choice) => choice.rationale.length > 25)).toBe(true)
    }
  })
})

describe('learning evidence and restoration', () => {
  it('preserves the exact phase, first answer, and review state on reload', () => {
    const unit = ventilationLearningUnits[0]
    const q = unitQuestion(unit.id, 'check')
    const state = {
      ...emptyVentilationLearningProgress(),
      units: {
        [unit.id]: {
          ...emptyVentilationUnitProgress(),
          step: 'check',
          answers: { [q.id]: answer('0', false) },
          seconds: 37,
        },
      },
    }
    const restored = parseVentilationLearningProgress(JSON.stringify(state))
    expect(restored.units[unit.id]).toEqual(state.units[unit.id])
    expect(restored.units[unit.id].completedAt).toBeUndefined()
  })

  it('does not accept a completion flag without every reviewed commitment', () => {
    const id = ventilationLearningUnits[0].id
    const state = {
      ...emptyVentilationLearningProgress(),
      units: { [id]: { ...emptyVentilationUnitProgress(), step: 'recap', completedAt: now } },
    }
    const restored = parseVentilationLearningProgress(JSON.stringify(state))
    expect(restored.units[id].completedAt).toBeUndefined()
    expect(restored.units[id].step).toBe('check')
    expect(nextVentilationUnit(restored)?.id).toBe(id)
  })

  it('requires earlier retrieval and distinguishes completion from correctness', () => {
    const id = ventilationLearningUnits[1].id
    const answers = Object.fromEntries(requiredUnitQuestionIds(id).map((qid) => [qid, answer('0')]))
    const record = { ...emptyVentilationUnitProgress(), answers, completedAt: now }
    expect(unitReadyToComplete(id, record)).toBe(true)
    const state = { ...emptyVentilationLearningProgress(), units: { [id]: record } }
    expect(parseVentilationLearningProgress(JSON.stringify(state)).units[id].completedAt).toBe(now)
    const missingRecall = {
      ...record,
      answers: { [`${id}:check`]: answer('0'), [`${id}:transfer`]: answer('0') },
    }
    expect(unitReadyToComplete(id, missingRecall)).toBe(false)
  })

  it('rejects stale versions, corrupt records, and invented answers without touching legacy keys', () => {
    for (const raw of [
      '{',
      JSON.stringify({ version: 7 }),
      JSON.stringify({ version: 1, units: null }),
    ])
      expect(parseVentilationLearningProgress(raw)).toEqual(emptyVentilationLearningProgress())
    const id = ventilationLearningUnits[0].id
    const restored = parseVentilationLearningProgress(
      JSON.stringify({
        version: 1,
        units: {
          [id]: { step: 'check', seconds: -5, answers: { [`${id}:check`]: answer('unknown') } },
        },
      }),
    )
    expect(restored.units[id].answers).toEqual({})
    expect(restored.units[id].seconds).toBe(0)
  })

  it('never replaces a first committed answer with later remediation', () => {
    const q = ventilationUnitQuestions[0]
    const first = commitVentilationAnswer({}, q, answer('0'))
    expect(commitVentilationAnswer(first, q, answer(q.correctId))).toBe(first)
  })

  it('uses placement to fade guidance without granting completion', () => {
    const placement = Object.fromEntries(
      ventilationPlacementQuestions.map((q) => [q.id, answer(q.correctId)]),
    )
    const progress = { ...emptyVentilationLearningProgress(), placement }
    expect(hasFocusedGuidance(progress, 'breath')).toBe(true)
    expect(missingVentilationUnits(progress)).toHaveLength(ventilationLearningUnits.length)
    const lowConfidence = {
      ...placement,
      [ventilationPlacementQuestions[0].id]: {
        ...placement[ventilationPlacementQuestions[0].id],
        confidence: 'unsure' as const,
      },
    }
    expect(hasFocusedGuidance({ ...progress, placement: lowConfidence }, 'breath')).toBe(false)
  })

  it('prevents an unsafe answer from passing even with high accuracy', () => {
    const answers = Object.fromEntries(
      ventilationFinalQuestions.map((q) => [q.id, answer(q.correctId)]),
    )
    const unsafe = ventilationFinalQuestions.find((q) => q.choices.some((choice) => choice.unsafe))!
    answers[unsafe.id] = answer(unsafe.choices.find((choice) => choice.unsafe)!.id)
    const score = scoreVentilationQuestions(ventilationFinalQuestions, answers)
    expect(score.correct).toBe(ventilationFinalQuestions.length - 1)
    expect(score.passed).toBe(false)
    expect(score.safe).toBe(false)
    expect(scoreVentilationQuestions(ventilationFinalQuestions, {}).passed).toBe(false)
  })

  it('queues uncertainty immediately, schedules correct retrieval, and retains original evidence', () => {
    const unit = ventilationUnitById.get('breathing-with-support')!
    const q = unitQuestion(unit.id, 'check')
    const correct = answer(q.correctId)
    const state = {
      ...emptyVentilationLearningProgress(),
      units: { [unit.id]: { ...emptyVentilationUnitProgress(), answers: { [q.id]: correct } } },
    }
    expect(ventilationReviewQueue(state, Date.parse(now))).toHaveLength(0)
    expect(ventilationReviewQueue(state, Date.parse(now) + 8 * 86400000)).toEqual([q])
    const uncertain = {
      ...state,
      units: {
        [unit.id]: {
          ...state.units[unit.id],
          answers: { [q.id]: { ...correct, confidence: 'unsure' as const } },
        },
      },
    }
    expect(ventilationReviewQueue(uncertain, Date.parse(now))).toEqual([q])
  })
})
