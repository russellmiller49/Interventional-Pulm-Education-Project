import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import type { EcmoInteractiveFoundationSectionId } from './foundationLessonRuntime'

/**
 * Story problems that decouple the two confusable controls (skill principle 5).
 *
 * Each is a sixty-second constructed illustration read on the reference circuit: a colleague has
 * just moved one of the two controls for a reason that sounds sensible, and the learner predicts
 * which value moves first and which does not move at all — then runs the very same change on the
 * circuit and reads the triad. The point is not the number but the axis: sweep moves CO₂, pump
 * speed moves flow, and the wrong knob visibly fails to help.
 *
 * `runGuidedActionId` names a `restore-and-apply` guided action on the section's runtime, so the
 * story is always run from the same clean reference state the stem describes. `story-problems.test.ts`
 * derives each verdict's direction from an engine run, so the copy cannot contradict the model.
 */
export interface EcmoStoryProblem {
  readonly id: string
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly title: string
  readonly item: ClinicalLearningItem
  /** The guided action that reproduces the colleague's change on the circuit. */
  readonly runGuidedActionId: string
  /** The four readings to watch after the change, in reading order. */
  readonly triad: readonly ('paCO2' | 'pH' | 'spo2' | 'bloodFlow')[]
  /** One line naming which axis the control actually moved. */
  readonly axisVerdict: string
}

const sources = ['ecmo-book-ch16', 'ecmo-book-ch17', 'bounded-educational-model'] as const

const authored: readonly EcmoStoryProblem[] = [
  {
    id: 'story-doubled-sweep',
    sectionId: 'blood-flow-versus-sweep',
    title: 'Story problem: the doubled sweep',
    runGuidedActionId: 'double-sweep',
    triad: ['paCO2', 'pH', 'spo2', 'bloodFlow'],
    axisVerdict:
      'Sweep moved the carbon dioxide axis. The saturation the colleague was worried about is on the other axis, and it did not follow.',
    item: clinicalLearningItemSchema.parse({
      id: 'ecmo.foundation.blood-flow-versus-sweep.story.doubled-sweep',
      activityId: 'ecmo:learn:blood-flow-versus-sweep',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'A constructed illustration. A colleague, worried by a saturation that has drifted down over the last hour, has just doubled the sweep on the blender. Nothing else was touched. Before the circuit responds: which of these values moves first, and which does not move at all?',
      choices: [
        {
          id: 'co2-falls-sat-holds',
          label: 'The carbon dioxide falls and the pH rises; the saturation barely moves.',
          plausibility: 'best',
          rationale:
            'Sweep sets the gradient on the gas side of the membrane, and carbon dioxide is the gas that gradient governs. Oxygen transfer is limited by how much blood passes the membrane, which the blender did not change.',
        },
        {
          id: 'sat-climbs-first',
          label: 'The saturation climbs first, because more oxygen is being delivered.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'More gas past the fibers does not put more blood past them. The blood leaving the membrane was already nearly saturated; the drifting patient saturation is a blood-path question.',
        },
        {
          id: 'flow-rises-with-sweep',
          label: 'The circuit flow rises with the sweep.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The blender and the pump are separate controls on separate paths. Sweep changes nothing about how hard the pump drives blood round the circuit.',
        },
        {
          id: 'nothing-until-speed',
          label: 'Nothing moves until the pump speed is raised as well.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The gas-side change acts on its own axis whether or not the pump is touched. Coupling the two is the habit this section exists to break.',
        },
      ],
      correctChoiceIds: ['co2-falls-sat-holds'],
      explanation:
        'The two controls act on two paths. Doubling the sweep steepens the carbon dioxide gradient and clears carbon dioxide faster, so PaCO₂ falls and pH rises; the saturation, which depends on how much blood passes the membrane and on the patient, hardly moves. The colleague reached for the knob on the other axis. Model boundary: PaCO₂ responds to sweep as a straight line in this simulation, by construction; real removal shows diminishing returns, so read the direction, not the slope.',
      evidenceIds: [...sources],
      reviewStatus: 'draft',
    }),
  },
  {
    id: 'story-raised-speed',
    sectionId: 'blood-flow-versus-sweep',
    title: 'Story problem: speed for a climbing CO₂',
    runGuidedActionId: 'increase-rpm-by-400',
    triad: ['bloodFlow', 'spo2', 'paCO2', 'pH'],
    axisVerdict:
      'Pump speed moved the flow axis. The carbon dioxide the colleague was chasing is on the gas axis, and it did not follow.',
    item: clinicalLearningItemSchema.parse({
      id: 'ecmo.foundation.blood-flow-versus-sweep.story.raised-speed',
      activityId: 'ecmo:learn:blood-flow-versus-sweep',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'A constructed illustration. The carbon dioxide has been climbing for an hour and the pH is drifting down. A colleague turns the pump speed up by four hundred rpm to clear it. Nothing else was touched. Before the circuit responds: which value moves first, and which does not move at all?',
      choices: [
        {
          id: 'flow-rises-co2-holds',
          label: 'The circuit flow rises; the carbon dioxide hardly changes.',
          plausibility: 'best',
          rationale:
            'Speed drives blood round the circuit, so flow rises at once. Carbon dioxide clearance is governed by the gas-side gradient, which the pump did not touch.',
        },
        {
          id: 'co2-falls-with-flow',
          label: 'The carbon dioxide falls in step with the extra flow.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Carbon dioxide is so diffusible that its clearance is set mostly by the gas gradient, not by how much blood passes the membrane. The extra flow leaves the gradient where it was.',
        },
        {
          id: 'ph-corrects-first',
          label: 'The pH recovers first, because more blood is passing the membrane.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The pH follows the carbon dioxide, and the carbon dioxide follows the sweep. More blood past the membrane changes oxygen transfer, not the acid–base axis.',
        },
        {
          id: 'keep-raising-speed',
          label:
            'Flow rises and the drainage pressure falls further; keep raising speed until the carbon dioxide moves.',
          plausibility: 'unsafe',
          rationale:
            'Chasing a gas-side number with the blood-side knob pulls harder on the drainage limb for no gain on the axis that matters. The move to make is on the blender.',
        },
      ],
      correctChoiceIds: ['flow-rises-co2-holds'],
      explanation:
        'Pump speed acts on the blood path: flow rises immediately and the saturation may nudge upward. The carbon dioxide, which lives on the gas path, hardly moves, and the pH stays where the carbon dioxide leaves it. The colleague reached for the knob on the other axis; the sweep is the control for this problem. Model boundary: drainage-limited flow, recirculation and native lung recovery are not part of this illustration; the reference circuit responds to speed alone.',
      evidenceIds: [...sources],
      reviewStatus: 'draft',
    }),
  },
]

export const ecmoStoryProblems: readonly EcmoStoryProblem[] = Object.freeze(authored)

export function ecmoStoryProblemsFor(
  sectionId: EcmoInteractiveFoundationSectionId,
): readonly EcmoStoryProblem[] {
  return ecmoStoryProblems.filter((story) => story.sectionId === sectionId)
}

/** Import-time checks the schema cannot express: one story per guided action, distinct ids. */
export function validateEcmoStoryProblems(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const story of ecmoStoryProblems) {
    if (ids.has(story.id)) errors.push(`duplicate story id ${story.id}`)
    ids.add(story.id)
    if (story.triad.length !== 4) errors.push(`${story.id}: the triad must name four readings`)
    if (!story.axisVerdict.trim()) errors.push(`${story.id}: axisVerdict is empty`)
  }
  return errors
}

const storyErrors = validateEcmoStoryProblems()
if (storyErrors.length > 0) {
  throw new Error(`ecmoStoryProblems registry invalid:\n${storyErrors.join('\n')}`)
}
