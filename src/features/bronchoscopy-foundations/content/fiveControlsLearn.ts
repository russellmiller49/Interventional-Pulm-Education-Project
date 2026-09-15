import type { ScopeGoal, ScopeGoalTest, ScopeViewSpec } from '../components/scope/types'
import type { SourceRef } from '../data/sources'
import type { BronchLearnUnit } from './learnUnit'
import { bronchSectionItems } from './stageItems'
import type { StepInput } from './stageLessons'

// Knowledge specification v2 §3.1, §4.1–4.5. Existing provenance, not new clinical guidance.
const MOTIONS: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } },
]
const HANDS: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 90 } },
  { sourceId: 'S3', location: { kind: 'pdf-pages', from: 80 } },
]
export const FIVE_CONTROLS_BOUNDARY =
  'Screen-based conceptual practice, outside an airway. The bench moves depth along a straight axis; bending changes the viewing direction. It does not measure grip, force, torque transmission or clinical hand skill. Exercise angles and distances are authored, not device limits. Use the current scope instructions and supervised training.'

const BENCH: ScopeViewSpec = {
  sectionId: 'five-controls',
  mode: 'controls-isolated',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'bench' },
  controls: [],
  assists: {},
  readouts: ['depthMm', 'rotationDeg', 'deflectionDeg'],
  boundary: FIVE_CONTROLS_BOUNDARY,
  physicalControlLabels: true,
}
// Authored 2026-09-12. These targets use the engine's bench coordinates, not patient anatomy.
export const GUIDED_BENCH_TARGET: NonNullable<ScopeViewSpec['benchTarget']> = {
  point: [-22, 22, 60],
  radiusMm: 4,
}
export const TRANSFER_BENCH_TARGET: NonNullable<ScopeViewSpec['benchTarget']> = {
  point: [0, -22, 60],
  radiusMm: 4,
}
const depthView = { ...BENCH, controls: ['advance', 'withdraw', 'reset'] } as const
const bendView = { ...BENCH, controls: ['deflect', 'reset'] } as const
const rotateView = { ...BENCH, controls: ['rotate', 'deflect', 'reset'] } as const
const combineView = {
  ...BENCH,
  controls: ['rotate', 'deflect', 'advance', 'withdraw', 'reset'],
  benchTarget: GUIDED_BENCH_TARGET,
} as const
const suctionView = {
  ...BENCH,
  controls: ['suction', 'reset'],
  readouts: ['depthMm', 'suction'],
} as const
const goal = (id: string, label: string, test: ScopeGoalTest): ScopeGoal => ({ id, label, test })
const depthGoal = goal(
  'advance-then-withdraw',
  'Move forward, then return to the starting depth.',
  {
    type: 'all',
    tests: [
      { type: 'event-sequence', events: ['advanced', 'withdrawn'] },
      { type: 'metric', metric: 'depthMm', op: '>=', value: 0 },
      { type: 'metric', metric: 'depthMm', op: '<=', value: 0 },
    ],
  },
)
const bendGoal = goal('bend-and-release', 'Bend the distal section, then return it to straight.', {
  type: 'all',
  tests: [
    { type: 'event-sequence', events: ['control-used:deflection', 'control-used:deflection'] },
    { type: 'metric', metric: 'deflectionDeg', op: '>=', value: 0 },
    { type: 'metric', metric: 'deflectionDeg', op: '<=', value: 0 },
  ],
})
function targetGoal(view: ScopeViewSpec): ScopeGoal {
  return goal(
    'center-and-approach',
    'Keep the target centered with depth in the practice band (12–16 mm).',
    {
      type: 'all',
      tests: [
        { type: 'bench-target', point: view.benchTarget!.point, toleranceDeg: 5 },
        { type: 'metric', metric: 'depthMm', op: '>=', value: 12 },
        { type: 'metric', metric: 'depthMm', op: '<=', value: 16 },
        { type: 'event', event: 'advanced' },
        { type: 'without', event: 'bench-advanced-off-target' },
      ],
    },
  )
}

function task(
  title: string,
  instruction: string,
  view: ScopeViewSpec,
  goals: readonly ScopeGoal[],
  learn: BronchLearnUnit,
): StepInput {
  return {
    phase: learn.support === 'transfer' ? 'transfer' : 'act',
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

export function fiveControlsLearnInputs(): readonly StepInput[] {
  const transferView = { ...combineView, benchTarget: TRANSFER_BENCH_TARGET }
  const inputs: StepInput[] = [
    {
      phase: 'recognize',
      title: 'Meet the bronchoscope',
      instruction:
        'Find the handle, insertion tube and distal bending section in the labeled instrument view. Then find the angulation lever and suction control.',
      lookIn: {
        pane: 'simulator',
        landmark: 'Instrument orientation',
        alsoPane: 'teaching',
        alsoLandmark: 'What each hand does',
      },
      actionLabel: 'Start with depth',
      interaction: { kind: 'read' },
      workspace: { kind: 'scope', view: BENCH },
      learn: {
        id: 'instrument',
        heading: 'What each hand does',
        support: 'orientation',
        orientation: true,
        sourceRefs: HANDS,
        paragraphs: [
          'Learn how each basic movement changes the bronchoscope tip and the image.',
          'The control hand holds the handle. In the usual setup this is the left hand, with the thumb on the angulation lever and the index finger available for suction. The other hand guides the insertion tube near the entry point and manages depth.',
          'Either control hand may be used when steering, suction, depth control, scope protection and assistant access remain effective. Arrange a comfortable monitor and working height; avoid pulling cables, sharp bends and large shaft loops. The patient’s face and eyes must not serve as a fulcrum.',
        ],
        notice:
          'Before patient use, work through shared-airway safety, preparation and monitoring. This bench exercise does not replace those prerequisites.',
      },
    },
    task(
      'Advance and withdraw',
      'Watch the example, then move the tip forward and back using the controls under the two views.',
      depthView,
      [depthGoal],
      {
        id: 'depth',
        heading: 'Depth changes the distance',
        support: 'guided',
        sourceRefs: MOTIONS,
        paragraphs: [
          'The insertion hand advances or withdraws the tube. Watch the distal tip move in the Outside view and the bench card grow or shrink in the Scope view. The direction the tip faces stays the same.',
          'In an airway, advance in small increments under vision. When leaving an angled branch, coordinate withdrawal with releasing the bend. Here the bench isolates depth.',
        ],
        cue: 'Press Advance and notice the increased depth. Then press Withdraw until the depth returns to zero.',
        success:
          'You advanced and then withdrew to the starting depth. Two forward movements would not show withdrawal.',
        demonstration: [
          {
            command: { type: 'advance', mm: 12 },
            caption:
              'The insertion hand moves the tube forward. Depth increases and the card looks larger.',
          },
          {
            command: { type: 'advance', mm: -12 },
            caption:
              'The insertion hand draws the tube back. Depth returns to the start; the tip is still straight.',
          },
        ],
      },
    ),
    task(
      'Repeat depth without the cue',
      'Make the bench card look closer, then restore the starting view. Use the depth readout to check your return.',
      depthView,
      [depthGoal],
      {
        id: 'depth-repeat',
        heading: 'Check the result in both views',
        support: 'repeat',
        sourceRefs: MOTIONS,
        paragraphs: [
          'The controls start at the same position. Choose your movements without the action cue. This is practice, and you may reset this attempt.',
        ],
        success:
          'The tip returned to the starting depth after a forward movement and a withdrawal.',
      },
    ),
    task(
      'Deflect the tip',
      'Watch the lever and distal bending section, then bend and release the tip yourself.',
      bendView,
      [bendGoal],
      {
        id: 'bend',
        heading: 'The lever bends the distal section',
        support: 'guided',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Deflection means bending the distal section with the angulation lever. On this teaching scope the lever bends toward the top or bottom of the image. It does not mean left or right in the patient.',
          'In the Outside view, watch the thumb lever move toward U as the tip bends up, or toward D as it bends down. The control head and distal section are shown as separate close-ups. Compare the bend with the Scope view; depth stays unchanged.',
        ],
        cue: 'Move the Deflection slider away from straight, then return it to zero. The arrow keys also move the lever when the scope workspace is focused.',
        success: 'You bent and released the tip while its depth stayed fixed.',
        demonstration: [
          {
            command: { type: 'set-deflection', deg: 60 },
            caption:
              'The thumb lever moves down toward U and the distal tip bends up. The Scope view looks toward the top of the original scene.',
          },
          {
            command: { type: 'set-deflection', deg: 0 },
            caption: 'Releasing the lever straightens the tip and restores the view.',
          },
          {
            command: { type: 'set-deflection', deg: -60 },
            caption:
              'The thumb lever moves up toward D and the distal tip bends down. In the Scope view, the viewing direction moves down.',
          },
          {
            command: { type: 'set-deflection', deg: 0 },
            caption: 'Return the thumb lever to neutral. The distal section straightens again.',
          },
        ],
      },
    ),
    task(
      'Repeat the bend without the cue',
      'Change the direction the tip faces, then restore the straight view without changing depth.',
      bendView,
      [bendGoal],
      {
        id: 'bend-repeat',
        heading: 'Direction with a fixed depth',
        support: 'repeat',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Use the Outside view to check the shape of the distal section, and the Scope view to check the viewing direction.',
        ],
        success: 'You changed the bend and returned to straight; insertion depth stayed unchanged.',
      },
    ),
    task(
      'Rotate the instrument',
      'Watch the image and the bending plane as the handle turns. Then try turning, bending, and turning the bent tip.',
      rotateView,
      [
        goal(
          'rotate-bend-rotate',
          'Turn the straight scope, bend the tip, then turn it while it stays bent.',
          {
            type: 'all',
            tests: [
              {
                type: 'event-sequence',
                events: [
                  'control-used:rotation',
                  'control-used:deflection',
                  'control-used:rotation',
                ],
              },
              { type: 'metric', metric: 'deflectionDeg', op: 'abs>=', value: 1 },
            ],
          },
        ),
      ],
      {
        id: 'rotation',
        heading: 'Rotation turns the camera and bending plane',
        support: 'guided',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Rotate the control section while the insertion hand guides the shaft. The camera turns, so the image rotates. The plane in which the distal section bends turns with the instrument.',
          'On this model the lever still bends toward image-up or image-down after rotation. Watch the bent tip sweep around in the Outside view. A real curved shaft may delay or absorb rotation; this model does not measure that.',
          'Camera orientation is the direction of the image on the screen. Image-up is not a fixed direction in the patient: rotating the camera changes screen positions while the anatomical parent–daughter relationships stay the same. Use visible landmarks to recover orientation. The later Reference frames lesson adds CT display orientation.',
        ],
        cue: 'Use Rotation with the tip straight. Add a bend with Deflection, then change Rotation again while keeping that bend.',
        success:
          'You turned both the straight and bent instrument. Rotation changed the orientation of the camera and bending plane without changing depth.',
        demonstration: [
          {
            command: { type: 'set-rotation', deg: 45 },
            caption: 'The straight scope rotates. The bench card turns in the image.',
          },
          {
            command: { type: 'set-deflection', deg: 25 },
            caption: 'The lever bends the tip within the rotated plane.',
          },
          {
            command: { type: 'set-rotation', deg: 0 },
            caption:
              'The bent tip turns with the instrument. Compare its direction outside with the image.',
          },
        ],
      },
    ),
    task(
      'Repeat rotation without the cue',
      'The tip starts bent. Change the direction of that bend while keeping its amount and depth unchanged.',
      { ...rotateView, controls: ['rotate', 'reset'], defaults: { deflectionDeg: 25 } },
      [
        goal(
          'turn-bent-tip',
          'Change the orientation while retaining the starting bend and depth.',
          { type: 'event', event: 'control-used:rotation' },
        ),
      ],
      {
        id: 'rotation-repeat',
        heading: 'One movement, two visible effects',
        support: 'repeat',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Compare the image and the bent distal section. The degree readouts are a check on what remained steady, not a measure of hand technique.',
        ],
        success:
          'The bent tip changed orientation while the amount of bend and depth stayed fixed.',
      },
    ),
    task(
      'Aim at a visible target',
      'Keep the gold practice target centered as you move into the indicated depth band.',
      combineView,
      [targetGoal(combineView)],
      {
        id: 'combine',
        heading: 'Choose the movement from the view',
        support: 'guided',
        sourceRefs: MOTIONS,
        paragraphs: [
          'This target starts above and to the side. Rotate to bring it into the bending plane, then deflect until it is centered. Advance in small increments, adjusting the aim as the target moves.',
          'A target already above or below center may need deflection without rotation. These are decisions from the view, not a compulsory three-motion sequence.',
        ],
        cue: 'Bring the target toward the top of the image with Rotation, center it with Deflection, then advance while keeping it centered. If you pass the depth band, withdraw and reassess.',
        success:
          'The target is centered at the requested depth. This shows coordination within the authored bench model, not branch-entry skill.',
        demonstration: [
          {
            command: { type: 'set-rotation', deg: 45 },
            caption: 'Rotate until the off-center target lies in the bending plane.',
          },
          {
            command: { type: 'set-deflection', deg: 27 },
            caption: 'Deflect to bring the gold target toward the center.',
          },
          {
            command: { type: 'advance', mm: 12 },
            caption: 'Advance a short distance. The target position changes as depth changes.',
          },
          {
            command: { type: 'set-deflection', deg: 33 },
            caption: 'Adjust the bend to keep the target centered at the new depth.',
          },
        ],
      },
    ),
    {
      phase: 'predict',
      title: 'Explain what rotation changes',
      instruction:
        'Use what you observed to answer this optional check, or open the explanation first. You can try again after feedback or continue without answering.',
      lookIn: { pane: 'steps', landmark: 'the answer choices on this card' },
      actionLabel: 'Check this answer',
      interaction: {
        kind: 'prediction',
        stage: bronchSectionItems('five-controls').prediction,
        round: 0,
      },
      workspace: { kind: 'scope', view: { ...BENCH, controls: [] } },
      learn: {
        id: 'check',
        heading: 'A learning check after practice',
        support: 'check',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Recall the relationship you saw in the two views. The simulator rests while you answer. Feedback appears after submission; this is not a formal assessment.',
        ],
      },
    },
    task(
      'Suction is a separate control',
      'Watch the suction control, then apply and release it. Check whether the tip changes position.',
      suctionView,
      [
        goal('suction-on-off', 'Apply suction and then release it.', {
          type: 'event-sequence',
          events: ['suction-applied', 'suction-released'],
        }),
      ],
      {
        id: 'suction',
        heading: 'Suction does not steer the scope',
        support: 'guided',
        sourceRefs: MOTIONS,
        paragraphs: [
          'The suction control requests suction through the working channel. It does not aim or advance the tip. The indicator shows the request only; this model does not simulate fluid flow or prove successful aspiration.',
          'Accessory operation is taught in Protected accessories. Whether suction and deflection remain effective with an accessory depends on the instrument and its instructions.',
        ],
        cue: 'Select Suction, note the indicator and stationary tip, then clear the checkbox.',
        success:
          'Suction was applied and released without steering the tip. No fluid clearance is measured here.',
        demonstration: [
          {
            command: { type: 'suction', on: true },
            caption:
              'The suction control is pressed; the indicator turns on. The tip does not move.',
          },
          {
            command: { type: 'suction', on: false },
            caption: 'The suction control is released. No fluid aspiration has been modeled.',
          },
        ],
      },
    ),
    task(
      'Repeat suction without the cue',
      'Request suction and return the control to rest. Check the indicator and tip position.',
      suctionView,
      [
        goal('suction-repeat', 'Apply suction and then release it.', {
          type: 'event-sequence',
          events: ['suction-applied', 'suction-released'],
        }),
      ],
      {
        id: 'suction-repeat',
        heading: 'Check the channel request',
        support: 'repeat',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Use the control without the action cue. The indicator reports the suction request; no fluid clearance is measured.',
        ],
        success: 'The suction request was applied and released while the tip stayed in place.',
      },
    ),
    {
      phase: 'explain',
      title: 'Before the changed target',
      instruction:
        'Review the relationship, then try a target in a different position without the action cue.',
      lookIn: { pane: 'teaching', landmark: 'Connect the movements' },
      actionLabel: 'Try a changed target',
      interaction: { kind: 'read' },
      workspace: { kind: 'scope', view: { ...BENCH, controls: [] } },
      learn: {
        id: 'connect',
        heading: 'Connect the movements',
        support: 'orientation',
        sourceRefs: MOTIONS,
        paragraphs: [
          'Depth changes where the tip is along the bench. Deflection changes the bend; rotation changes the camera orientation and the bending plane. Choose the combination from the visible target.',
          'In a patient, keep the route visible and do not push the tip against the wall to redirect it. This bench task cannot evaluate tissue contact, grip or force.',
        ],
      },
    },
    task(
      'Try a changed target',
      'The target has moved. Decide which movements are needed to center it and reach the practice depth band. Reset if you need another attempt.',
      transferView,
      [targetGoal(transferView)],
      {
        id: 'transfer',
        heading: 'Use the new view to decide',
        support: 'transfer',
        sourceRefs: MOTIONS,
        paragraphs: [
          'The same controls are available, but you need not use every one. Decide from the target position. The goal checks the resulting view and depth, not a memorized sequence.',
        ],
        cue: 'Compare the target with the plane the lever bends in. Use only the movements needed to center it, then watch the aim as depth changes.',
        success:
          'You centered a target in a changed position and reached the practice depth band. This is a screen-based learning task; supervised physical practice remains necessary.',
      },
    ),
  ]
  // Group actual attempts into coherent concepts. The connecting explanation belongs with
  // the suction chunk; it does not need its own Continue screen or successful demo state.
  const connect = inputs.find((input) => input.learn?.id === 'connect')!.learn!
  const referenceBlocks: Readonly<Record<string, readonly string[]>> = {
    instrument: ['what-the-hands-change', 'working-position'],
    depth: ['what-to-watch'],
    rotation: ['what-each-control-changes'],
    combine: ['bench-sequence'],
    suction: ['common-errors', 'faculty-station'],
  }
  const groups: Readonly<Record<string, string>> = {
    instrument: 'Instrument orientation',
    depth: 'Depth',
    'depth-repeat': 'Depth',
    bend: 'Deflection',
    'bend-repeat': 'Deflection',
    rotation: 'Rotation',
    'rotation-repeat': 'Rotation',
    combine: 'Combined aiming',
    check: 'Combined aiming',
    suction: 'Suction',
    'suction-repeat': 'Suction',
    transfer: 'Changed target',
  }
  return inputs
    .filter((input) => input.learn?.id !== 'connect')
    .map((input) => {
      const unit = input.learn!
      return {
        ...input,
        learn:
          unit.id === 'suction'
            ? { ...unit, paragraphs: [...unit.paragraphs, ...connect.paragraphs] }
            : unit,
        course: {
          id: groups[unit.id],
          title: groups[unit.id],
          kind:
            unit.support === 'check'
              ? 'check'
              : unit.support === 'transfer'
                ? 'transfer'
                : input.interaction.kind === 'read'
                  ? 'teach'
                  : 'practice',
          presentation: unit.orientation
            ? 'illustrated'
            : unit.support === 'check'
              ? 'case'
              : 'skill',
          blocks: referenceBlocks[unit.id] ?? [],
          visual: unit.orientation ? 'instrument' : 'none',
        },
      }
    })
}
