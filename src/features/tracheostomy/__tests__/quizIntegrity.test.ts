import { tracheostomyQuizQuestions } from '../content/quizItems'
import { tracheostomyReferences } from '../content/references'

describe('tracheostomy quiz integrity', () => {
  const referenceIds = new Set(tracheostomyReferences.map((reference) => reference.id))

  it('contains exactly 10 commit-first questions', () => {
    expect(tracheostomyQuizQuestions).toHaveLength(10)
  })

  it('gives every question distinct options, one valid answer, and explanatory feedback', () => {
    for (const question of tracheostomyQuizQuestions) {
      expect(question.prompt.trim().length).toBeGreaterThan(0)
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(question.options).size).toBe(question.options.length)
      expect(question.options.every((option) => option.trim().length > 0)).toBe(true)
      expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      expect(question.answerIndex).toBeLessThan(question.options.length)
      expect(question.explanation.trim().length).toBeGreaterThan(20)
    }
  })

  it('does not place every correct answer at the same option index', () => {
    const answerIndices = new Set(tracheostomyQuizQuestions.map((question) => question.answerIndex))
    expect(answerIndices.size).toBeGreaterThanOrEqual(3)
  })

  it('resolves every question citation to the reference registry', () => {
    for (const question of tracheostomyQuizQuestions) {
      expect(question.referenceIds.length).toBeGreaterThan(0)
      for (const referenceId of question.referenceIds) {
        expect(referenceIds).toContain(referenceId)
      }
    }
  })
})
