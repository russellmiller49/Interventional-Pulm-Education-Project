import { pleuroscopyQuizQuestions } from '../content/quizItems'

/**
 * Integrity guard for the Pleuroscopy assessment quiz: 8–12 items, each with a
 * valid answer index, distinct non-empty options, and an explanation.
 */
describe('pleuroscopy quiz integrity', () => {
  it('has 8–12 questions', () => {
    expect(pleuroscopyQuizQuestions.length).toBeGreaterThanOrEqual(8)
    expect(pleuroscopyQuizQuestions.length).toBeLessThanOrEqual(12)
  })

  it('every item has a valid answer within distinct options and an explanation', () => {
    for (const question of pleuroscopyQuizQuestions) {
      expect(question.prompt.trim().length).toBeGreaterThan(0)
      expect(question.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(question.options).size).toBe(question.options.length)
      expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      expect(question.answerIndex).toBeLessThan(question.options.length)
      expect(question.explanation.trim().length).toBeGreaterThan(0)
    }
  })
})

/**
 * The drainage-volume item was removed with its Practice scenario; see
 * scenarioIntegrity.test.ts.
 */
describe('pleuroscopy quiz: removed drainage-volume teaching', () => {
  it('asks nothing about re-expansion or volume-limited drainage', () => {
    const text = pleuroscopyQuizQuestions
      .flatMap((question) => [question.prompt, ...question.options, question.explanation])
      .join('\n')

    expect(text).not.toMatch(/re-?expansion/i)
    expect(text).not.toMatch(/volume-limited/i)
  })
})
