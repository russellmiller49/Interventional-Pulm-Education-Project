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
