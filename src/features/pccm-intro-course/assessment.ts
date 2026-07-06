import { createHash } from 'node:crypto'

import {
  pccmBronchoscopyQuestions,
  pccmPleuralQuestions,
  type PccmAssessmentQuestion,
} from './content/assessmentItems'
import {
  getPccmAssessmentFamily,
  getPccmAssessmentPhase,
  type PccmAssessmentAttemptRow,
  type PccmAssessmentKind,
} from './types'

export interface PccmAssessmentOrder {
  choice_order: Record<string, string[]>
  question_order: string[]
}

export interface PccmPublicAssessmentOption {
  id: string
  text: string
}

export interface PccmPublicAssessmentQuestion {
  id: string
  imageUrl?: string
  options: PccmPublicAssessmentOption[]
  reveal?: {
    correctOptionId: string
    explanation: string
    isCorrect: boolean
  }
  selectedOptionId?: string
  stem: string
}

export interface PccmPublicAssessmentAttempt {
  answeredCount: number
  attemptKind: PccmAssessmentKind
  id: string
  phase: 'pre' | 'post'
  questions: PccmPublicAssessmentQuestion[]
  score: number | null
  submittedAt: string | null
  total: number
}

export function getPccmQuestionsForKind(
  kind: PccmAssessmentKind,
): readonly PccmAssessmentQuestion[] {
  return (
    getPccmAssessmentFamily(kind) === 'bronchoscopy'
      ? pccmBronchoscopyQuestions
      : pccmPleuralQuestions
  ) as readonly PccmAssessmentQuestion[]
}

export function getPccmQuestionMap(kind: PccmAssessmentKind) {
  return new Map<string, PccmAssessmentQuestion>(
    getPccmQuestionsForKind(kind).map((question) => [question.id, question]),
  )
}

export function buildPccmAssessmentOrder(
  kind: PccmAssessmentKind,
  userId: string,
): PccmAssessmentOrder {
  const questions = getPccmQuestionsForKind(kind)
  const seedPrefix = `${userId}:${kind}`
  const question_order = seededShuffle(
    questions.map((question) => question.id),
    `${seedPrefix}:questions`,
  )
  const choice_order = Object.fromEntries(
    questions.map((question) => [
      question.id,
      seededShuffle(
        question.options.map((option) => option.id),
        `${seedPrefix}:${question.id}:choices`,
      ),
    ]),
  )

  return {
    choice_order,
    question_order,
  }
}

export function scorePccmAssessmentAttempt(
  kind: PccmAssessmentKind,
  answers: Record<string, string>,
) {
  const questions = getPccmQuestionsForKind(kind)
  const score = questions.reduce(
    (total, question) => total + (answers[question.id] === question.correctId ? 1 : 0),
    0,
  )

  return {
    score,
    total: questions.length,
  }
}

export function sanitizePccmAssessmentAttempt(
  attempt: PccmAssessmentAttemptRow,
): PccmPublicAssessmentAttempt {
  const phase = getPccmAssessmentPhase(attempt.attempt_kind)
  const questionMap = getPccmQuestionMap(attempt.attempt_kind)
  const questions = attempt.question_order
    .map((questionId) => questionMap.get(questionId))
    .filter((question): question is PccmAssessmentQuestion => Boolean(question))
    .map((question) => sanitizePccmQuestion(question, attempt, phase))

  return {
    answeredCount: Object.keys(attempt.answers ?? {}).length,
    attemptKind: attempt.attempt_kind,
    id: attempt.id,
    phase,
    questions,
    score: attempt.score,
    submittedAt: attempt.submitted_at,
    total: questions.length,
  }
}

export function sanitizePccmQuestionReveal(
  kind: PccmAssessmentKind,
  questionId: string,
  selectedOptionId: string,
) {
  if (getPccmAssessmentPhase(kind) !== 'post') {
    return null
  }

  const question = getPccmQuestionMap(kind).get(questionId)
  if (!question) {
    return null
  }

  return {
    correctOptionId: question.correctId,
    explanation: question.explanation,
    isCorrect: selectedOptionId === question.correctId,
  }
}

export function normalizePccmAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([questionId, optionId]) => [questionId, optionId]),
  )
}

function sanitizePccmQuestion(
  question: PccmAssessmentQuestion,
  attempt: PccmAssessmentAttemptRow,
  phase: 'pre' | 'post',
): PccmPublicAssessmentQuestion {
  const choiceOrder =
    attempt.choice_order?.[question.id] ?? question.options.map((option) => option.id)
  const optionMap = new Map(question.options.map((option) => [option.id, option]))
  const selectedOptionId = attempt.answers?.[question.id]
  const reveal =
    phase === 'post' && selectedOptionId
      ? {
          correctOptionId: question.correctId,
          explanation: question.explanation,
          isCorrect: selectedOptionId === question.correctId,
        }
      : undefined

  return {
    id: question.id,
    imageUrl: question.imageUrl,
    options: choiceOrder
      .map((optionId) => optionMap.get(optionId))
      .filter((option): option is PccmAssessmentQuestion['options'][number] => Boolean(option))
      .map((option) => ({
        id: option.id,
        text: option.text,
      })),
    reveal,
    selectedOptionId,
    stem: question.stem,
  }
}

function seededShuffle<T>(items: readonly T[], seed: string) {
  const shuffled = [...items]
  const random = createSeededRandom(seed)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

function createSeededRandom(seed: string) {
  const hash = createHash('sha256').update(seed).digest()
  let state = hash.readUInt32BE(0) || 1

  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 1_000_000) / 1_000_000
  }
}
