import {
  buildPccmAssessmentOrder,
  sanitizePccmAssessmentAttempt,
} from '@/features/pccm-intro-course/assessment'
import { pccmBronchoscopyQuestions } from '@/features/pccm-intro-course/content/assessmentItems'
import type {
  PccmAssessmentAttemptRow,
  PccmAssessmentKind,
} from '@/features/pccm-intro-course/types'

function createAttempt(
  attemptKind: PccmAssessmentKind,
  overrides: Partial<PccmAssessmentAttemptRow> = {},
): PccmAssessmentAttemptRow {
  const order = buildPccmAssessmentOrder(attemptKind, 'learner-1')

  return {
    answers: {},
    attempt_kind: attemptKind,
    choice_order: order.choice_order,
    created_at: '2026-07-05T00:00:00.000Z',
    enrollment_id: 'enrollment-1',
    id: `${attemptKind}-attempt`,
    question_order: order.question_order,
    score: null,
    submitted_at: null,
    total: order.question_order.length,
    updated_at: '2026-07-05T00:00:00.000Z',
    user_id: 'learner-1',
    ...overrides,
  }
}

describe('PCCM intro course assessments', () => {
  it('uses the same canonical questions but stores different pretest and posttest order', () => {
    const preOrder = buildPccmAssessmentOrder('bronchoscopy_pre', 'learner-1')
    const postOrder = buildPccmAssessmentOrder('bronchoscopy_post', 'learner-1')

    expect(new Set(preOrder.question_order)).toEqual(new Set(postOrder.question_order))
    expect(preOrder.question_order).not.toEqual(postOrder.question_order)
  })

  it('does not expose correctness or explanations for pretests', () => {
    const question = pccmBronchoscopyQuestions[0]
    const attempt = createAttempt('bronchoscopy_pre', {
      answers: {
        [question.id]: question.correctId,
      },
    })
    const sanitized = sanitizePccmAssessmentAttempt(attempt)
    const raw = JSON.stringify(sanitized)

    expect(sanitized.phase).toBe('pre')
    expect(raw).not.toContain('correctOptionId')
    expect(raw).not.toContain(question.explanation)
  })

  it('reveals correctness and explanation for answered posttest questions', () => {
    const question = pccmBronchoscopyQuestions[0]
    const attempt = createAttempt('bronchoscopy_post', {
      answers: {
        [question.id]: question.correctId,
      },
    })
    const sanitized = sanitizePccmAssessmentAttempt(attempt)
    const sanitizedQuestion = sanitized.questions.find((item) => item.id === question.id)

    expect(sanitized.phase).toBe('post')
    expect(sanitizedQuestion?.reveal).toEqual({
      correctOptionId: question.correctId,
      explanation: question.explanation,
      isCorrect: true,
    })
  })
})
