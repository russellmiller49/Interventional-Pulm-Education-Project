import {
  ventilationLearningUnits,
  ventilationUnitById,
  type VentilationObjective,
} from '../content/learningCurriculum'
import {
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  ventilationQuestionById,
  type VentilationQuestion,
} from '../content/learningQuestions'

export const VENTILATION_LEARNING_STORAGE_KEY = 'mechanical-ventilation-learning-flow-v1'
export const ventilationLearningSteps = [
  'prepare',
  'learn',
  'example',
  'check',
  'transfer',
  'recap',
] as const
export type VentilationLearningStep = (typeof ventilationLearningSteps)[number]
export type VentilationConfidence = 'sure' | 'unsure'
export interface VentilationAnswer {
  readonly choiceId: string
  readonly confidence: VentilationConfidence
  readonly reviewed: boolean
  readonly answeredAt: string
}
export interface VentilationUnitProgress {
  readonly step: VentilationLearningStep
  readonly answers: Readonly<Record<string, VentilationAnswer>>
  readonly seconds: number
  readonly completedAt?: string
}
export interface VentilationLearningProgress {
  readonly version: 1
  readonly units: Readonly<Record<string, VentilationUnitProgress>>
  readonly placement: Readonly<Record<string, VentilationAnswer>>
  readonly finalAnswers: Readonly<Record<string, VentilationAnswer>>
  readonly finalHistory: readonly {
    score: number
    total: number
    safe: boolean
    completedAt: string
  }[]
  readonly review: Readonly<Record<string, VentilationAnswer>>
}
export const emptyVentilationLearningProgress = (): VentilationLearningProgress => ({
  version: 1,
  units: {},
  placement: {},
  finalAnswers: {},
  finalHistory: [],
  review: {},
})
export const emptyVentilationUnitProgress = (): VentilationUnitProgress => ({
  step: 'prepare',
  answers: {},
  seconds: 0,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function date(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
function parseAnswers(
  raw: unknown,
  allowed?: readonly VentilationQuestion[],
): Record<string, VentilationAnswer> {
  if (!isRecord(raw)) return {}
  const result: Record<string, VentilationAnswer> = {}
  for (const [id, value] of Object.entries(raw)) {
    const question = ventilationQuestionById.get(id)
    if (!question || (allowed && !allowed.some((item) => item.id === id)) || !isRecord(value))
      continue
    if (!question.choices.some((choice) => choice.id === value.choiceId)) continue
    if (value.confidence !== 'sure' && value.confidence !== 'unsure') continue
    if (!date(value.answeredAt) || typeof value.reviewed !== 'boolean') continue
    result[id] = {
      choiceId: value.choiceId as string,
      confidence: value.confidence,
      reviewed: value.reviewed,
      answeredAt: value.answeredAt,
    }
  }
  return result
}

export function requiredUnitQuestionIds(unitId: string): readonly string[] {
  const unit = ventilationUnitById.get(unitId)
  return [
    ...(unit?.recallUnit ? [`${unit.recallUnit}:transfer`] : []),
    `${unitId}:check`,
    `${unitId}:transfer`,
  ]
}
export function unitReadyToComplete(unitId: string, progress: VentilationUnitProgress): boolean {
  return requiredUnitQuestionIds(unitId).every((id) => progress.answers[id]?.reviewed)
}

/** Parse only recognized items; derive correctness and completion rather than trusting stored flags. */
export function parseVentilationLearningProgress(raw: string | null): VentilationLearningProgress {
  const empty = emptyVentilationLearningProgress()
  if (!raw) return empty
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1) return empty
    const units: Record<string, VentilationUnitProgress> = {}
    if (isRecord(value.units))
      for (const [id, entry] of Object.entries(value.units)) {
        if (!ventilationUnitById.has(id) || !isRecord(entry)) continue
        const allowed = requiredUnitQuestionIds(id).flatMap(
          (qid) => ventilationQuestionById.get(qid) ?? [],
        )
        const answers = parseAnswers(entry.answers, allowed)
        let step: VentilationLearningStep = ventilationLearningSteps.includes(
          entry.step as VentilationLearningStep,
        )
          ? (entry.step as VentilationLearningStep)
          : 'prepare'
        const unit = ventilationUnitById.get(id)!
        if (
          step !== 'prepare' &&
          unit.recallUnit &&
          !answers[`${unit.recallUnit}:transfer`]?.reviewed
        )
          step = 'prepare'
        if ((step === 'transfer' || step === 'recap') && !answers[`${id}:check`]?.reviewed)
          step = 'check'
        if (step === 'recap' && !answers[`${id}:transfer`]?.reviewed) step = 'transfer'
        const parsed = {
          step,
          answers,
          seconds:
            typeof entry.seconds === 'number' && Number.isFinite(entry.seconds)
              ? Math.max(0, Math.min(entry.seconds, 86400))
              : 0,
        }
        units[id] = {
          ...parsed,
          ...(date(entry.completedAt) && unitReadyToComplete(id, parsed)
            ? { completedAt: entry.completedAt }
            : {}),
        }
      }
    const finalHistory = Array.isArray(value.finalHistory)
      ? (value.finalHistory
          .filter(
            (entry) =>
              isRecord(entry) &&
              Number.isInteger(entry.score) &&
              (entry.score as number) >= 0 &&
              (entry.score as number) <= ventilationFinalQuestions.length &&
              entry.total === ventilationFinalQuestions.length &&
              typeof entry.safe === 'boolean' &&
              date(entry.completedAt),
          )
          .slice(-20) as VentilationLearningProgress['finalHistory'])
      : []
    return {
      version: 1,
      units,
      placement: parseAnswers(value.placement, ventilationPlacementQuestions),
      finalAnswers: parseAnswers(value.finalAnswers, ventilationFinalQuestions),
      finalHistory,
      review: parseAnswers(value.review),
    }
  } catch {
    return empty
  }
}

export function nextVentilationUnit(progress: VentilationLearningProgress) {
  return ventilationLearningUnits.find((unit) => !progress.units[unit.id]?.completedAt) ?? null
}
export function missingVentilationUnits(progress: VentilationLearningProgress) {
  return ventilationLearningUnits.filter((unit) => !progress.units[unit.id]?.completedAt)
}
export function hasFocusedGuidance(
  progress: VentilationLearningProgress,
  objective: VentilationObjective,
): boolean {
  if (!ventilationPlacementQuestions.every((item) => progress.placement[item.id])) return false
  const questions = ventilationPlacementQuestions.filter((item) => item.objective === objective)
  return (
    questions.length > 0 &&
    questions.every(
      (item) =>
        progress.placement[item.id]?.choiceId === item.correctId &&
        progress.placement[item.id]?.confidence === 'sure',
    )
  )
}
export function scoreVentilationQuestions(
  questions: readonly VentilationQuestion[],
  answers: Readonly<Record<string, VentilationAnswer>>,
) {
  const correct = questions.filter((item) => answers[item.id]?.choiceId === item.correctId).length
  const answered = questions.filter((item) => answers[item.id]).length
  const safe = questions.every(
    (item) => !item.choices.find((choice) => choice.id === answers[item.id]?.choiceId)?.unsafe,
  )
  return {
    correct,
    answered,
    total: questions.length,
    safe,
    passed: answered === questions.length && correct / questions.length >= 0.8 && safe,
  }
}

/** Immutable first commitment: later review cannot rewrite first-attempt evidence. */
export function commitVentilationAnswer(
  answers: Readonly<Record<string, VentilationAnswer>>,
  question: VentilationQuestion,
  answer: VentilationAnswer,
) {
  if (answers[question.id] || !question.choices.some((choice) => choice.id === answer.choiceId))
    return answers
  return { ...answers, [question.id]: answer }
}

export function ventilationReviewQueue(
  progress: VentilationLearningProgress,
  now = Date.now(),
): readonly VentilationQuestion[] {
  const observations = new Map<string, VentilationAnswer>()
  for (const unit of Object.values(progress.units))
    for (const [id, answer] of Object.entries(unit.answers)) {
      const previous = observations.get(id)
      if (!previous || Date.parse(answer.answeredAt) > Date.parse(previous.answeredAt))
        observations.set(id, answer)
    }
  const day = 86400000
  return [...observations]
    .filter(([id, initial]) => {
      const item = ventilationQuestionById.get(id)!
      const reviewed = progress.review[id]
      const latest = reviewed ?? initial
      const needsRepair = latest.choiceId !== item.correctId || latest.confidence === 'unsure'
      const elapsed = now - Date.parse(latest.answeredAt)
      // Incorrect review can be repeated next day; initial misses are available immediately.
      if (needsRepair) return !reviewed || elapsed >= day
      return elapsed >= (reviewed ? 30 : 7) * day
    })
    .map(([id]) => ventilationQuestionById.get(id)!)
}
