import {
  stageStepLocationErrors,
  type StageStepBase,
} from '@/features/learning-module/stage/stageModel'
import type { CtLesson, LocalExerciseSpec } from './ct-types'

export const BASE_PATH = '/learn/anatomy/branch-tracing'
export const VERSION = 'c6-local-teaching-r1'
// Only this new activity changes completion semantics; historic participation stays intact.
export const ORIENTATION_CONTRACT = 'observer-comparison-r2'
export const SOURCE = {
  title: 'Kurimoto & Morita. Bronchial Branch Tracing (2020)',
  url: 'https://doi.org/10.1007/978-981-13-9905-3',
}
// Self-paced (BBT-01): no step waits on an answer, a recorded trace or a correct branch.
export const LESSON_STEPS: StageStepBase<string>[] = [
  {
    id: 'orientation',
    ordinal: 1,
    phase: 'recognize',
    title: 'Orient to the CT',
    instruction:
      'Follow the visual explanation of rotation and reflection. Try the controls beside the paired CT and virtual bronchoscopy, then inspect the worked trace toward the nodule.',
    lookIn: { pane: 'teaching', landmark: 'Turn the CT into the tracing convention' },
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
      'Follow the airway toward the nodule in the named segment. At every junction, choose the daughter branch and mark its lumen, or show the reference first. Record the junction to compare it, or continue without recording.',
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
      'Review your marked airway points, describe the course, then inspect the distal airway–nodule relationship using Show target and adjacent slices.',
    lookIn: { pane: 'steps', landmark: 'Route checkpoints' },
    actionLabel: 'Reveal CT comparison',
    interaction: 'map',
    gate: 'open',
  },
  {
    id: 'comparison',
    ordinal: 4,
    phase: 'observe',
    title: 'Compare on the CT',
    instruction:
      'Compare your marks with the model reference trace. Use adjacent slices to resolve a difference rather than following a point in isolation.',
    lookIn: { pane: 'simulator', landmark: 'CT tracing stack' },
    actionLabel: 'Review the relationship',
    interaction: 'observe',
    gate: 'open',
  },
  {
    id: 'reasoning',
    ordinal: 5,
    phase: 'explain',
    title: 'Relate the two views',
    instruction:
      'Explain how the airway course affects the view from its parent. State what supports an approach to the nodule and where continuity remains uncertain.',
    lookIn: { pane: 'teaching', landmark: 'Reading this airway' },
    actionLabel: 'Trace another airway',
    interaction: 'explain',
    gate: 'open',
  },
  {
    id: 'transfer',
    ordinal: 6,
    phase: 'transfer',
    title: 'Apply it to another trace',
    instruction:
      'Plan a route to this new nodule target. Work through the junctions from the trachea, then mark the distal approach and describe its course and relationship to the nodule.',
    lookIn: {
      pane: 'simulator',
      landmark: 'CT tracing stack',
      alsoPane: 'steps',
      alsoLandmark: 'Route checkpoints',
    },
    actionLabel: 'Compare new trace',
    interaction: 'transfer',
    gate: 'open',
  },
]

const ROUTE_LESSONS: CtLesson[] = [
  {
    id: 'orientation',
    title: 'Orient the CT for branch tracing',
    minutes: 9,
    objective:
      'Change from standard axial display to the tracing view while preserving patient right and left.',
    prerequisite: 'Recognize the trachea and main bronchi on axial CT.',
    concept: 'Orient the image before interpreting an opening.',
    teaching: [
      'Start in the central airway and identify R, L, A and P. In standard axial viewing, the image is seen from the feet. Patient right is on screen-left.',
      'For caudal tracing in the middle lobe, lingula and lower lobes, the book reflects the image left-to-right. For the right upper lobe it rotates standard axial images 90° counterclockwise; for the left upper division, 90° clockwise. These change the display, not the patient anatomy.',
    ],
    worked:
      'This central-airway example starts in standard axial. Use Flip left–right, then Return to standard axial: the airway moves across the screen, while its patient-space location and CT level stay the same. Compare the parent lumen with the virtual bronchoscopy beside it.',
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
    minutes: 10,
    objective: 'Maintain one lumen across a branch point instead of switching to a nearby airway.',
    prerequisite: 'Patient axes and the three tracing display conventions.',
    concept: 'A branch connection is established by continuity, not proximity.',
    teaching: [
      'Begin at the outlined parent lumen. Move through adjacent slices in small increments and keep its walls in view. At the division, follow each candidate far enough to understand its course.',
      'This exercise follows one local division. Use the slider, arrow buttons or mouse wheel to inspect neighboring 0.5 mm planes. A nearby vessel or another airway is not proof of a connection.',
    ],
    worked:
      'In the right-upper-lobe example, the route first descends in the right main bronchus and then turns cranially. The slice order can reverse along a continuous route.',
    interpretation:
      'Review where your trace diverges from the parent. Return to the last level where the lumen is clear, then advance one slice at a time. Keep the neighboring bronchus as a landmark rather than jumping to the nearest round lucency.',
    transferPrompt:
      'Continue from the bronchus intermedius through RML to the medial segmental bronchus (RB5). Follow its walls rather than relying on how close the next lucency appears.',
    sourcePages: 'Chapter 1, pp. 4, 15–18',
    example: 'right-upper-entry',
    prediction: 'central-right',
    transfer: 'middle-lobe-entry',
    steps: LESSON_STEPS,
  },
  {
    id: 'vertical',
    title: 'Read a vertical airway on real CT',
    minutes: 10,
    objective:
      'Follow a predominantly craniocaudal airway and recognize its changing lumen across axial planes.',
    prerequisite: 'Continuous parent-to-daughter tracing.',
    concept: 'A vertical airway crosses successive axial planes as a compact lumen.',
    teaching: [
      'When a bronchus runs close to perpendicular to the axial plane, its lumen appears on successive CT levels. Track that lumen until the division separates into daughter airways.',
      'In the book’s vertical pattern, the spur angle seen on the correctly oriented CT can guide the branch diagram. First confirm the airway direction and display convention; a screen clock position is not a fixed anatomical name.',
    ],
    worked:
      'The upper-lobe example follows the apical bronchus (RB1) into its anterior subsegment (RB1b), advancing toward more cranial slices. Scroll through the stack to see the lumen move and divide, with the right chest wall at the bottom of the rotated view.',
    interpretation:
      'Compare the change in CT level with the smaller in-plane displacement. Then inspect the bifurcation through neighboring slices. The vertical pattern describes the local course; an entire route can contain several different patterns.',
    transferPrompt:
      'Trace a lower-lobe airway that descends through successive planes. Its reflected display differs from the upper-lobe view.',
    sourcePages: 'Chapter 1, pp. 1–3, 7–9; Chapter 2, p. 27, Figs. 2.9–2.10',
    example: 'right-upper-apical',
    prediction: 'right-upper-distal',
    transfer: 'right-lower-basal',
    steps: LESSON_STEPS,
  },
  {
    id: 'horizontal-horizontal',
    title: 'Follow a horizontal branch',
    minutes: 10,
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
      'Look at the in-plane distance between your marked lumens and their small difference in CT level. The model reference trace is a comparison aid; inspect the actual air column before accepting its path.',
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
    title: 'Trace the RB5 subsegments',
    minutes: 10,
    objective: 'Follow the medial segmental bronchus into RB5a and RB5b using adjacent CT slices.',
    prerequisite: 'Following a horizontal parent lumen.',
    concept: 'The daughter’s change in level resolves a horizontal–vertical relationship.',
    teaching: [
      'Locate the horizontal parent first. At its distal division, compare the daughter airways above and below the junction. A single axial frame cannot establish both courses.',
      'Viewed along a horizontal parent, cranial and caudal daughters can form an up–down relationship. The direction called screen-up still depends on the stated viewing orientation.',
    ],
    worked:
      'Follow the bronchus intermedius (BI) into the right middle lobe bronchus (RML), then the medial segmental bronchus (RB5). RB4 is the lateral segmental bronchus at the middle-lobe division. Use this parent anatomy to locate the RB5 subsegments in your next trace.',
    interpretation:
      'This trace follows RB5 into RB5b, its caudally directed subsegment in the textbook pattern. The sibling RB5a advances more nearly horizontally and has a small cranial excursion here. The a/b suffix identifies the subsegment; a small local bend does not create a different segment.',
    transferPrompt:
      'Return to the medial segmental bronchus (RB5) and trace its other subsegment, RB5a. Inspect the intervening slices to confirm its connection and describe its course.',
    sourcePages: 'Chapter 1, pp. 1–3, 10–11; Chapter 2, pp. 45–47, Figs. 2.47–2.49',
    example: 'middle-lobe-entry',
    prediction: 'middle-lobe-caudal',
    transfer: 'middle-lobe-cranial',
    steps: LESSON_STEPS,
  },
  {
    id: 'horizontal-oblique',
    title: 'Trace an oblique daughter airway',
    minutes: 10,
    objective: 'Combine in-plane movement and changing CT level to follow an oblique daughter.',
    prerequisite: 'Horizontal and vertical airway relationships.',
    concept: 'An oblique branch moves across the image and through the stack.',
    teaching: [
      'An oblique daughter leaves a horizontal parent with both in-plane and craniocaudal motion. Inspect successive levels while retaining the parent and the adjacent branch as landmarks.',
      'The book emphasizes whether the traced airway approaches or moves away from a neighboring branch. A single fixed clock label does not describe that three-dimensional relationship.',
    ],
    worked:
      'In this upper-lobe example, the lumen changes level as it advances laterally. Start with standard axial and use Rotate 90° left for the right-upper-lobe tracing convention. Read the patient labels before interpreting the movement.',
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
    minutes: 11,
    objective: 'Maintain airway identity when the route turns from caudal toward cranial levels.',
    prerequisite: 'The three book display conventions and continuous tracing.',
    concept: 'The slice direction can reverse without changing the airway connection.',
    teaching: [
      'A route can descend and then turn cranially. Do not force every distal step to move toward a lower slice number. Follow the lumen from the last certain connection.',
      // BBTF-45: the left-upper-division convention moved, verbatim, to REGIONAL_NOTES in
      // course-guide.ts; this lesson's three divisions are LB6 in the lower lobe.
      'A lower-lobe returning route still uses the lower-lobe reflection convention.',
    ],
    worked:
      'Use Rotate 90° right, then follow the left upper division into the apicoposterior bronchus (LB1+2). The direction labels rotate with the image, while cranial and caudal remain defined by the CT level.',
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
    minutes: 11,
    objective:
      'Record a continuous route and explicitly identify any level where the lumen cannot be resolved.',
    prerequisite: 'All four patterns and the display conventions.',
    concept: 'A defensible trace preserves uncertainty.',
    teaching: [
      'Apply the same sequence to each junction: identify the parent, follow its lumen, inspect the next division, and draw the relationship from the parent viewpoint. Preserve siblings and common stems rather than forcing every division into two identical branches.',
      'If the air column cannot be resolved, record that uncertainty. A nearby vessel or a centerline is supporting context, not confirmation of a patent airway. The book distinguishes a lateral daughter-branch asterisk from a subsuperior bronchus; neither should be inferred from this graph.',
    ],
    worked:
      'The basal example provides a longer caudal trace. Work through each fork, including the distal daughters that share a segment name. Browse every interval; a mark at each fork does not by itself prove continuity through the intervening slices.',
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
const local = (
  traceId: string,
  checkpointId: string,
  kind: LocalExerciseSpec['kind'],
): LocalExerciseSpec => ({ traceId, checkpointId, kind })
const LOCAL_PLANS: Record<string, LocalExerciseSpec[]> = {
  continuity: [
    local('central-right', 'junction-1', 'bifurcation'),
    local('left-lower-returning', 'junction-6', 'bifurcation'),
  ],
  orientation: [local('central-right', 'junction-1', 'viewpoint')],
  vertical: [
    local('right-upper-apical', 'junction-14', 'pattern'),
    local('right-lower-basal', 'junction-9', 'pattern'),
  ],
  'horizontal-horizontal': [
    local('middle-lobe-lateral', 'junction-10', 'pattern'),
    local('middle-lobe-lateral', 'junction-19', 'pattern'),
  ],
  'horizontal-vertical': [
    local('middle-lobe-caudal', 'junction-20', 'pattern'),
    local('middle-lobe-cranial', 'junction-20', 'pattern'),
  ],
  'horizontal-oblique': [
    local('upper-oblique-lateral', 'junction-16', 'pattern'),
    local('left-upper-anterior', 'junction-23', 'pattern'),
  ],
  'orientation-changes': [
    local('left-lower-returning', 'junction-11', 'integration'),
    local('left-lower-returning', 'junction-25', 'integration'),
    local('left-lower-returning', 'junction-52', 'integration'),
  ],
}
const LOCAL_STEPS: StageStepBase<string>[] = [
  {
    id: 'demo',
    ordinal: 1,
    phase: 'recognize',
    title: 'Watch the CT walkthrough',
    instruction: 'Inspect the short interval and its caption transcript.',
    actionLabel: 'Your turn',
    interaction: 'read',
    gate: 'open',
    lookIn: { pane: 'simulator', landmark: 'CT tracing stack' },
  },
  {
    id: 'attempt',
    ordinal: 2,
    phase: 'predict',
    title: 'Follow the lumen',
    instruction:
      'Browse adjacent slices, then mark the lumen on the answer slice. You can show the reference or continue without marking.',
    actionLabel: 'Check my tracing',
    interaction: 'choose',
    gate: 'open',
    lookIn: { pane: 'simulator', landmark: 'CT tracing stack' },
  },
  {
    id: 'compare',
    ordinal: 3,
    phase: 'observe',
    title: 'Compare and retry',
    instruction:
      'Review the image evidence. Keep uncertainty where continuity cannot be established.',
    actionLabel: 'Relate the parent view',
    interaction: 'observe',
    gate: 'open',
    lookIn: { pane: 'simulator', landmark: 'CT tracing stack' },
  },
  {
    id: 'parent-view',
    ordinal: 4,
    phase: 'explain',
    title: 'Relate the parent view',
    instruction:
      'Choose the matching opening or show the labels, then compare the paired airway view.',
    actionLabel: 'Try another local example',
    interaction: 'explain',
    gate: 'open',
    lookIn: { pane: 'simulator', landmark: 'Fixed parent view' },
  },
]
export const LESSONS: CtLesson[] = [
  {
    // Authored for its own two intervals (BBT-01), not inherited from the bifurcation lesson:
    // the trachea above the carina (central-right, slices 416→412) and the left main bronchus
    // (central-left, 352→348), each four 0.5 mm steps in standard axial display.
    id: 'follow-one-airway',
    title: 'Follow one airway',
    minutes: 5,
    objective: 'Keep the identity of one air-filled lumen across neighboring axial CT slices.',
    prerequisite: 'Recognize an air-filled airway on axial CT.',
    concept: 'Stay in the same lumen, one slice at a time, before interpreting any division.',
    purpose:
      'A CT route to a peripheral target is built one slice at a time. If a single step jumps to a neighboring airway, every branch decision after it is made on the wrong route.',
    checklist: [
      'Start on the outlined lumen and note where it sits against R, L, A and P.',
      'Step one slice at a time, keeping the same air column and its wall in view.',
      'Adjacent 0.5 mm slices change little; a sudden jump in position or size means you may have left the lumen.',
      'Lost it? Go back to the last slice you were sure of, or record uncertainty.',
    ],
    teaching: [
      'Standard axial CT is viewed from the feet: patient right is on screen-left and anterior is at the top. The air-filled lumen is dark, bounded by its wall. Both intervals in this lesson stay in this standard display.',
      'Step through adjacent slices in small increments. The airway you started in appears in nearly the same place on each neighboring slice. A nearby lucency that is not continuous with it, such as another bronchus, is a different airway.',
    ],
    worked:
      'The first interval starts in the trachea above the carina and moves caudally toward it in four 0.5 mm steps (2 mm). The second repeats the same task in the left main bronchus, a narrower lumen, again over four caudal steps.',
    interpretation:
      'Compare your marked slice with the starting slice. If you stayed in the same airway, its lumen sits in almost the same place, with a similar size and a continuous wall on every slice between them. The ring is a model locator, not a wall outline: a mark anywhere inside the lumen is valid. If you lost the airway, return to the starting slice and step through the interval again.',
    transferPrompt:
      'Repeat the task in the left main bronchus: keep the outlined lumen in view across the adjacent slices, then mark it or record uncertainty.',
    // The method is the book's; the exact page for single-lumen continuity awaits faculty review.
    sourcePages: 'Chapter 1 · exact page not yet confirmed',
    // Demonstration and first try share the tracheal interval; the repeat moves to the LMSB.
    example: 'central-right',
    prediction: 'central-right',
    transfer: 'central-left',
    exercises: [
      local('central-right', 'junction-1', 'same-lumen'),
      local('central-left', 'junction-3', 'same-lumen'),
    ],
    steps: LOCAL_STEPS.slice(0, 3),
  },
  ...[
    'orientation',
    'continuity',
    'vertical',
    'horizontal-horizontal',
    'horizontal-vertical',
    'horizontal-oblique',
    'orientation-changes',
    'variants-limits',
  ].map((id) => {
    const lesson = ROUTE_LESSONS.find((item) => item.id === id)!
    return {
      ...lesson,
      title:
        id === 'continuity'
          ? 'Follow the airway through a bifurcation'
          : id === 'orientation'
            ? 'Relate CT to the parent airway view'
            : id === 'orientation-changes'
              ? 'Build a short route map'
              : lesson.title,
      objective:
        id === 'continuity'
          ? 'Maintain parent-airway identity through a division and identify its daughter lumens using adjacent slices.'
          : id === 'orientation'
            ? 'Separate patient direction, CT display transformation and the view down the parent airway.'
            : id === 'orientation-changes'
              ? 'Build a connected map through three successive divisions and retain airway identity as the course reverses cranial–caudal direction.'
              : lesson.objective,
      prerequisite:
        id === 'continuity'
          ? 'Follow one lumen and distinguish CT presentation from the parent-airway viewpoint.'
          : lesson.prerequisite,
      minutes: LOCAL_PLANS[id] ? (id === 'orientation-changes' ? 8 : 6) : lesson.minutes,
      exercises: LOCAL_PLANS[id],
      steps: LOCAL_PLANS[id] ? LOCAL_STEPS : LESSON_STEPS,
    }
  }),
]
export const lessonById = (id?: string) => LESSONS.find((l) => l.id === id)
export const nextLesson = (completed: string[]) =>
  LESSONS.find((l) => !completed.includes(l.id)) ?? null
export function lessonLocationErrors() {
  return LESSONS.flatMap((l) =>
    l.steps.flatMap((s) => stageStepLocationErrors(`${l.id}.${s.id}`, s.lookIn)),
  )
}

export const lessonAfter = (id: string) =>
  LESSONS[LESSONS.findIndex((lesson) => lesson.id === id) + 1]
