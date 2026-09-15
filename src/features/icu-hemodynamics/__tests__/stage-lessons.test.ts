import { pacAdvancementScenario } from '../content/pacAdvancementReasoning'
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
 * Nine lessons in the pathway's order, one prediction and one transfer each, the first step a
 * Recognize and the last a Transfer. HD-01 (self-paced) changed two contracts here: no step is gated
 * on the prediction any more, and the keyed-choice position and length statistics are retired —
 * a longest keyed option can carry a necessary clinical qualifier, and answer-position balancing is
 * not a release requirement. The adapter validates the rest at import; this suite is where a failure
 * is read.
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
      expect(step.gate).toBe('open')
      expect(/\d/.test(step.title)).toBe(false)
    })
    const predictions = lesson.steps.filter(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
    )
    expect(predictions).toHaveLength(1)
  })

  /*
   * Retained as an authoring aid, not an exam-security rule: the question's own stem and the steps
   * leading to it still do not print its answer, so the optional predict-then-reveal has something to
   * compare. Nothing hides a title or a teaching block because of it.
   */
  it('carries no deny phrase on the authored surfaces leading to its question', () => {
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

  it('gates no step on the prediction', () => {
    for (const lesson of hemodynamicsStageLessons()) {
      expect(lesson.steps.every((step) => step.gate === 'open')).toBe(true)
    }
  })

  it('describes no quota, lock or first-response tally in any step copy', () => {
    for (const lesson of hemodynamicsStageLessons()) {
      for (const step of lesson.steps) {
        expect(`${step.title} ${step.instruction}`).not.toMatch(
          /five correct|in total|errors do not reset|assisted|first answers|unlock|commit/i,
        )
      }
    }
  })
})

describe('the items across the set', () => {
  const items = Object.values(hemodynamicsStageItems).flatMap((entry) => [
    entry.prediction,
    entry.transfer,
  ])

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
      expect(spec.objective).toMatch(/^(Decide|Distinguish|Name|Identify)/)
    }
  })
})

/**
 * The HD-01 content batch: wording and structure only, clinical meaning and keys unchanged, every
 * edited item `draft` pending hemodynamics faculty review. The full ledger is in
 * `docs/gap-remediation/self-paced/HD-01-question-ledger.md`.
 */
describe('the HD-01 content batch', () => {
  it('restores the advancement choice exactly as the scenario authors it', () => {
    const advance = hemodynamicsStageItems['catheter-advancement'].prediction
    const scenario = pacAdvancementScenario('ra-to-rv').commitment
    expect(advance.id).toBe('hd-advance-predict-1')
    expect(advance.choices).toEqual(scenario.choices)
    expect(advance.correctChoiceIds).toEqual(scenario.correctChoiceIds)
    expect(advance.reviewStatus).toBe('draft')
  })

  it('keeps "cannot be named" a useful answer that says what to inspect next', () => {
    const place = hemodynamicsStageItems['waveform-interpretation']
    for (const item of [place.prediction, place.transfer]) {
      const uncertain = item.choices.find((choice) => choice.id === 'cannot-name')!
      expect(uncertain.plausibility).toBe('reasonable-but-incomplete')
      expect(uncertain.rationale).toMatch(/cannot be trusted/)
      expect(uncertain.rationale).toMatch(/repair or re-read/)
      expect(item.correctChoiceIds).not.toContain('cannot-name')
      expect(item.reviewStatus).toBe('draft')
    }
    expect(
      place.transfer.choices.find((choice) => choice.id === 'cannot-name')!.rationale,
    ).not.toMatch(/heard/)
  })

  it('names each mechanism by its clinical term first and keeps the key', () => {
    const waves = hemodynamicsStageItems['waveform-components'].transfer
    expect(waves.choices.map((choice) => choice.label.split(':')[0])).toEqual([
      'Tamponade',
      'Constriction',
      'Tricuspid regurgitation',
    ])
    expect(waves.correctChoiceIds).toEqual(['pericardial-constraint'])
    expect(
      waves.choices.find((choice) => choice.id === 'tricuspid-regurgitation')!.label,
    ).not.toMatch(/the descent/)
  })

  it('keeps the orientation contrast between a measured pressure and its cause', () => {
    const why = hemodynamicsStageItems['why-measure']
    expect(why.prediction.correctChoiceIds).toEqual(['driving-pressure-only'])
    expect(why.prediction.choices.find((choice) => choice.id === 'needs-fluid')!.rationale).toMatch(
      /vasodilation/,
    )
    expect(why.prediction.choices.map((choice) => choice.rationale).join(' ')).not.toMatch(
      /wide-open|relaxed circulation/,
    )
    expect(why.transfer.stem).toMatch(/measures or collects/)
    expect(why.transfer.correctChoiceIds).toEqual(['measures-pressures-flow-samples'])
  })
})
