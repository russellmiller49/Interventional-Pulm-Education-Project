import { pleuralDiseaseProfiles } from '../content/diseaseProfiles'
import { pleuralAnalysisQuizItems } from '../content/quizItems'

/**
 * Integrity guard for the disease-matching Assessment quiz: the answer must be
 * one of the offered choices, and every choice must reference a real disease
 * profile (so the quiz UI never renders a bare id).
 */
describe('pleural fluid analysis quiz integrity', () => {
  const diseaseIds = new Set(pleuralDiseaseProfiles.map((disease) => disease.id))

  it('has questions', () => {
    expect(pleuralAnalysisQuizItems.length).toBeGreaterThanOrEqual(6)
  })

  it('every item has a valid answer within its choices and resolvable diseases', () => {
    for (const item of pleuralAnalysisQuizItems) {
      expect(item.choices).toContain(item.answerDiseaseId)
      expect(new Set(item.choices).size).toBe(item.choices.length)
      for (const choice of item.choices) {
        expect(diseaseIds.has(choice)).toBe(true)
      }
    }
  })
})
