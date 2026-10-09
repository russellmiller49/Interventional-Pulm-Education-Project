import type { ScopeCommand } from '../components/scope/types'
import { BENCH, FIVE_CONTROLS_TASKS, type FiveControlsTaskId } from './fiveControlsBench'
import type { BronchLearnUnit } from './learnUnit'
import { section } from './sections/five-controls'
import { bronchSectionItems } from './stageItems'
import type { StepInput } from './stageLessons'

export { GUIDED_BENCH_TARGET, TRANSFER_BENCH_TARGET } from './fiveControlsBench'

/**
 * The bench units of "Driving the scope". Each unit shows one block of the section and runs one of
 * its bench activities, first with a demonstration and a cue, then again without. The words a
 * learner reads are the section's blocks, so the authoring rules measure them; this file adds only
 * what belongs to the bench: the demonstration, the cue and the line shown when the goal is met.
 *
 * `stageLessons.ts` lays these units out in the order of the section's course flow.
 */
function block(id: string) {
  const found = section.blocks.find((entry) => entry.id === id)
  if (!found) throw new Error(`Driving the scope has no block ${id}.`)
  return {
    heading: found.heading,
    paragraphs: found.body.split('\n\n'),
    sourceRefs: found.sourceRefs,
  }
}

type Demonstration = readonly { readonly command: ScopeCommand; readonly caption: string }[]

function task(
  id: FiveControlsTaskId,
  title: string,
  instruction: string,
  learn: BronchLearnUnit,
): StepInput {
  const { view, goals } = FIVE_CONTROLS_TASKS[id]
  return {
    phase: 'act',
    title,
    instruction,
    lookIn: {
      pane: 'simulator',
      landmark: 'the scope controls under the view',
      alsoPane: 'steps',
      alsoLandmark: 'the goals on this card',
    },
    actionLabel: 'Continue',
    interaction: { kind: 'scope-task', view, goals },
    workspace: { kind: 'scope', view },
    learn,
  }
}

/** A unit taught from one block: watched once, then tried with the cue. */
function guided(
  id: 'depth' | 'bend' | 'rotation' | 'combine' | 'suction',
  title: string,
  instruction: string,
  cue: string,
  success: string,
  demonstration: Demonstration,
): StepInput {
  return task(id, title, instruction, {
    id,
    ...block(id),
    support: 'guided',
    cue,
    success,
    demonstration,
  })
}

/** The same activity again, with no demonstration and no cue. */
function repeat(
  id: 'depth-repeat' | 'bend-repeat' | 'rotation-repeat' | 'suction-repeat',
  from: 'depth' | 'bend' | 'rotation' | 'suction',
  title: string,
  instruction: string,
  heading: string,
  line: string,
  success: string,
): StepInput {
  return task(id, title, instruction, {
    id,
    heading,
    paragraphs: [line],
    sourceRefs: block(from).sourceRefs,
    support: 'repeat',
    success,
  })
}

export function fiveControlsLearnInputs(): readonly StepInput[] {
  return [
    {
      phase: 'recognize',
      title: 'Hold the scope',
      instruction:
        'Find the control section, the insertion tube and the bending section. Then find the lever and the suction valve.',
      lookIn: {
        pane: 'simulator',
        landmark: 'Instrument orientation',
        alsoPane: 'teaching',
        alsoLandmark: 'What each hand does',
      },
      actionLabel: 'Continue',
      interaction: { kind: 'read' },
      workspace: { kind: 'scope', view: BENCH },
      learn: { id: 'instrument', ...block('grip'), support: 'orientation', orientation: true },
    },
    {
      phase: 'predict',
      title: 'Before you touch it: what does turning do?',
      instruction: 'Choose an answer and check it, or open the explanation first.',
      lookIn: { pane: 'steps', landmark: 'the answer choices on this card' },
      actionLabel: 'Check this answer',
      interaction: {
        kind: 'prediction',
        stage: bronchSectionItems('five-controls').prediction,
        round: 0,
      },
      workspace: { kind: 'scope', view: BENCH },
      learn: {
        id: 'check',
        heading: 'Commit to an answer first',
        support: 'check',
        sourceRefs: block('rotation').sourceRefs,
        paragraphs: ['You will try this on the bench in a few minutes. Say what you expect now.'],
      },
    },
    guided(
      'depth',
      'Advance and withdraw',
      'Watch the example, then move the tip forward and back yourself.',
      'Press Advance and watch the depth rise. Then press Withdraw until the depth is back to zero.',
      'You advanced, then withdrew to the starting depth.',
      [
        {
          command: { type: 'advance', mm: 12 },
          caption: 'The right hand moves the tube forward. Depth rises and the card looks larger.',
        },
        {
          command: { type: 'advance', mm: -12 },
          caption: 'The right hand draws the tube back. Depth returns to the start.',
        },
      ],
    ),
    repeat(
      'depth-repeat',
      'depth',
      'Depth again, without the cue',
      'Make the card look closer, then return to the starting depth.',
      'Check the result in both views',
      'Same task, no cue. Use the depth readout to check that you are back where you started.',
      'You went forward and came back to the starting depth.',
    ),
    guided(
      'bend',
      'Bend the tip',
      'Watch the lever and the tip, then bend and release the tip yourself.',
      'Move the Deflection slider away from straight, then return it to zero. The arrow keys also move the lever.',
      'You bent the tip and released it, and the depth did not change.',
      [
        {
          command: { type: 'set-deflection', deg: 60 },
          caption: 'The thumb pushes the lever down and the tip bends up. The view looks up.',
        },
        {
          command: { type: 'set-deflection', deg: 0 },
          caption: 'Letting go of the lever straightens the tip.',
        },
        {
          command: { type: 'set-deflection', deg: -60 },
          caption: 'The thumb lifts the lever and the tip bends down. The view looks down.',
        },
        {
          command: { type: 'set-deflection', deg: 0 },
          caption: 'The lever returns to neutral and the tip is straight again.',
        },
      ],
    ),
    repeat(
      'bend-repeat',
      'bend',
      'The bend again, without the cue',
      'Change the direction the tip faces, then bring it back to straight.',
      'Direction, at a fixed depth',
      'Same task, no cue. Watch the tip in the outside view and the direction in the scope view.',
      'You changed the bend and came back to straight, at the same depth.',
    ),
    guided(
      'rotation',
      'Rotate the scope',
      'Watch the image and the bend turn together, then turn, bend and turn again yourself.',
      'Use Rotation with the tip straight. Add a bend with Deflection. Then change Rotation again and keep the bend.',
      'You turned the straight tip and the bent tip. The camera and the bending plane turned together.',
      [
        {
          command: { type: 'set-rotation', deg: 45 },
          caption: 'The straight scope rotates. The card turns in the image.',
        },
        {
          command: { type: 'set-deflection', deg: 25 },
          caption: 'The lever bends the tip within the rotated plane.',
        },
        {
          command: { type: 'set-rotation', deg: 0 },
          caption: 'The bent tip sweeps around as the scope turns back.',
        },
      ],
    ),
    repeat(
      'rotation-repeat',
      'rotation',
      'Rotation again, without the cue',
      'The tip starts bent. Turn it without changing its bend or its depth.',
      'One movement, two effects',
      'Same task, no cue. Watch the image turn and the bent tip sweep around.',
      'The bent tip pointed a new way, with the same bend and the same depth.',
    ),
    guided(
      'combine',
      'Aim at a target',
      'Keep the gold target centered as you advance into the depth band.',
      'Bring the target to the top of the image with Rotation. Center it with Deflection. Then advance, and adjust the bend to keep it centered.',
      'The target is centered at the right depth. You aimed before you advanced.',
      [
        {
          command: { type: 'set-rotation', deg: 45 },
          caption: 'Rotate until the target lies in the bending plane.',
        },
        {
          command: { type: 'set-deflection', deg: 27 },
          caption: 'Bend to bring the gold target to the center.',
        },
        {
          command: { type: 'advance', mm: 12 },
          caption: 'Advance a short distance. The target shifts as you get closer.',
        },
        {
          command: { type: 'set-deflection', deg: 33 },
          caption: 'Adjust the bend to keep the target centered.',
        },
      ],
    ),
    guided(
      'suction',
      'Suction',
      'Watch the suction valve, then apply and release it yourself.',
      'Select Suction and watch the tip. Then clear the checkbox.',
      'You applied suction and released it. The tip did not move.',
      [
        {
          command: { type: 'suction', on: true },
          caption:
            'The index finger presses the valve. The indicator turns on and the tip stays put.',
        },
        {
          command: { type: 'suction', on: false },
          caption: 'The finger lifts and suction stops.',
        },
      ],
    ),
    repeat(
      'suction-repeat',
      'suction',
      'Suction again, without the cue',
      'Apply suction, then release it. Watch whether the tip moves.',
      'A short burst',
      'Same task, no cue. Apply suction briefly and let go.',
      'You applied suction and released it while the tip stayed in place.',
    ),
    task(
      'transfer',
      'A target in a new place',
      'The target has moved. Decide which movements you need, then center it and advance.',
      {
        id: 'transfer',
        heading: 'Read the view, then choose',
        support: 'transfer',
        sourceRefs: block('combine').sourceRefs,
        paragraphs: [
          'You have every control, and you may not need them all. Look at where the target sits before you move.',
        ],
        cue: 'Compare the target with the plane the lever bends in. Use only the movements you need to center it, then advance.',
        success: 'You centered a target in a new place and reached the right depth.',
      },
    ),
  ]
}
