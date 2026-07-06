import { rigidBronchoscopyQuizQuestions } from '../content/quizItems'

/**
 * Integrity guard for the Rigid Bronchoscopy assessment quiz: 8–12 items, each
 * with a valid answer index, distinct non-empty options, and an explanation.
 */
describe('rigid bronchoscopy quiz integrity', () => {
  it('has 8–12 questions', () => {
    expect(rigidBronchoscopyQuizQuestions.length).toBeGreaterThanOrEqual(8)
    expect(rigidBronchoscopyQuizQuestions.length).toBeLessThanOrEqual(12)
  })

  it('every item has a valid answer within distinct options and an explanation', () => {
    for (const question of rigidBronchoscopyQuizQuestions) {
      expect(question.prompt.trim().length).toBeGreaterThan(0)
      expect(question.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(question.options).size).toBe(question.options.length)
      expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      expect(question.answerIndex).toBeLessThan(question.options.length)
      expect(question.explanation.trim().length).toBeGreaterThan(0)
    }
  })
})
