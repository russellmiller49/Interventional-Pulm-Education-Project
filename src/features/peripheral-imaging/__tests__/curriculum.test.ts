import { LESSONS, OBJECTIVES } from '../data/lessons'
import { QUESTIONS, QUESTION_BY_ID } from '../data/questions'
import { SOURCES } from '../data/sources'
import { DECISION_GUIDE, MODALITIES } from '../data/resources'
import {
  answerKey,
  casePassed,
  commitAnswer,
  emptyProgress,
  lessonStatus,
  nextIncomplete,
  parseProgress,
} from '../lib/progress'

describe('curriculum and provenance contract', () => {
  it('has one canonical path with closed prerequisites and valid source and check ids', () => {
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length)
    const taught = new Set<string>()
    for (const lesson of LESSONS) {
      expect(lesson.prerequisites.every((id) => taught.has(id))).toBe(true)
      expect(OBJECTIVES.some((objective) => objective.id === lesson.objective)).toBe(true)
      expect(lesson.checkIds.every((id) => Boolean(QUESTION_BY_ID[id]))).toBe(true)
      expect(
        lesson.blocks
          .flatMap((block) => block.sources)
          .every((id) => SOURCES.some((source) => source.id === id)),
      ).toBe(true)
      taught.add(lesson.id)
    }
    const grouped = [...new Set(LESSONS.map((lesson) => lesson.group))].flatMap((group) =>
      LESSONS.filter((lesson) => lesson.group === group).map((lesson) => lesson.id),
    )
    expect(grouped).toEqual(LESSONS.map((lesson) => lesson.id))
    expect([...DECISION_GUIDE, ...MODALITIES].every((row) => taught.has(row.lesson))).toBe(true)
  })
  it('uses published source URLs and supplies feedback for each choice', () => {
    expect(SOURCES.every((source) => /^https:\/\//.test(source.url))).toBe(true)
    expect(JSON.stringify({ LESSONS, SOURCES, QUESTIONS })).not.toMatch(
      /youtube|vimeo|webinar|transcript|\[V\d/i,
    )
    for (const question of QUESTIONS) {
      expect(question.choices.filter((choice) => choice.id === question.correct)).toHaveLength(1)
      expect(question.choices.every((choice) => choice.rationale.length > 40)).toBe(true)
      expect(question.sources.every((id) => SOURCES.some((source) => source.id === id))).toBe(true)
    }
  })
  it('keeps basic answer-position strategies at chance', () => {
    for (const position of ['a', 'b', 'c'])
      expect(
        QUESTIONS.filter((question) => question.correct === position).length,
      ).toBeLessThanOrEqual(Math.ceil(QUESTIONS.length / 3) + 1)
  })
})
describe('learning record and scoring', () => {
  it('starts at the first canonical lesson and does not complete by opening it', () => {
    const progress = emptyProgress()
    expect(nextIncomplete(progress)?.id).toBe(LESSONS[0].id)
    expect(lessonStatus(progress, LESSONS[0]).complete).toBe(false)
  })
  it('keeps a wrong first decision immutable and separately requires debrief review', () => {
    const lesson = LESSONS[0],
      question = QUESTION_BY_ID[lesson.checkIds[0]]
    const wrong = question.choices.find((choice) => choice.id !== question.correct)!.id
    const original = commitAnswer(emptyProgress(), lesson.id, question, wrong)
    const retry = commitAnswer(original, lesson.id, question, question.correct)
    expect(retry).toBe(original)
    expect(lessonStatus(original, lesson)).toMatchObject({
      correct: 0,
      complete: false,
      allAnswered: true,
    })
    expect(lessonStatus({ ...original, reviewed: [lesson.id] }, lesson)).toMatchObject({
      complete: true,
      needsReview: true,
    })
  })
  it('cannot complete later retrieval through the earlier lesson answer', () => {
    const first = LESSONS[0],
      next = LESSONS[1]
    const question = QUESTION_BY_ID[first.checkIds[0]]
    const progress = commitAnswer(emptyProgress(), first.id, question, question.correct)
    expect(lessonStatus(progress, next).answered).toBe(0)
  })
  it('does not accept a question outside the named lesson', () => {
    const original = emptyProgress()
    expect(commitAnswer(original, LESSONS[0].id, QUESTION_BY_ID['case-8'], 'c')).toBe(original)
  })
  it.each(['case-1', 'case-4', 'case-6', 'case-7'])(
    'blocks passing after critical error %s even at 7/8',
    (failedId) => {
      const lesson = LESSONS[LESSONS.length - 1]
      let progress = emptyProgress()
      for (const id of lesson.checkIds) {
        const question = QUESTION_BY_ID[id]
        const choice =
          id === failedId
            ? question.choices.find((choice) => choice.id !== question.correct)!.id
            : question.correct
        progress = commitAnswer(progress, lesson.id, question, choice)
      }
      expect(lessonStatus(progress, lesson).correct).toBe(7)
      expect(casePassed(progress)).toBe(false)
    },
  )
  it('passes a completed case set meeting both the accuracy and critical-item requirements', () => {
    const lesson = LESSONS[LESSONS.length - 1]
    let progress = emptyProgress()
    for (const id of lesson.checkIds)
      progress = commitAnswer(progress, lesson.id, QUESTION_BY_ID[id], QUESTION_BY_ID[id].correct)
    expect(casePassed(progress)).toBe(true)
  })
  it('round-trips the pending feedback, lab values and inside-unit position', () => {
    const question = QUESTION_BY_ID['geometry-1']
    let progress = commitAnswer(emptyProgress(), 'projection', question, question.correct)
    progress = {
      ...progress,
      lessonId: 'projection',
      phase: 'check',
      labValues: { projection: { orbit: 30 } },
    }
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress)
    expect(progress.feedbackQuestion.projection).toBe('geometry-1')
  })
  it('recovers from invalid storage and derives accuracy instead of trusting a saved flag', () => {
    expect(parseProgress('{')).toEqual(emptyProgress())
    const key = answerKey('imaging-questions', 'choose-1')
    const parsed = parseProgress(
      JSON.stringify({
        version: 1,
        lessonId: 'unknown',
        phase: 'debrief',
        answers: { [key]: { choice: 'a', correct: true } },
        reviewed: ['unknown'],
        labValues: { projection: { orbit: 'nonsense' } },
      }),
    )
    expect(parsed.lessonId).toBe(LESSONS[0].id)
    expect(parsed.answers[key].correct).toBe(false)
    expect(parsed.reviewed).toEqual([])
  })
})
