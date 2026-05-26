import { pretestItems } from '../content/pretestItems'
import { scorePretest } from '../engine/pretest'

describe('intro pleural course pretest engine', () => {
  it('scores sections and orders the prescription by weakest section', () => {
    const answers = Object.fromEntries(pretestItems.map((item) => [item.id, item.correctId]))
    const firstFluid = pretestItems.find((item) => item.section === 'fluid')

    if (!firstFluid) {
      throw new Error('missing fluid item')
    }

    answers[firstFluid.id] = 'wrong'

    const result = scorePretest(answers, pretestItems)

    expect(result.totalCorrect).toBe(pretestItems.length - 1)
    expect(result.sectionScores.find((score) => score.section === 'fluid')?.percent).toBeLessThan(
      100,
    )
    expect(result.prescription[0]?.section).toBe('fluid')
  })
})
