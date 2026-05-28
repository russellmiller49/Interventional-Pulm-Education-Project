import { pretestItems } from '../content/pretestItems'
import { comparePretestPosttest, scorePretest } from '../engine/pretest'

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

  it('computes posttest section deltas after sections are fully answered', () => {
    const pretestAnswers = Object.fromEntries(pretestItems.map((item) => [item.id, item.correctId]))
    const posttestAnswers = Object.fromEntries(
      pretestItems.map((item) => [item.id, item.correctId]),
    )
    const firstInfection = pretestItems.find((item) => item.section === 'infection')

    if (!firstInfection) {
      throw new Error('missing infection item')
    }

    pretestAnswers[firstInfection.id] = 'wrong'

    const deltas = comparePretestPosttest(pretestAnswers, posttestAnswers, pretestItems)
    const infectionDelta = deltas.find((delta) => delta.section === 'infection')

    expect(infectionDelta?.posttestPercent).toBe(100)
    expect(infectionDelta?.delta).toBeGreaterThan(0)
  })

  it('withholds deltas for partially answered posttest sections', () => {
    const pretestAnswers = Object.fromEntries(pretestItems.map((item) => [item.id, item.correctId]))
    const oneFluid = pretestItems.find((item) => item.section === 'fluid')

    if (!oneFluid) {
      throw new Error('missing fluid item')
    }

    const deltas = comparePretestPosttest(
      pretestAnswers,
      { [oneFluid.id]: oneFluid.correctId },
      pretestItems,
    )
    const fluidDelta = deltas.find((delta) => delta.section === 'fluid')

    expect(fluidDelta?.posttestPercent).toBeNull()
    expect(fluidDelta?.delta).toBeNull()
  })
})
