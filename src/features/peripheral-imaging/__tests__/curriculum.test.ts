import { LESSONS, OBJECTIVES } from '../data/lessons'
import { QUESTIONS, QUESTION_BY_ID } from '../data/questions'
import { SOURCES } from '../data/sources'
import { DECISION_GUIDE, MODALITIES } from '../data/resources'

/**
 * The content contract the draft shipped with, kept as the stage rebuild reframes the course:
 * one canonical order with closed prerequisites, resolving ids, published sources, no video or
 * transcript references, and answer positions at chance. Scoring moved to the module record
 * (`learn-progress.test.ts`) and the capstone standard (`case-standard.test.ts`).
 */
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
