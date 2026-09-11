import {
  stageStepLocationErrors,
  type StageStepBase,
} from '@/features/learning-module/stage/stageModel'
import { makeExercise } from './phantoms'
import type { Lesson } from './types'

export const BASE_PATH = '/learn/anatomy/branch-tracing'
export const VERSION = 'c1-a1-r1'
export const SOURCE = {
  title: 'Kurimoto & Morita. Bronchial Branch Tracing (2020)',
  url: 'https://doi.org/10.1007/978-981-13-9905-3',
}
export const LESSON_STEPS: StageStepBase<string>[] = [
  {
    id: 'orientation',
    ordinal: 1,
    phase: 'recognize',
    title: 'Read a worked example',
    instruction:
      'Read the example and match its course to the patient axes. This demonstration carries no score.',
    lookIn: { pane: 'teaching', landmark: 'Worked example' },
    actionLabel: 'Try a new branch',
    interaction: 'read',
    gate: 'open',
  },
  {
    id: 'prediction',
    ordinal: 2,
    phase: 'predict',
    title: 'Trace the next branch',
    instruction:
      'Browse neighboring axial planes. Select a daughter branch from the supplied evidence.',
    lookIn: { pane: 'simulator', landmark: 'Axial tracing stack' },
    actionLabel: 'Record branch choice',
    interaction: 'choose',
    gate: 'open',
  },
  {
    id: 'map',
    ordinal: 3,
    phase: 'act',
    title: 'Draw the opening arrangement',
    instruction: 'Place each daughter opening in the stated parent view.',
    lookIn: { pane: 'steps', landmark: 'Your opening map' },
    actionLabel: 'Submit opening map',
    interaction: 'map',
    gate: 'after-prediction',
  },
  {
    id: 'comparison',
    ordinal: 4,
    phase: 'observe',
    title: 'Compare the two views',
    instruction:
      'Compare your branch choice and opening map with the reference. Your original choice remains recorded.',
    lookIn: { pane: 'simulator', landmark: 'Reference comparison' },
    actionLabel: 'Read the explanation',
    interaction: 'observe',
    gate: 'after-prediction',
  },
  {
    id: 'reasoning',
    ordinal: 5,
    phase: 'explain',
    title: 'Explain the relationship',
    instruction:
      'Review the feedback for your choice. Separate patient direction from position on the image.',
    lookIn: { pane: 'teaching', landmark: 'Why this branch' },
    actionLabel: 'Apply it to a changed view',
    interaction: 'explain',
    gate: 'after-prediction',
  },
  {
    id: 'transfer',
    ordinal: 6,
    phase: 'transfer',
    title: 'Trace a changed arrangement',
    instruction:
      'This is a new geometric arrangement. Trace a branch and construct its opening map before viewing feedback.',
    lookIn: {
      pane: 'simulator',
      landmark: 'Axial tracing stack',
      alsoPane: 'steps',
      alsoLandmark: 'Your opening map',
    },
    actionLabel: 'Submit new interpretation',
    interaction: 'transfer',
    gate: 'after-prediction',
  },
]

// The horizontal–vertical lesson was exercised through the real renderer before expansion.
const horizontalVertical: Lesson = {
  id: 'horizontal-vertical',
  title: 'Horizontal–vertical pattern',
  minutes: 6,
  objective:
    'Distinguish cranial and caudal daughter branches while looking along a horizontal parent.',
  prerequisite: 'Axial orientation and a continuous parent–child airway relationship.',
  concept: 'A horizontal parent can divide toward different superior–inferior levels.',
  teaching: [
    'Follow the parent in the axial plane, then scroll through neighboring planes to establish whether each daughter courses cranially or caudally.',
    'The bronchoscopic view looks along the parent airway. Up and down on that view depend on the camera orientation; the patient directions do not change when the scope rolls.',
  ],
  checklist: [
    'Find the parent lumen.',
    'Trace each daughter through adjacent planes.',
    'State the patient direction.',
    'Apply the stated camera orientation.',
  ],
  worked:
    'In the demonstration, the selected daughter rises toward more cranial planes. With cranial at screen-up in the horizontal parent view and zero roll, its opening is above its sibling. The next exercise changes the arrangement.',
  sourcePages: 'Chapter 1, printed pp. 10–11',
  example: makeExercise('horizontal-vertical', 0),
  prediction: makeExercise('horizontal-vertical', 1),
  transfer: makeExercise('horizontal-vertical', 4),
  steps: LESSON_STEPS,
}

export const LESSONS: Lesson[] = [
  {
    id: 'orientation',
    title: 'Patient axes and the parent view',
    minutes: 5,
    objective:
      'Identify patient right and left while distinguishing an axial image from a view down an airway.',
    prerequisite: 'Basic lobar anatomy; no branch-tracing experience required.',
    concept: 'Patient axes stay fixed when the display changes.',
    teaching: [
      'Start with the entire relationship: CT shows cross-sections through the patient; the bronchoscopic view looks along a particular airway. A route map records which airways connect.',
      'On a standard axial display viewed from the feet, patient right is on screen-left and anterior is toward the top. Read the orientation letters whenever the display is rotated or reflected.',
    ],
    checklist: [
      'Read R, L, A and P.',
      'Locate the parent airway.',
      'Follow the daughter in patient space.',
      'Name the viewpoint before describing screen position.',
    ],
    worked:
      'In this demonstration, a daughter moves toward patient left. It appears on the right side of the standard axial display. The parent-view diagram uses its own stated up direction; copy the relationship, not the screen position.',
    sourcePages: 'Chapter 1, printed pp. 3–7',
    example: makeExercise('vertical', 0),
    prediction: makeExercise('vertical', 1),
    transfer: makeExercise('horizontal-horizontal', 2),
    steps: LESSON_STEPS,
  },
  {
    id: 'continuity',
    title: 'Follow one continuous lumen',
    minutes: 6,
    objective: 'Maintain one parent–daughter connection through neighboring planes.',
    prerequisite: 'Patient axes and the distinction between CT and parent-airway views.',
    concept: 'Continuity establishes a connection; proximity alone does not.',
    teaching: [
      'Begin in the parent lumen and follow it to the division. Scroll in short increments so that each next lumen can be related to the previous one.',
      'Keep the adjacent branch in your map. A nearby round lucency can belong to another airway, and an accompanying vessel does not establish an airway connection.',
    ],
    checklist: [
      'Start in a known lumen.',
      'Follow through adjacent planes.',
      'Identify the shared division.',
      'Retain the sibling branch as a landmark.',
    ],
    worked:
      'The parent in the example continues into two daughters at the same junction. Follow each daughter away from that division before assigning the target. The exterior comparison is a check on the same mathematical geometry.',
    sourcePages: 'Chapter 1, printed pp. 4, 15–18',
    example: makeExercise('vertical', 2),
    prediction: makeExercise('horizontal-oblique', 0),
    transfer: makeExercise('vertical', 3),
    steps: LESSON_STEPS,
  },
  {
    id: 'vertical',
    title: 'Vertical pattern',
    minutes: 5,
    objective: 'Relate a near-vertical parent on axial CT to its daughter openings.',
    prerequisite: 'Patient axes and continuous parent–child tracing.',
    concept: 'A near-vertical airway intersects successive axial planes as a compact lumen.',
    teaching: [
      'When the airway runs nearly perpendicular to the axial plane, follow the compact lumen from one level to the next. The division becomes apparent as connected daughter lumens separate.',
      'Predict the opening arrangement from the direction along the parent. Even in a simple vertical example, a rolled camera can change the apparent clock positions.',
    ],
    checklist: [
      'Find the near-vertical parent.',
      'Identify the separating lumens.',
      'Trace each daughter.',
      'Apply the stated parent-view orientation.',
    ],
    worked:
      'Scroll from the single proximal lumen toward the division. The daughter lumens separate laterally in this original phantom. Their connection to the parent is unchanged when the external model is rotated.',
    sourcePages: 'Chapter 1, printed pp. 7–9',
    example: makeExercise('vertical', 3),
    prediction: makeExercise('vertical', 2),
    transfer: makeExercise('vertical', 5),
    steps: LESSON_STEPS,
  },
  {
    id: 'horizontal-horizontal',
    title: 'Horizontal–horizontal pattern',
    minutes: 6,
    objective:
      'Reconstruct daughter openings when parent and daughters course near the axial plane.',
    prerequisite: 'Lumen continuity and the vertical tracing pattern.',
    concept: 'Looking along a horizontal parent requires a change in viewpoint.',
    teaching: [
      'A horizontal parent and its horizontal daughters can remain visible within a narrow set of axial planes. The CT depiction is a view across those airways, not a view into the parent opening.',
      'Mentally move the viewpoint along the parent before drawing the daughter arrangement. Copying the apparent shape of the axial division can reverse the intended opening relationship.',
    ],
    checklist: [
      'Establish the parent direction.',
      'Trace the in-plane daughters.',
      'Look along the parent.',
      'Place the openings in that view.',
    ],
    worked:
      'The example is viewed along a parent directed anteriorly. The daughters separate to patient right and left. Compare their positions only after specifying which direction is up in the parent view.',
    sourcePages: 'Chapter 1, printed pp. 8–10',
    example: makeExercise('horizontal-horizontal', 0),
    prediction: makeExercise('horizontal-horizontal', 3),
    transfer: makeExercise('horizontal-horizontal', 4),
    steps: LESSON_STEPS,
  },
  horizontalVertical,
  {
    id: 'horizontal-oblique',
    title: 'Horizontal–oblique pattern',
    minutes: 6,
    objective:
      'Use both in-plane course and changing axial level to distinguish oblique daughter branches.',
    prerequisite: 'Horizontal–horizontal and horizontal–vertical relationships.',
    concept: 'An oblique daughter changes both in-plane position and axial level.',
    teaching: [
      'Follow the daughter in two ways: where it moves within each axial plane, and how it changes level as you scroll. One isolated image cannot show the full course.',
      'Use a neighboring branch as a second landmark. State whether the course approaches or moves away from that landmark, then translate the relationship into the stated parent view.',
    ],
    checklist: [
      'Find the horizontal parent.',
      'Follow the in-plane displacement.',
      'Check the change in axial level.',
      'Compare the daughter with its neighbor.',
    ],
    worked:
      'One daughter in the example moves laterally and cranially, while its sibling moves to the opposite side and caudally. The exterior view makes both components visible. The next exercise requires you to infer the course from the axial stack first.',
    sourcePages: 'Chapter 1, printed pp. 11–15',
    example: makeExercise('horizontal-oblique', 0),
    prediction: makeExercise('horizontal-oblique', 1),
    transfer: makeExercise('horizontal-oblique', 4),
    steps: LESSON_STEPS,
  },
  {
    id: 'orientation-changes',
    title: 'Scope roll and a returning branch',
    minutes: 7,
    objective: 'Maintain branch identity after camera roll or a caudal-to-cranial turn.',
    prerequisite: 'All four tracing patterns and patient-coordinate orientation.',
    concept: 'The route can change direction without changing anatomical identity.',
    teaching: [
      'A bronchoscope can turn from a caudal course toward a cranial daughter. Following the route can therefore require reversing the direction of CT scrolling.',
      'Camera roll changes screen-up. Patient cranial, caudal, right and left remain the same. Use the roll indicator and fixed reference frame before interpreting opening positions.',
      'The book describes a horizontally reversed CT display for middle lobe, lingula and lower lobes, and rotated displays for upper-lobe interpretation. These are reading conventions, not universal scope orientations. Its “left superior segment” in this context refers to the left upper division (B1+2 and B3), not left lower-lobe B6.',
    ],
    checklist: [
      'Retain the last confirmed parent.',
      'Follow the returning daughter.',
      'Reverse slice direction when needed.',
      'Recalculate the opening after roll.',
    ],
    worked:
      'The returning branch descends before turning upward in the example. A single rule such as “keep scrolling caudally” would lose it. Follow the connected course; then inspect the same parent geometry with a stated 90° roll in the next exercise.',
    sourcePages: 'Chapter 1, printed pp. 4–7, 15–17; chapter 2, pp. 56–59',
    example: makeExercise('reversal', 0),
    prediction: makeExercise('reversal', 5),
    transfer: makeExercise('horizontal-oblique', 6, 'roll'),
    steps: LESSON_STEPS,
  },
  {
    id: 'variants-limits',
    title: 'Variants and the limit of the evidence',
    minutes: 7,
    objective:
      'Preserve a nonbinary division and recognize an unresolved distal airway connection.',
    prerequisite: 'Continuity, parent-view interpretation and orientation changes.',
    concept: 'The observed topology takes priority over a memorized binary tree.',
    teaching: [
      'A division may have three daughters or share a common stem. Preserve what the images actually show in the branch map instead of forcing a two-child template.',
      'A formal bronchial name and the count of graph edges are different descriptions. Daughter-branch suffixes do not automatically add a named generation; a subsuperior bronchus designated B* is distinct from an asterisk suffix on a parent name.',
      'When the lumen becomes indistinct, mark the limit of demonstrated continuity. The course of an accompanying artery may support a hypothesis, but it does not turn an unseen connection into an observed airway.',
    ],
    checklist: [
      'Count the observed daughters.',
      'Preserve shared stems.',
      'Keep labels separate from connectivity.',
      'Mark where direct lumen evidence ends.',
    ],
    worked:
      'The example contains three daughters at one junction. Its topology has one parent and three children. None is discarded to make a binary drawing. In the later uncertainty task, visible proximal openings remain in the map while the distal connection is recorded as unresolved.',
    sourcePages: 'Chapter 1, printed pp. 1–2, 19–20; chapter 2, pp. 61, 65, 72',
    example: makeExercise('variant', 0),
    prediction: makeExercise('variant', 2),
    transfer: makeExercise('variant', 4, 'uncertainty'),
    steps: LESSON_STEPS,
  },
]

export const lessonById = (id?: string | null) => LESSONS.find((l) => l.id === id)
export function nextLesson(completed: readonly string[]) {
  return LESSONS.find((l) => !completed.includes(l.id)) ?? null
}

for (const lesson of LESSONS) {
  for (const step of lesson.steps) {
    const errors = stageStepLocationErrors(`${lesson.id}/${step.id}`, step.lookIn)
    if (errors.length) throw new Error(errors.join('; '))
  }
}
