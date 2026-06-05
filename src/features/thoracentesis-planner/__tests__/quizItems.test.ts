import { thoracentesisQuizQuestions } from '../content/quizItems'

describe('thoracentesis assessment items', () => {
  it('has a meaningful number of questions', () => {
    expect(thoracentesisQuizQuestions.length).toBeGreaterThanOrEqual(6)
  })

  it('every question has a valid answer index and distinct options', () => {
    for (const question of thoracentesisQuizQuestions) {
      expect(question.prompt.length).toBeGreaterThan(0)
      expect(question.options.length).toBeGreaterThanOrEqual(2)
      expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      expect(question.answerIndex).toBeLessThan(question.options.length)
      expect(question.explanation.length).toBeGreaterThan(0)

      const unique = new Set(question.options)
      expect(unique.size).toBe(question.options.length)
    }
  })
})
