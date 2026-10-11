import type { SourceRef } from '../../data/sources'
import { BENCH, FIVE_CONTROLS_TASKS, type FiveControlsTaskId } from '../fiveControlsBench'
import type { AuthoredChoice, BronchAct, BronchSectionDefinition } from '../types'

/**
 * Driving the scope (rewrite, brief 4). The fellow learns the grip, where to stand and how the
 * image follows from it, what each control changes, and the order that enters an opening: rotate,
 * bend, then advance with the lumen centered. Each control is practised on the bench, once with a
 * demonstration and a cue and once without. The technique teaching of `branch-entry` (entering an
 * opening, coming back, a turn that does not reach the tip) is here; its airway tasks move to
 * section 5.
 *
 * The lesson is built from this file's blocks and activities by `fiveControlsLearn.ts`: each bench
 * unit shows one block and runs one activity.
 *
 * Sources: the course textbook (S1), the training manual (S2), the faculty manual (S3) and the
 * lectures on handling the instrument (T10, T11).
 */
const S1_MOTIONS: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 93 } }
const S1_98: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 98, to: 99 } }
const S2_44: SourceRef = { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } }
const S2_106: SourceRef = { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106, to: 107 } }
const S1_SETUP: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 90 } }
const S3_80: SourceRef = { sourceId: 'S3', location: { kind: 'pdf-pages', from: 80 } }
const T10_MOTIONS: SourceRef = {
  sourceId: 'T10',
  location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' },
}
const T11_COACHING: SourceRef = {
  sourceId: 'T11',
  location: { kind: 'time-span', start: '00:01:47', end: '00:05:01' },
}
const HANDS = [S1_SETUP, S1_98, S2_106, S3_80] as const
const MOTIONS = [S1_MOTIONS, S2_44, S2_106] as const
const ENTRY = [S1_MOTIONS, S2_44, T10_MOTIONS, T11_COACHING] as const

const task = (id: FiveControlsTaskId, outcomeId: string): BronchAct => ({
  kind: 'scope-lab',
  outcomeId,
  view: FIVE_CONTROLS_TASKS[id].view,
  goals: FIVE_CONTROLS_TASKS[id].goals,
})

const choices = (
  labels: readonly [string, string, string, string],
  rationales: readonly [string, string, string, string],
  unsafe?: 'b' | 'c' | 'd',
): AuthoredChoice[] =>
  (['a', 'b', 'c', 'd'] as const).map((id, index) => ({
    id,
    label: labels[index],
    rationale: rationales[index],
    plausibility: index === 0 ? 'best' : id === unsafe ? 'unsafe' : 'incorrect-mechanism',
  }))

export const section: BronchSectionDefinition = {
  id: 'five-controls',
  authoringContract: 2,
  title: 'Driving the scope',
  shortTitle: 'Driving the scope',
  minutes: 12,
  activityMinutes: 7,
  moduleIds: ['M05'],
  objectives: [
    {
      objectiveId: 'M05-O1',
      subtask: 'Holds the scope and stands so that the wrist, not the feet, turns it.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M05-O2',
      subtask: 'Uses each control on the bench and says what it changes in the image.',
      evidence: 'observed-physical-skill-required',
    },
  ],
  drillIds: ['D02', 'D16'],
  prerequisites: ['sedation-and-monitoring', 'pre-use-check'],

  clinicalQuestion: 'How do you make the tip go where you are looking?',
  objective:
    'Use each control of the scope, and enter an opening by rotating, bending and then advancing.',
  harmfulReflex: 'Advancing before the lumen is centered. Aim first, then move.',
  harmfulReflexPatterns: [/\badvanc/i],
  anchor: {
    analogy:
      'Driving the scope is threading a needle at arm’s length. You line the thread up first. Only then do you push.',
    precise:
      'Rotate to put the opening in the bending plane, bend to center its lumen, and only then advance.',
    checklistLabel: 'Before every movement',
    checklist: [
      'Tube straight between your hands',
      'Rotate, then bend',
      'Lumen centered before you advance',
      'Bend released before you withdraw',
    ],
  },
  outcomes: [
    { id: 'use-controls', text: 'Use each control of the scope and say what it changes.' },
    {
      id: 'aim-and-enter',
      text: 'Aim at an opening by rotating and bending, and advance only with the lumen centered.',
    },
  ],

  spineStops: [],
  grammarRowIds: [],
  precommitDenyPatterns: [/lens and the bending section/i, /\bturn together\b/i],
  localPolicyIds: ['scope_ifu'],
  reviewItemIds: ['R03'],

  blocks: [
    {
      id: 'grip',
      kind: 'pattern',
      role: 'framing',
      heading: 'What each hand does',
      body: 'Hold the control section in your left hand. Your thumb rests on the lever and your index finger on the suction valve.\n\nYour right hand holds the insertion tube near the nose or the bite block. It moves the scope in and out, and nothing else.\n\nKeep the insertion tube straight between your hands. A loop soaks up rotation, and the tip stops answering the handle.',
      claimClass: 'source',
      sourceRefs: HANDS,
      reviewItemIds: ['R03'],
    },
    {
      id: 'stance',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Where you stand',
      body: 'Stand at the head of the bed, with the screen straight ahead. Hold the scope so the membranous wall sits at 6 o’clock. The patient’s right is then on your right.\n\nIf you face the patient instead, left and right swap on the screen. Know which way you are standing before you name a side.\n\nSet the bed so your shoulders are relaxed. Turn the scope from your wrist, not by walking around the bed.',
      claimClass: 'synthesis',
      sourceRefs: HANDS,
      reviewItemIds: ['R03'],
    },
    {
      id: 'depth',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Depth changes the distance',
      body: 'Your right hand advances and withdraws the scope. The view gets closer or further away. The direction the tip faces does not change.\n\nIn an airway, advance in small steps, and only toward lumen you can see.',
      claimClass: 'source',
      sourceRefs: MOTIONS,
    },
    {
      id: 'bend',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'The lever bends the tip',
      body: 'Your thumb moves the lever, and the tip bends up or down in the image. It bends in one plane only. It cannot bend left or right.\n\nPush the lever down and the tip bends up. Let go and the tip straightens.',
      claimClass: 'source',
      sourceRefs: MOTIONS,
    },
    {
      id: 'rotation',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Rotation turns the camera and the bending plane',
      body: 'Turn your left wrist and the whole scope turns. The image rotates, and the plane the tip bends in rotates with it.\n\nThis is how you reach an opening off to one side. Rotate until it sits at the top or bottom of the image, then bend toward it.\n\nUp on the screen is not a fixed direction in the patient. Find a landmark to tell you which way you are facing.',
      claimClass: 'source',
      sourceRefs: MOTIONS,
    },
    {
      id: 'combine',
      kind: 'pattern',
      role: 'worked-example',
      heading: 'Rotate, bend, then advance',
      body: 'To enter an opening, do three things in order. Rotate to bring it into the bending plane. Bend until its lumen is in the center of the image.\n\nThen advance, keeping the lumen in the center. An opening already above or below you needs no rotation.\n\nNever advance toward a wall to find the way. If the lumen is not centered, stop and aim again.',
      claimClass: 'source',
      sourceRefs: ENTRY,
    },
    {
      id: 'suction',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Suction does not steer',
      body: 'Your index finger presses the suction valve. It clears the view and does nothing else. The tip stays where it is.\n\nSuction in short bursts, with the lumen in view. Held against the wall, suction pulls mucosa onto the tip.',
      claimClass: 'source',
      sourceRefs: MOTIONS,
    },
    {
      id: 'in-the-airway',
      kind: 'pattern',
      role: 'worked-example',
      heading: 'Into an opening, and back',
      body: 'Name the opening you want before you move. Stop short of it, with the opening in view. Then rotate, bend and advance along the lumen, easing the bend off as the airway straightens.\n\nComing back, release the bend before you withdraw. A bent tip pulled backward catches on the wall.\n\nIf the handle turns and the image does not, the turn is being lost. Loosen your grip on the insertion tube and straighten it.',
      media: {
        kind: 'scope-photo',
        imageId: 'full-scope',
        highlight: 'full-scope-insertion-tube-4',
      },
      claimClass: 'transcript-source',
      sourceRefs: ENTRY,
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Six errors to expect',
      body: 'Each one moves the scope before the view says where to go.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Advancing before the lumen is centered. Aim first.',
        'Bending harder when the opening is off to the side. Rotate it into the plane.',
        'Twisting against a gripped or looped tube. Loosen, straighten, then try a small turn.',
        'Withdrawing with the bend still on. Release the lever first.',
        'Walking around the bed to steer. Turn your wrist.',
        'Steering with suction. It only clears the view.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [...MOTIONS, T10_MOTIONS, T11_COACHING],
      reviewItemIds: ['R03'],
    },
  ],

  workspace: { kind: 'scope', view: BENCH },

  // The rotation task is the section's first-named activity; the others are run by name.
  act: task('rotation', 'use-controls'),
  moreActs: {
    depth: task('depth', 'use-controls'),
    'depth-repeat': task('depth-repeat', 'use-controls'),
    bend: task('bend', 'use-controls'),
    'bend-repeat': task('bend-repeat', 'use-controls'),
    'rotation-repeat': task('rotation-repeat', 'use-controls'),
    combine: task('combine', 'aim-and-enter'),
    suction: task('suction', 'use-controls'),
    'suction-repeat': task('suction-repeat', 'use-controls'),
    'changed-target': task('transfer', 'aim-and-enter'),
  },

  prediction: {
    id: 'N03',
    itemType: 'mechanism-interpretation',
    situation:
      'The tip of the scope is straight and resting on a bench. You hold the depth still and turn the control section a quarter turn clockwise.',
    stem: 'What changes?',
    choices: choices(
      [
        'The image rotates, and so does the plane the tip bends in',
        'The image rotates, but the tip still bends the same way on the bench',
        'Nothing changes until the tip is bent',
        'The bending plane turns, but the image stays upright',
      ],
      [
        'The camera and the bending section are both in the tip. Turn the scope and both turn by the same amount.',
        'The bending section turns with the camera. The lever now bends the tip in a new direction on the bench.',
        'A straight tip still turns on its own axis, and the camera turns with it.',
        'The camera is in the tip. When the tip turns, the image has to turn too.',
      ],
    ),
    explanation:
      'The lens and the bending section are in the same tip, so they turn together. Rotation is how you choose the direction the lever will bend.',
    objectiveIds: ['M05-O2'],
    outcomeIds: ['use-controls'],
    claimClass: 'synthesis',
    sourceRefs: MOTIONS,
  },

  transfer: {
    id: 'five-controls-transfer',
    itemType: 'management-decision',
    situation:
      'You are in the trachea of an airway model with the tip straight. A side opening sits at the bottom edge of the image, and you can see into it.',
    stem: 'What is your next movement?',
    choices: choices(
      [
        'Bend the tip down until the opening is centered',
        'Advance until you are level with the opening, then bend',
        'Rotate a quarter turn, then bend toward the opening',
        'Pause, and swing the control section down toward the floor',
      ],
      [
        'The opening is at the bottom edge, so it is already in the bending plane. Bend to center it, then go.',
        'Going forward without the lumen centered takes the tip past the opening and into the wall.',
        'Rotating moves the opening out of the bending plane. It was already where the lever could reach it.',
        'Swinging the handle moves the tube outside the patient. The tip bends only with the lever.',
      ],
      'b',
    ),
    explanation:
      'Read the image before you move. An opening at the top or bottom edge needs the lever only. One off to the side needs rotation first. Advance once the lumen is centered.',
    objectiveIds: ['M05-O2'],
    outcomeIds: ['aim-and-enter'],
    claimClass: 'synthesis',
    sourceRefs: ENTRY,
    transferVariant: 'An airway model, not the bench, and an opening that needs one control only.',
  },

  practice: [
    {
      id: 'mc-trainee-circling-bed',
      presentationTitle: 'A fellow who steers with their feet',
      situation:
        'A new fellow lifts an elbow and steps around the head of the bed each time the image needs to turn. The screen is off to one side, and their neck is twisted toward it.',
      item: {
        id: 'mc-trainee-circling-bed',
        itemType: 'management-decision',
        stem: 'What do you fix first?',
        choices: choices(
          [
            'Move the screen and the bed, then turn from the wrist',
            'Turn the screen toward where they have ended up',
            'Have them lock the elbow at a right angle',
            'Have them hold the scope in the other hand',
          ],
          [
            'The setup is forcing the posture. Put the screen straight ahead and the bed at a relaxed height, then rotate with the wrist.',
            'That fixes the neck for one position. They will still walk around the bed at the next turn.',
            'No single elbow angle suits every turn. The wrist does the turning.',
            'Either hand can hold the scope. Changing hands leaves the screen and the bed where they were.',
          ],
        ),
        explanation:
          'Set up so that the screen is straight ahead and your shoulders are relaxed. Then the scope turns from your wrist and you stay where you are.',
        objectiveIds: ['M05-O1'],
        outcomeIds: ['use-controls'],
        claimClass: 'synthesis',
        sourceRefs: HANDS,
        reviewItemIds: ['R03'],
      },
    },
  ],
}
