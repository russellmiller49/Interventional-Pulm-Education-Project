import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'

import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
} from '../content/foundationLessonRuntime'
import { ecmoStoryProblems, ecmoStoryProblemsFor } from '../content/storyProblems'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
} from '../session/foundationSession'
import type { EcmoSimulationState } from '../engine/types'

/**
 * The story problems say which axis each control moves. The engine decides whether that is true.
 *
 * Each story names a guided action; this suite runs it from the reference state exactly the way the
 * activity does and reads the triad. If the model ever stops moving carbon dioxide with sweep, or
 * starts moving it with speed, the copy is wrong and this fails before a learner reads it.
 */

const BANNED =
  /\b(score|points|grade|pass|fail|correct|incorrect|wrong|mastery|exam|test|quiz|assessment|percent|competency)\b|%/i

function reference(): EcmoSimulationState {
  const runtime = ecmoFoundationLessonRuntime('blood-flow-versus-sweep')
  return createEcmoFoundationSessionState(ecmoFoundationPrimaryVariant(runtime, 'vv')).simulation
}

function afterStory(storyId: string): { before: EcmoSimulationState; after: EcmoSimulationState } {
  const story = ecmoStoryProblems.find((candidate) => candidate.id === storyId)
  if (!story) throw new Error(`No story ${storyId}`)
  const runtime = ecmoFoundationLessonRuntime(story.sectionId)
  const guided = runtime.guidedActions.find((action) => action.id === story.runGuidedActionId)
  if (!guided) throw new Error(`${storyId} names a guided action the runtime does not have`)
  const variant = ecmoFoundationVariant(runtime, 'vv', guided.variantId ?? '')
  if (!variant) throw new Error(`No variant ${guided.variantId}`)
  const before = createEcmoFoundationSessionState(variant).simulation
  const after = ecmoFoundationSessionReducer(
    createEcmoFoundationSessionState(ecmoFoundationPrimaryVariant(runtime, 'vv')),
    ecmoFoundationRestoreAction(variant, guided),
  ).simulation
  return { before, after }
}

describe('the story problems are valid items on the section that owns them', () => {
  it('registers exactly two stories on blood-flow-versus-sweep, each with a guided action', () => {
    const stories = ecmoStoryProblemsFor('blood-flow-versus-sweep')
    expect(stories.map((story) => story.id)).toEqual(['story-doubled-sweep', 'story-raised-speed'])
    const runtime = ecmoFoundationLessonRuntime('blood-flow-versus-sweep')
    for (const story of stories) {
      expect(runtime.guidedActions.some((action) => action.id === story.runGuidedActionId)).toBe(
        true,
      )
      expect(clinicalLearningItemSchema.safeParse(story.item).success).toBe(true)
      expect(story.item.phase).toBe('observe')
      expect(story.item.reviewStatus).toBe('draft')
    }
  })

  it('carries no banned learner-copy term and no invented threshold', () => {
    for (const story of ecmoStoryProblems) {
      const text = [
        story.title,
        story.axisVerdict,
        story.item.stem,
        story.item.explanation,
        ...story.item.choices.flatMap((choice) => [choice.label, choice.rationale]),
      ].join(' ')
      expect(text).not.toMatch(BANNED)
      // "four hundred rpm" is spelled out on purpose: the only digits allowed are none.
      expect(text).not.toMatch(/\d/)
    }
  })

  it('does not make the best label the uniquely longest one in both stories', () => {
    const longestIsBest = ecmoStoryProblems.filter((story) => {
      const lengths = story.item.choices.map((choice) => choice.label.length)
      const max = Math.max(...lengths)
      const best = story.item.choices.find((choice) => choice.plausibility === 'best')
      return lengths.filter((length) => length === max).length === 1 && best?.label.length === max
    })
    expect(longestIsBest.length).toBeLessThan(ecmoStoryProblems.length)
  })
})

describe('the engine agrees with each story’s verdict', () => {
  it('doubling the sweep moves carbon dioxide and pH, not flow, and barely the saturation', () => {
    const { before, after } = afterStory('story-doubled-sweep')
    expect(after.gas.sweepLpm).toBeCloseTo(reference().gas.sweepLpm * 2, 5)
    expect(after.patient.paCO2).toBeLessThan(before.patient.paCO2 - 1)
    expect(after.patient.pH).toBeGreaterThan(before.patient.pH)
    expect(Math.abs(after.circuit.bloodFlow - before.circuit.bloodFlow)).toBeLessThan(0.05)
    // The saturation may drift with the settled circuit, but far less than the CO₂ moved.
    expect(Math.abs(after.patient.spo2 - before.patient.spo2)).toBeLessThan(
      Math.abs(after.patient.paCO2 - before.patient.paCO2),
    )
  })

  it('raising the speed moves flow, and hardly carbon dioxide', () => {
    const { before, after } = afterStory('story-raised-speed')
    expect(after.device.rpmSetpoint).toBe(before.device.rpmSetpoint + 400)
    expect(after.circuit.bloodFlow).toBeGreaterThan(before.circuit.bloodFlow + 0.1)
    expect(Math.abs(after.patient.paCO2 - before.patient.paCO2)).toBeLessThan(
      after.circuit.bloodFlow - before.circuit.bloodFlow + 1,
    )
    // And the flow moved more, in its own units, than the CO₂ did in its own.
    expect(Math.abs(after.patient.paCO2 - before.patient.paCO2)).toBeLessThan(2)
  })
})
