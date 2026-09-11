import {
  stageStepLocationErrors,
  type StageStepBase,
} from '@/features/learning-module/stage/stageModel'
import type { CtLesson } from './ct-types'

export const BASE_PATH = '/learn/anatomy/branch-tracing'
export const VERSION = 'c2-ct1-r2'
export const SOURCE = {
  title: 'Kurimoto & Morita. Bronchial Branch Tracing (2020)',
  url: 'https://doi.org/10.1007/978-981-13-9905-3',
}
export const LESSON_STEPS: StageStepBase<string>[] = [
  {
    id: 'orientation',
    ordinal: 1,
    phase: 'recognize',
    title: 'Orient to the CT',
    instruction:
      'Read the worked example. Scroll through its CT levels and identify the parent airway before starting your own trace.',
    lookIn: { pane: 'teaching', landmark: 'Worked CT example' },
    actionLabel: 'Trace this airway',
    interaction: 'read',
    gate: 'open',
  },
  {
    id: 'prediction',
    ordinal: 2,
    phase: 'predict',
    title: 'Follow the lumen',
    instruction:
      'At each of the three trace levels, mark the lumen you believe continues from the starting airway. Browse neighboring slices to establish continuity.',
    lookIn: { pane: 'simulator', landmark: 'CT tracing stack' },
    actionLabel: 'Record trace',
    interaction: 'choose',
    gate: 'open',
  },
  {
    id: 'map',
    ordinal: 3,
    phase: 'act',
    title: 'Describe its course',
    instruction:
      'Review your three marked levels and record how this airway continues in patient space.',
    lookIn: { pane: 'steps', landmark: 'Your branch map' },
    actionLabel: 'Reveal CT comparison',
    interaction: 'map',
    gate: 'after-prediction',
  },
  {
    id: 'comparison',
    ordinal: 4,
    phase: 'observe',
    title: 'Compare on the CT',
    instruction:
      'Compare your marks with the source-derived trace. Use adjacent slices to resolve a difference rather than following a point in isolation.',
    lookIn: { pane: 'simulator', landmark: 'CT tracing stack' },
    actionLabel: 'Review the relationship',
    interaction: 'observe',
    gate: 'after-prediction',
  },
  {
    id: 'reasoning',
    ordinal: 5,
    phase: 'explain',
    title: 'Relate the two views',
    instruction:
      'Explain to yourself how the airway course affects the view from its parent. Keep patient direction separate from the display orientation.',
    lookIn: { pane: 'teaching', landmark: 'Reading this airway' },
    actionLabel: 'Trace another airway',
    interaction: 'explain',
    gate: 'after-prediction',
  },
  {
    id: 'transfer',
    ordinal: 6,
    phase: 'transfer',
    title: 'Apply it to another trace',
    instruction:
      'Trace this different airway on the real CT. Place three lumen marks and describe the course before opening the comparison.',
    lookIn: {
      pane: 'simulator',
      landmark: 'CT tracing stack',
      alsoPane: 'steps',
      alsoLandmark: 'Your branch map',
    },
    actionLabel: 'Compare new trace',
    interaction: 'transfer',
    gate: 'after-prediction',
  },
]

export const LESSONS: CtLesson[] = [
  {
    id: 'orientation',
    title: 'Orient the CT for branch tracing',
    minutes: 5,
    objective:
      'Change from standard axial display to the tracing view while preserving patient right and left.',
    prerequisite: 'Recognize the trachea and main bronchi on axial CT.',
    concept: 'Orient the image before interpreting an opening.',
    teaching: [
      'Start in the central airway and identify R, L, A and P. In standard axial viewing, the image is seen from the feet. Patient right is on screen-left.',
      'For caudal tracing in the middle lobe, lingula and lower lobes, the book reflects the image left-to-right. For the right upper lobe it rotates standard axial images 90° counterclockwise; for the left upper division, 90° clockwise. These change the display, not the patient anatomy.',
    ],
    worked:
      'This central-airway example is shown in the reflected tracing convention. Toggle Standard axial and Book tracing view: the airway moves across the screen, while its patient-space location and CT level stay the same.',
    interpretation:
      'A left/right reflection changes the displayed branch positions. The R and L labels move with the anatomy. Following the same lumen through adjacent levels is the check that branch identity has been preserved.',
    transferPrompt:
      'Now follow a right-upper-lobe trace. Compare its 90° counterclockwise view with standard axial before marking the lumen.',
    sourcePages: 'Chapter 1, pp. 4–8; Figs. 1.5–1.12',
    example: 'central-right',
    prediction: 'central-left',
    transfer: 'right-upper-entry',
    steps: LESSON_STEPS,
  },
  {
    id: 'continuity',
    title: 'Follow the airway through adjacent slices',
    minutes: 6,
    objective: 'Maintain one lumen across a branch point instead of switching to a nearby airway.',
    prerequisite: 'Patient axes and the three tracing display conventions.',
    concept: 'A branch connection is established by continuity, not proximity.',
    teaching: [
      'Begin at the outlined parent lumen. Move through adjacent slices in small increments and keep its walls in view. At the division, follow each candidate far enough to understand its course.',
      'The three trace levels are checkpoints, not the whole evidence. Use the slider, arrow buttons or mouse wheel to inspect every intervening 0.5 mm plane. A nearby vessel or another airway is not proof of a connection.',
    ],
    worked:
      'In the right-upper-lobe example, the route first descends in the right main bronchus and then turns cranially. The slice order can reverse along a continuous route.',
    interpretation:
      'Review where your trace diverges from the parent. Return to the last level where the lumen is clear, then advance one slice at a time. Keep the neighboring bronchus as a landmark rather than jumping to the nearest round lucency.',
    transferPrompt:
      'Continue from the bronchus intermedius into an anterior branch. Follow its walls rather than relying on how close the next lucency appears.',
    sourcePages: 'Chapter 1, pp. 4, 15–18',
    example: 'right-upper-entry',
    prediction: 'central-right',
    transfer: 'middle-lobe-entry',
    steps: LESSON_STEPS,
  },
  {
    id: 'vertical',
    title: 'Read a vertical airway on real CT',
    minutes: 6,
    objective:
      'Follow a predominantly craniocaudal airway and recognize its changing lumen across axial planes.',
    prerequisite: 'Continuous parent-to-daughter tracing.',
    concept: 'A vertical airway crosses successive axial planes as a compact lumen.',
    teaching: [
      'When a bronchus runs close to perpendicular to the axial plane, its lumen appears on successive CT levels. Track that lumen until the division separates into daughter airways.',
      'In the book’s vertical pattern, the spur angle seen on the correctly oriented CT can guide the branch diagram. First confirm the airway direction and display convention; a screen clock position is not a fixed anatomical name.',
    ],
    worked:
      'The upper-lobe example advances toward more cranial levels. Scroll through the stack to see the lumen move and divide, with the right chest wall at the bottom of the rotated view.',
    interpretation:
      'Compare the change in CT level with the smaller in-plane displacement. Then inspect the bifurcation through neighboring slices. The vertical pattern describes the local course; an entire route can contain several different patterns.',
    transferPrompt:
      'Trace a lower-lobe airway that descends through successive planes. Its reflected display differs from the upper-lobe view.',
    sourcePages: 'Chapter 1, pp. 7–9; Figs. 1.12–1.13',
    example: 'right-upper-apical',
    prediction: 'right-upper-distal',
    transfer: 'right-lower-basal',
    steps: LESSON_STEPS,
  },
  {
    id: 'horizontal-horizontal',
    title: 'Follow a horizontal branch',
    minutes: 6,
    objective:
      'Recognize an airway that travels mainly within the axial plane and interpret it from its parent.',
    prerequisite: 'Vertical tracing and the distinction between image and patient directions.',
    concept: 'A long in-plane lumen needs a change in viewpoint.',
    teaching: [
      'A horizontal airway can travel a considerable distance while remaining within a narrow range of axial levels. Follow the elongated lumen across the image, and confirm the connection in neighboring slices.',
      'For a horizontal–horizontal division, reconstruct the relationship as seen along the parent airway. Copying the Y shape of the axial image directly into a bronchoscopic opening map can reverse the intended relationship.',
    ],
    worked:
      'The middle-lobe example extends anteriorly while changing CT level only slightly. Several trace points may lie on the same acquisition plane because the airway is almost horizontal.',
    interpretation:
      'Look at the in-plane distance between your marked lumens and their small difference in CT level. The source-derived trace is a comparison aid; inspect the actual air column before accepting its path.',
    transferPrompt:
      'Trace an upper-lobe branch in the counterclockwise view. Separate the display rotation from the airway’s local course.',
    sourcePages: 'Chapter 1, pp. 8–10; Figs. 1.14–1.16',
    example: 'middle-lobe-entry',
    prediction: 'middle-lobe-lateral',
    transfer: 'upper-oblique-medial',
    steps: LESSON_STEPS,
  },
  {
    id: 'horizontal-vertical',
    title: 'Find the cranial and caudal continuations',
    minutes: 6,
    objective: 'Use neighboring CT levels to distinguish a cranial continuation from a caudal one.',
    prerequisite: 'Following a horizontal parent lumen.',
    concept: 'The daughter’s change in level resolves a horizontal–vertical relationship.',
    teaching: [
      'Locate the horizontal parent first. At its distal division, compare the daughter airways above and below the junction. A single axial frame cannot establish both courses.',
      'Viewed along a horizontal parent, cranial and caudal daughters can form an up–down relationship. The direction called screen-up still depends on the stated viewing orientation.',
    ],
    worked:
      'The worked middle-lobe trace follows one continuation beyond a nearly horizontal parent. Compare its final level with the parent level, then return to the junction to look for the other continuation.',
    interpretation:
      'The reference follows the caudal continuation in this local example. A neighboring cranial continuation appears at higher levels. Review the source lumen before assigning a subsegmental name; graph depth alone does not supply that name.',
    transferPrompt:
      'Return to the same parent and follow the other continuation. This is deliberate comparison within one CT, not a new patient assessment.',
    sourcePages: 'Chapter 1, pp. 10–11; Fig. 1.17',
    example: 'middle-lobe-entry',
    prediction: 'middle-lobe-caudal',
    transfer: 'middle-lobe-cranial',
    steps: LESSON_STEPS,
  },
  {
    id: 'horizontal-oblique',
    title: 'Trace an oblique daughter airway',
    minutes: 6,
    objective: 'Combine in-plane movement and changing CT level to follow an oblique daughter.',
    prerequisite: 'Horizontal and vertical airway relationships.',
    concept: 'An oblique branch moves across the image and through the stack.',
    teaching: [
      'An oblique daughter leaves a horizontal parent with both in-plane and craniocaudal motion. Inspect successive levels while retaining the parent and the adjacent branch as landmarks.',
      'The book emphasizes whether the traced airway approaches or moves away from a neighboring branch. A single fixed clock label does not describe that three-dimensional relationship.',
    ],
    worked:
      'In this upper-lobe example, the lumen changes level as it advances laterally. The right-upper-lobe display is already rotated 90° counterclockwise, so read the patient labels before interpreting the movement.',
    interpretation:
      'Follow the marked continuation both laterally and cranially through the stack. Compare it with the neighboring continuation rather than projecting the entire route onto one axial image.',
    transferPrompt:
      'Trace a left-upper-division airway using the opposite display rotation. Re-establish the patient directions before drawing the route.',
    sourcePages: 'Chapter 1, pp. 11–15; Figs. 1.18–1.23',
    example: 'upper-oblique-medial',
    prediction: 'upper-oblique-lateral',
    transfer: 'left-upper-anterior',
    steps: LESSON_STEPS,
  },
  {
    id: 'orientation-changes',
    title: 'Handle a change in tracing direction',
    minutes: 7,
    objective: 'Maintain airway identity when the route turns from caudal toward cranial levels.',
    prerequisite: 'The three book display conventions and continuous tracing.',
    concept: 'The slice direction can reverse without changing the airway connection.',
    teaching: [
      'A route can descend and then turn cranially. Do not force every distal step to move toward a lower slice number. Follow the lumen from the last certain connection.',
      'For the left upper division, the book rotates axial images clockwise by 90°. Its term “left superior segment” in this discussion refers to the upper division, not the lower-lobe superior segment. A lower-lobe returning route still uses the lower-lobe reflection convention.',
    ],
    worked:
      'Follow the left-upper-division example in its clockwise view. The direction labels rotate with the image, while cranial and caudal remain defined by the CT level.',
    interpretation:
      'This lower-lobe route initially descends and then returns toward more cranial levels. A reversed slice order is expected along that path. The book also illustrates a rotated coronal MPR as a supporting check; the axial continuity remains the primary task here.',
    transferPrompt:
      'Follow the right main bronchus toward an upper-lobe branch and find the point where the slice direction reverses.',
    sourcePages: 'Chapter 1, pp. 5–8, 15–17; Figs. 1.24–1.26',
    example: 'left-upper-division',
    prediction: 'left-lower-returning',
    transfer: 'right-upper-entry',
    steps: LESSON_STEPS,
  },
  {
    id: 'variants-limits',
    title: 'Build and check a complete CT trace',
    minutes: 7,
    objective:
      'Record a continuous route and explicitly identify any level where the lumen cannot be resolved.',
    prerequisite: 'All four patterns and the display conventions.',
    concept: 'A defensible trace preserves uncertainty.',
    teaching: [
      'Apply the same sequence to each junction: identify the parent, follow its lumen, inspect the next division, and draw the relationship from the parent viewpoint. Preserve siblings and common stems rather than forcing every division into two identical branches.',
      'If the air column cannot be resolved, record that uncertainty. A nearby vessel or a centerline is supporting context, not confirmation of a patent airway. The book distinguishes a lateral daughter-branch asterisk from a subsuperior bronchus; neither should be inferred from this graph.',
    ],
    worked:
      'The basal example provides a longer caudal trace. Check each interval between the three levels; do not treat the three marked points as sufficient proof of continuity.',
    interpretation:
      'Compare your route one level at a time. If you marked uncertainty, revisit that interval and state what remains unresolved. This preview uses one source CT and does not establish performance on a new patient.',
    transferPrompt:
      'Trace another lobar route and decide whether the lumen is adequately visible at every level. Record uncertainty when the source image does not resolve it.',
    sourcePages: 'Chapter 1, pp. 1–4, 15–18',
    example: 'right-lower-basal',
    prediction: 'left-lower-basal',
    transfer: 'left-lingula',
    steps: LESSON_STEPS,
  },
]
export const lessonById = (id?: string) => LESSONS.find((l) => l.id === id)
export const nextLesson = (completed: string[]) =>
  LESSONS.find((l) => !completed.includes(l.id)) ?? null
export function lessonLocationErrors() {
  return LESSONS.flatMap((l) =>
    l.steps.flatMap((s) => stageStepLocationErrors(`${l.id}.${s.id}`, s.lookIn)),
  )
}
