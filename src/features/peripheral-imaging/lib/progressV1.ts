import type { Lesson, Phase, Progress, Question } from '../types'
import { LESSONS } from '../data/lessons'
import { QUESTION_BY_ID } from '../data/questions'

export const STORAGE_KEY = 'ip-peripheral-imaging-v1'
export const emptyProgress = (): Progress => ({
  version: 1,
  lessonId: LESSONS[0].id,
  phase: 'learn',
  answers: {},
  feedbackQuestion: {},
  reviewed: [],
  labValues: {},
})
export const answerKey = (lessonId: string, questionId: string) => lessonId + ':' + questionId
export function commitAnswer(
  progress: Progress,
  lessonId: string,
  question: Question,
  choice: string,
): Progress {
  const lesson = LESSONS.find((item) => item.id === lessonId)
  const key = answerKey(lessonId, question.id)
  if (
    !lesson?.checkIds.includes(question.id) ||
    progress.answers[key] ||
    !question.choices.some((option) => option.id === choice)
  )
    return progress
  return {
    ...progress,
    feedbackQuestion: { ...progress.feedbackQuestion, [lessonId]: question.id },
    answers: { ...progress.answers, [key]: { choice, correct: choice === question.correct } },
  }
}
export function lessonStatus(progress: Progress, lesson: Lesson) {
  const attempts = lesson.checkIds.map((id) => progress.answers[answerKey(lesson.id, id)])
  const answered = attempts.filter(Boolean).length
  const correct = attempts.filter((answer) => answer?.correct).length
  const allAnswered = answered === lesson.checkIds.length
  return {
    answered,
    correct,
    allAnswered,
    complete: allAnswered && progress.reviewed.includes(lesson.id),
    needsReview: allAnswered && correct < lesson.checkIds.length,
  }
}
export function nextIncomplete(progress: Progress) {
  return LESSONS.find((lesson) => !lessonStatus(progress, lesson).complete)
}
export function casePassed(progress: Progress) {
  const lesson = LESSONS[LESSONS.length - 1]
  const status = lessonStatus(progress, lesson)
  return (
    status.allAnswered &&
    status.correct >= 7 &&
    lesson.checkIds.every(
      (id) => !QUESTION_BY_ID[id].critical || progress.answers[answerKey(lesson.id, id)]?.correct,
    )
  )
}
/** Parse a convenience local record; discard unknown ids, malformed values and stale scores. */
export function parseProgress(raw: string | null): Progress {
  const clean = emptyProgress()
  try {
    const value: unknown = raw ? JSON.parse(raw) : null
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
      return clean
    const data = value as Record<string, unknown>
    if (LESSONS.some((lesson) => lesson.id === data.lessonId))
      clean.lessonId = data.lessonId as string
    if (['learn', 'lab', 'check', 'debrief'].includes(data.phase as string))
      clean.phase = data.phase as Phase
    if (data.answers && typeof data.answers === 'object') {
      for (const lesson of LESSONS)
        for (const id of lesson.checkIds) {
          const key = answerKey(lesson.id, id)
          const saved = (data.answers as Record<string, unknown>)[key]
          if (!saved || typeof saved !== 'object' || !('choice' in saved)) continue
          const question = QUESTION_BY_ID[id]
          if (question.choices.some((choice) => choice.id === saved.choice))
            clean.answers[key] = {
              choice: String(saved.choice),
              correct: saved.choice === question.correct,
            }
        }
    }
    if (data.feedbackQuestion && typeof data.feedbackQuestion === 'object') {
      for (const [lessonId, questionId] of Object.entries(data.feedbackQuestion)) {
        if (typeof questionId === 'string' && clean.answers[answerKey(lessonId, questionId)])
          clean.feedbackQuestion[lessonId] = questionId
      }
    }
    if (Array.isArray(data.reviewed))
      clean.reviewed = data.reviewed.filter(
        (id): id is string =>
          typeof id === 'string' &&
          LESSONS.some((lesson) => lesson.id === id && lessonStatus(clean, lesson).allAnswered),
      )
    if (data.labValues && typeof data.labValues === 'object') {
      for (const [id, values] of Object.entries(data.labValues)) {
        if (!LESSONS.some((lesson) => lesson.id === id) || !values || typeof values !== 'object')
          continue
        clean.labValues[id] = {}
        for (const [key, entry] of Object.entries(values)) {
          if (
            key !== '__proto__' &&
            (typeof entry === 'boolean' ||
              (typeof entry === 'number' && Number.isFinite(entry)) ||
              (typeof entry === 'string' && entry.length < 100))
          )
            clean.labValues[id][key] = entry
        }
      }
    }
    const current = LESSONS.find((lesson) => lesson.id === clean.lessonId)!
    if (clean.phase === 'lab' && !current.lab) clean.phase = 'learn'
    if (clean.phase === 'debrief' && !lessonStatus(clean, current).allAnswered)
      clean.phase = 'check'
    return clean
  } catch {
    return clean
  }
}
