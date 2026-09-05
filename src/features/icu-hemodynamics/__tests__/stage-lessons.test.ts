import { orderChoices } from '@/features/learning-module/stage/choiceOrder'

import { hemodynamicsSectionIds, hemodynamicsSectionSpec } from '../content/sectionSpecs'
import { hemodynamicsStageItems } from '../content/stageItems'
import {
  hemodynamicsStageLesson,
  hemodynamicsStageLessons,
  precommitAuthoredSurfaces,
  validateHemodynamicsStageLessons,
} from '../content/stageLessons'

/**
 * The lesson contracts, on the registries alone.
 *
 * Nine lessons in the pathway's order, one prediction and one transfer each, everything after the
 * prediction gated on it, the first step a Recognize and the last a Transfer, and no pre-commit
 * authored surface carrying a phrase from its section's deny set. The adapter validates the same
 * things at import; this suite is where a failure is read.
 */
describe('the nine lessons', () => {
  it('validate, in the pathway order', () => {
    expect(validateHemodynamicsStageLessons()).toEqual([])
    expect(hemodynamicsStageLessons().map((lesson) => lesson.sectionId)).toEqual([
      ...hemodynamicsSectionIds,
    ])
  })

  it.each(hemodynamicsSectionIds)('%s has one shape', (sectionId) => {
    const lesson = hemodynamicsStageLesson(sectionId)
    expect(lesson.steps[0].phase).toBe('recognize')
    expect(lesson.steps.at(-1)?.phase).toBe('transfer')
    expect(lesson.predictionStepIndex).toBeGreaterThan(0)
    expect(lesson.transferStepIndex).toBeGreaterThan(lesson.predictionStepIndex)
    const ids = new Set(lesson.steps.map((step) => step.id))
    expect(ids.size).toBe(lesson.steps.length)
    lesson.steps.forEach((step, index) => {
      expect(step.ordinal).toBe(index + 1)
      expect(step.gate).toBe(index > lesson.predictionStepIndex ? 'after-prediction' : 'open')
      expect(/\d/.test(step.title)).toBe(false)
    })
    const predictions = lesson.steps.filter(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
    )
    expect(predictions).toHaveLength(1)
  })

  it('carries no deny phrase on any pre-commit authored surface', () => {
    for (const lesson of hemodynamicsStageLessons()) {
      for (const surface of precommitAuthoredSurfaces(lesson)) {
        if (surface.where.endsWith('stem')) continue
        for (const pattern of lesson.spec.precommitDenyPatterns) {
          expect(`${lesson.sectionId} ${surface.where}: ${pattern.test(surface.text)}`).toBe(
            `${lesson.sectionId} ${surface.where}: false`,
          )
        }
      }
    }
  })

  it('locks the steps after the prediction until it is committed', () => {
    for (const lesson of hemodynamicsStageLessons()) {
      const after = lesson.steps.slice(lesson.predictionStepIndex + 1)
      expect(after.every((step) => step.gate === 'after-prediction')).toBe(true)
    }
  })
})

describe('the items across the set', () => {
  const items = Object.values(hemodynamicsStageItems).flatMap((entry) => [
    entry.prediction,
    entry.transfer,
  ])

  it('do not put the keyed choice first every time once rotated', () => {
    const firstIsKeyed = items.filter(
      (item) => orderChoices(item.id, item.choices)[0].id === item.correctChoiceIds[0],
    ).length
    expect(firstIsKeyed / items.length).toBeLessThan(0.6)
  })

  it('do not make the keyed choice the longest every time', () => {
    const longestIsKeyed = items.filter((item) => {
      const longest = [...item.choices].sort((a, b) => b.label.length - a.label.length)[0]
      return longest.id === item.correctChoiceIds[0]
    }).length
    expect(longestIsKeyed / items.length).toBeLessThan(0.7)
  })

  it('give every distractor a rationale and a plausibility that is not best', () => {
    for (const item of items) {
      for (const choice of item.choices) {
        expect(choice.rationale.length).toBeGreaterThan(20)
        if (!item.correctChoiceIds.includes(choice.id)) expect(choice.plausibility).not.toBe('best')
      }
    }
  })

  it('name a discrimination, not an action, in every objective', () => {
    for (const sectionId of hemodynamicsSectionIds) {
      const spec = hemodynamicsSectionSpec(sectionId)
      expect(spec.objective).toMatch(/^(Decide|Distinguish|Name)/)
    }
  })
})
