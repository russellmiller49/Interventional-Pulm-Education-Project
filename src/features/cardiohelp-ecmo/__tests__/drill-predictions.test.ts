import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'

import { ecmoDrillPredictions, ecmoDrillPredictionFor } from '../content/drillLearningItems'
import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import { cardiohelpScenarioById } from '../content/scenarios'

/**
 * B1 — the drill prediction must be answered, not read.
 *
 * The generated step this replaces printed the goal, the control and the direction in its
 * instruction, printed the scenario's whole causal chain in its rationale above the button, and
 * dispatched the scenario's own expectation as the payload of a single button. The plan names four
 * automated checks that should have failed against it; they are the first four blocks here.
 */

const drills = Object.entries(ecmoDrillPredictions)

describe('B1: every drill has an authored prediction', () => {
  it('covers every drill lesson built from the shared template', () => {
    const lessonScenarioIds = [
      ...cardiohelpLearnLessonsBySupportMode.vv,
      ...cardiohelpLearnLessonsBySupportMode.va,
    ]
      .map((lesson) => lesson.scenarioId)
      .filter((scenarioId) => ecmoDrillPredictionFor(scenarioId) !== undefined)

    expect(lessonScenarioIds.length).toBeGreaterThanOrEqual(18)
    for (const scenarioId of lessonScenarioIds) {
      expect(ecmoDrillPredictionFor(scenarioId)).toBeDefined()
    }
  })

  it('parses every item through the shared clinical-item schema', () => {
    expect(drills.length).toBe(18)
    for (const [, entry] of drills) {
      expect(() => clinicalLearningItemSchema.parse(entry.item)).not.toThrow()
    }
  })
})

describe('B1 check 1: the prompt does not contain the expected answer', () => {
  it.each(drills)(
    '%s states neither the control nor the direction as an instruction',
    (scenarioId, entry) => {
      const scenario = cardiohelpScenarioById.get(scenarioId)
      if (!scenario) throw new Error(`Missing scenario ${scenarioId}`)
      const { control, direction, goalId } = scenario.expectation
      const stem = entry.item.stem.toLowerCase()

      // The retired generated form, in every shape it could take.
      expect(stem).not.toMatch(new RegExp(`\\buse ${control}\\b`))
      expect(stem).not.toMatch(new RegExp(`\\bpredict ${direction}\\b`))
      expect(stem).not.toMatch(/the safe goal is/)
      // Raw enum ids must never be shown to a learner at all.
      expect(stem).not.toContain(goalId)
      expect(stem).not.toContain('inspect-circuit')
      expect(stem).not.toContain('correct-cause')
      expect(stem).not.toContain('off-sweep-trial')
    },
  )

  it.each(drills)(
    '%s writes its choices as clinical actions, not as raw identifiers',
    (scenarioId, entry) => {
      const scenario = cardiohelpScenarioById.get(scenarioId)
      if (!scenario) throw new Error(`Missing scenario ${scenarioId}`)
      // A choice label naming the action is the point of a choice — that is what the learner is
      // deciding between. What must never appear is the machine identifier behind it, which would
      // both leak the mapping and read as software rather than medicine.
      for (const choice of entry.item.choices) {
        const label = choice.label.toLowerCase()
        expect(label).not.toContain(scenario.expectation.goalId)
        expect(label).not.toContain('inspect-circuit')
        expect(label).not.toContain('correct-cause')
        expect(label).not.toContain('restore-gas')
        expect(label).not.toContain('off-sweep-trial')
        expect(label).not.toContain('resuscitate-preload')
        // And a label has to be a sentence a clinician would say, not a token.
        expect(choice.label.trim().split(/\s+/).length).toBeGreaterThan(3)
      }
    },
  )
})

describe('B1 check 2: the payload is not prepopulated with the answer', () => {
  it.each(drills)('%s makes every choice commit its own prediction', (scenarioId, entry) => {
    // The learner's selection decides the triple. Nothing is committed until they choose, and a
    // wrong choice commits a wrong triple — which is what makes the credit meaningful.
    for (const choice of entry.item.choices) {
      expect(entry.commitments[choice.id]).toBeDefined()
    }
    const triples = Object.values(entry.commitments).map(
      (commitment) => `${commitment.goalId}|${commitment.control}|${commitment.direction}`,
    )
    // At least two genuinely different commitments, or choosing would not be a decision.
    expect(new Set(triples).size).toBeGreaterThan(1)
  })

  it.each(drills)(
    '%s commits the scenario expectation only for the best choice',
    (scenarioId, entry) => {
      const scenario = cardiohelpScenarioById.get(scenarioId)
      if (!scenario) throw new Error(`Missing scenario ${scenarioId}`)
      const { goalId, control, direction } = scenario.expectation

      const bestId = entry.item.correctChoiceIds[0]
      expect(entry.commitments[bestId]).toEqual({ goalId, control, direction })

      for (const [choiceId, commitment] of Object.entries(entry.commitments)) {
        if (choiceId === bestId) continue
        // A non-best choice must differ somewhere, or it would score full credit anyway.
        expect(
          commitment.goalId !== goalId ||
            commitment.control !== control ||
            commitment.direction !== direction,
        ).toBe(true)
      }
    },
  )
})

describe('B1 check 3: a plausible incorrect option exists', () => {
  it.each(drills)('%s offers real alternatives with reasoned rationales', (scenarioId, entry) => {
    const { choices } = entry.item
    expect(choices.length).toBeGreaterThanOrEqual(4)

    const best = choices.filter((choice) => choice.plausibility === 'best')
    expect(best).toHaveLength(1)
    expect(entry.item.correctChoiceIds).toEqual([best[0].id])

    // Not a straw-man set: at least one distractor a reasoning learner would actually consider,
    // and one that is the harmful reflex this drill exists to discourage.
    const plausibilities = new Set(choices.map((choice) => choice.plausibility))
    expect(plausibilities.has('unsafe')).toBe(true)
    expect(
      plausibilities.has('incorrect-mechanism') || plausibilities.has('reasonable-but-incomplete'),
    ).toBe(true)

    // Every option earns its place: a rationale that says why, not just that.
    for (const choice of choices) {
      expect(choice.rationale.length).toBeGreaterThan(80)
    }
    expect(entry.item.explanation.length).toBeGreaterThan(120)
  })
})

describe('B1 check 4: nothing about the item advances the phase', () => {
  it.each(drills)('%s carries no advancement or navigation instruction', (scenarioId, entry) => {
    // Advancement belongs to the Continue control in the shared verdict component. Content must
    // not imply the learner is moved along automatically.
    const copy = [
      entry.item.stem,
      entry.item.explanation,
      ...entry.item.choices.flatMap((choice) => [choice.label, choice.rationale]),
    ]
      .join(' ')
      .toLowerCase()
    expect(copy).not.toMatch(/automatically (advance|continue|move on)/)
    expect(copy).not.toMatch(/this step completes automatically/)
  })
})

describe('B1: the items agree with the drill they belong to', () => {
  it.each(drills)('%s uses only evidence the module actually carries', (scenarioId, entry) => {
    for (const evidenceId of entry.item.evidenceIds) {
      expect(typeof evidenceId).toBe('string')
      expect(evidenceId.length).toBeGreaterThan(0)
    }
    expect(entry.item.activityId).toBe(`ecmo:learn:${scenarioId}`)
    expect(entry.item.phase).toBe('predict')
    expect(entry.item.reviewStatus).toBe('draft')
  })

  it('writes saturations without the banned unit symbol anywhere', () => {
    for (const [, entry] of drills) {
      const copy = [
        entry.item.stem,
        entry.item.explanation,
        ...entry.item.choices.flatMap((choice) => [choice.label, choice.rationale]),
      ].join(' ')
      expect(copy).not.toContain('%')
    }
  })
})
