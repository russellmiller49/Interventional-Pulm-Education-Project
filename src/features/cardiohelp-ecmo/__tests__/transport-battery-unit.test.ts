import {
  clinicalLearningItemSchema,
  flaggedLearnerCopyTerms,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import { ecmoLearnPredictions } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'

const scenarioId = 'transport-power-loss'
const item = ecmoLearnPredictions[scenarioId].item

function learnerCopy(candidate: ClinicalLearningItem): string {
  return [
    candidate.stem,
    candidate.explanation,
    ...candidate.choices.flatMap((choice) => [choice.label, choice.rationale]),
  ].join(' ')
}

describe('transport battery reading', () => {
  it('states the battery charge with its unit and needs no vocabulary exception', () => {
    const copy = learnerCopy(item)
    expect(flaggedLearnerCopyTerms(copy)).toEqual([])
    expect(item.learnerCopyOverrideReason).toBeUndefined()
    expect(clinicalLearningItemSchema.safeParse(item).success).toBe(true)
  })

  it('keeps the displayed number and unit aligned with this scenario batteryPercent', () => {
    const batteryPercent =
      cardiohelpScenarioById.get(scenarioId)?.initialState?.device?.batteryPercent
    expect(batteryPercent).toBeDefined()
    const reading = item.stem.match(/battery reserve reading of (\d+(?:\.\d+)?) (\w+)/)
    expect(reading).not.toBeNull()
    expect(Number(reading?.[1])).toBe(batteryPercent)
    expect(reading?.[2]).toBe('percent')
  })

  it('leaves no prediction item carrying a vocabulary override', () => {
    expect(
      Object.entries(ecmoLearnPredictions)
        .filter(([, prediction]) => prediction.item.learnerCopyOverrideReason !== undefined)
        .map(([id]) => id),
    ).toEqual([])
  })

  it.each(['stem', 'explanation', 'choice label', 'choice rationale'] as const)(
    'still detects scoring and software vocabulary in the %s',
    (surface) => {
      for (const term of ['score', 'competent', 'engine']) {
        const injected = {
          ...item,
          choices: item.choices.map((choice) => ({ ...choice })),
        }
        if (surface === 'stem') injected.stem += ` ${term}`
        if (surface === 'explanation') injected.explanation += ` ${term}`
        if (surface === 'choice label') injected.choices[0].label += ` ${term}`
        if (surface === 'choice rationale') injected.choices[0].rationale += ` ${term}`
        expect(flaggedLearnerCopyTerms(learnerCopy(injected))).toEqual([term])
      }
    },
  )
})
