import {
  clinicalLearningItemSchema,
  flaggedLearnerCopyTerms,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import { ecmoLearnPredictions } from '../content/learnPredictionItems'
import { cardiohelpScenarioById } from '../content/scenarios'

const scenarioId = 'transport-power-loss'
const item = ecmoLearnPredictions[scenarioId].item

// Match the shared schema's complete learner-facing text, without applying its broad override.
function learnerCopy(candidate: ClinicalLearningItem): string {
  return [
    candidate.stem,
    candidate.explanation,
    ...candidate.choices.flatMap((choice) => [choice.label, choice.rationale]),
  ].join(' ')
}

describe('transport battery-unit editorial exception', () => {
  it('permits only the single battery percent token across all learner-facing text', () => {
    const copy = learnerCopy(item)
    expect(flaggedLearnerCopyTerms(copy)).toEqual(['percent'])
    expect(copy.match(/\bpercent\b/gi)).toHaveLength(1)
    expect(copy).not.toContain('%')
    expect(clinicalLearningItemSchema.safeParse(item).success).toBe(true)
    // The shared guard is unchanged; the local regression limits this item's exception instead.
    expect(
      clinicalLearningItemSchema.safeParse({ ...item, learnerCopyOverrideReason: undefined })
        .success,
    ).toBe(false)
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

  it('does not extend the exception to another prediction', () => {
    expect(item.learnerCopyOverrideReason).toBeTruthy()
    expect(
      Object.entries(ecmoLearnPredictions)
        .filter(
          ([, prediction]) =>
            prediction.item.learnerCopyOverrideReason === item.learnerCopyOverrideReason,
        )
        .map(([id]) => id),
    ).toEqual([scenarioId])
  })

  it.each(['stem', 'explanation', 'choice label', 'choice rationale'] as const)(
    'detects unrelated grading/software vocabulary in the overridden %s',
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
        // The full-copy assertion above must reject every token other than the battery unit,
        // even when a reason would make the shared schema skip its vocabulary check.
        expect(
          flaggedLearnerCopyTerms(learnerCopy(injected)).filter((flag) => flag !== 'percent'),
        ).toEqual([term])
      }
    },
  )
})
