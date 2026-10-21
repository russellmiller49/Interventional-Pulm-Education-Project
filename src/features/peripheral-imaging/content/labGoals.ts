import { FIELD_FOR_PATH_MAX, type LabGoal } from '../engine/labGoalEvaluation'
import { ACQUISITION_CHECK_KEYS, type LabMetricId } from '../engine/labMetrics'
import { ANGLE_EXAMPLES } from './angleRules'
import { imagingLearnerCopyErrors } from './learnerCopy'
import type { ImagingSectionId } from './pathway'

/**
 * What each lab section asks the learner to do on the suite, as predicates the engine evaluates.
 *
 * `act` is met before the Act step's Continue enables; `observe` before the Observe step's;
 * `watch` names the readouts the Explain step's "what changed" table snapshots before and after.
 * Labels are the words the Now card prints beside each goal, so they pass the copy gate.
 */
export interface SectionLabGoals {
  readonly act: readonly LabGoal[]
  readonly observe: readonly LabGoal[]
  readonly watch: readonly LabMetricId[]
}

const acquisitionChecks: readonly LabGoal[] = [
  {
    type: 'flag',
    key: ACQUISITION_CHECK_KEYS[0],
    value: true,
    label: 'Confirm the target, tool and needed anatomy are covered',
  },
  {
    type: 'flag',
    key: ACQUISITION_CHECK_KEYS[1],
    value: true,
    label: 'Confirm the full CBCT spin path and the lines are clear',
  },
  {
    type: 'flag',
    key: ACQUISITION_CHECK_KEYS[2],
    value: true,
    label: 'Confirm the instrument state and the anesthesia plan',
  },
  {
    type: 'flag',
    key: ACQUISITION_CHECK_KEYS[3],
    value: true,
    label: 'Confirm protection, monitoring and patient access',
  },
]

const centeredGoal: LabGoal = {
  type: 'metric',
  metric: 'centered',
  op: 'eq',
  value: true,
  label: 'Center the lesion on both scout images',
}
const capturedGoal: LabGoal = {
  type: 'flag',
  key: 'captured',
  value: true,
  label: 'Run the CBCT spin on the centered, checked setup',
}
const movedAfterCapture: LabGoal = {
  type: 'event',
  id: 'moved-after-capture',
  label: 'After the spin, change the lesion offset and see the checks clear',
}

export const IMAGING_LAB_GOALS: Readonly<Partial<Record<ImagingSectionId, SectionLabGoals>>> = {
  'good-image': {
    act: [
      {
        type: 'event',
        id: 'touched-orbit',
        label: 'Change the projection with fixed tool and lesion geometry',
      },
      {
        type: 'event',
        id: 'touched-zoom',
        label: 'Compare stored-image zoom with the changed projection',
      },
    ],
    observe: [],
    watch: ['separationMm', 'depthMm', 'zoomAddsExposure'],
  },
  'chain-walk': {
    act: [
      {
        type: 'event',
        id: 'touched-orbit',
        label: 'At beam geometry, change the C-arm obliquity once',
      },
    ],
    observe: [],
    watch: ['separationMm'],
  },
  'current-anatomy': {
    act: [
      {
        type: 'value',
        key: 'shift',
        op: 'abs-gte',
        value: 15,
        label: 'Displace the anatomy by fifteen millimetres or more',
      },
      { type: 'flag', key: 'overlay', value: true, label: 'Keep the stored overlay contour shown' },
    ],
    observe: [
      {
        type: 'event',
        id: 'contour-captured',
        label: 'Capture a new contour at the current state',
      },
    ],
    watch: ['storedShiftMm', 'currentShiftMm', 'contourStale'],
  },
  projection: {
    act: [
      {
        type: 'event',
        id: 'touched-orbit',
        label: 'Change the projection with tool and lesion held fixed',
      },
      {
        type: 'event',
        id: 'lung-only-seen',
        label: 'Find an obliquity and tilt with only lung over the nodule',
      },
    ],
    observe: [
      {
        type: 'value',
        key: 'orbit',
        op: 'eq',
        value: 0,
        label: 'Return to the baseline projection and compare the overlap',
      },
    ],
    watch: ['separationMm', 'depthMm'],
  },
  signal: {
    act: [
      {
        type: 'event',
        id: 'touched-orbit',
        label: 'Compare a different CT projection with the baseline',
      },
      {
        type: 'event',
        id: 'rib-moved-by-tilt',
        label:
          'With the heart off the nodule, nudge the beam tilt until a rib moves onto or off it',
      },
    ],
    observe: [],
    watch: [],
  },
  field: {
    act: [
      {
        type: 'event',
        id: 'path-kept-collimated',
        label: 'Narrow the field with the planned tool path and both landmarks still inside it',
      },
      {
        type: 'event',
        id: 'spine-excluded',
        label: 'Then, with the tool at the lesion, narrow it until the spine is out of the field',
      },
    ],
    observe: [
      {
        type: 'event',
        id: 'touched-crop',
        label: 'Compare electronic cropping with the acquired field',
      },
      {
        type: 'event',
        id: 'touched-zoom',
        label: 'Enlarge the stored image and inspect its acquisition metadata',
      },
    ],
    watch: ['irradiatedAreaPct', 'contextRetained', 'spineInField', 'zoomAddsExposure'],
  },
  time: {
    act: [
      {
        type: 'event',
        id: 'width-isolated',
        label: 'Change pulse width alone with rate and speed fixed',
      },
    ],
    observe: [
      {
        type: 'event',
        id: 'rate-isolated',
        label: 'Restore the baseline width, then change rate alone at fixed speed',
      },
    ],
    watch: ['masPerSecond', 'inFrameBlurMm', 'interFrameTravelMm', 'intervalMs'],
  },
  'two-dimensional': {
    act: [
      {
        type: 'metric',
        metric: 'mediastinumOnRay',
        op: 'eq',
        value: false,
        label: 'Project the nodule clear of the heart',
      },
      {
        type: 'event',
        id: 'touched-field',
        label: 'Adjust the acquisition field around the target',
      },
      {
        type: 'metric',
        metric: 'contextRetained',
        op: 'eq',
        value: true,
        label: 'Keep the planned tool path and both landmarks in the field',
      },
      { type: 'event', id: 'touched-zoom', label: 'Inspect the stored image with display zoom' },
    ],
    observe: [],
    watch: ['separationMm', 'irradiatedAreaPct', 'contextRetained', 'zoomAddsExposure'],
  },
  'dts-acquisition': {
    act: [
      {
        type: 'event',
        id: 'plane-tool-visited',
        label: 'Scroll to the plane where the tool is in focus',
      },
      {
        type: 'event',
        id: 'plane-lesion-visited',
        label: 'Scroll to the plane where the lesion is in focus',
      },
    ],
    observe: [
      {
        type: 'event',
        id: 'touched-sweep',
        label: 'Change the DTS arc and compare its depth uncertainty',
      },
      {
        type: 'metric',
        metric: 'rayCrossesAtCentre',
        op: 'eq',
        value: 'Rib',
        label: 'Move the centre of the arc until the heart and spine are off the nodule',
      },
    ],
    watch: ['sweepDeg', 'sweepCentreDeg', 'rayCrossesAtCentre', 'planeMm'],
  },
  'cbct-acquisition': {
    act: [centeredGoal, ...acquisitionChecks, capturedGoal],
    observe: [movedAfterCapture],
    watch: ['centered', 'ready', 'captured'],
  },
  'fixed-suite': {
    act: [
      {
        type: 'event',
        id: 'touched-acquisitionOrbit',
        label: 'Inspect another gantry position for the fixed-room workflow',
      },
      {
        type: 'event',
        id: 'touched-offsetX',
        label: 'Change the horizontal offset and inspect the scout',
      },
    ],
    observe: [],
    watch: ['centered'],
  },
  'mobile-suite': {
    act: [
      centeredGoal,
      {
        type: 'event',
        id: 'touched-acquisitionOrbit',
        label: 'Inspect the mobile gantry path with the setup centered',
      },
    ],
    observe: [],
    watch: ['centered'],
  },
  'tool-confirmation': {
    act: [
      {
        type: 'metric',
        metric: 'windowIntersects',
        op: 'eq',
        value: true,
        label: 'Bring the side-cutting window into the lesion',
      },
      { type: 'flag', key: 'slab', value: false, label: 'Review thin slices, not the thick slab' },
      {
        type: 'event',
        id: 'window-slices-visited',
        label: 'Review the slices through the side-cutting window',
      },
    ],
    observe: [
      { type: 'flag', key: 'revealed', value: true, label: 'Reveal the geometric explanation' },
      { type: 'event', id: 'slab-compared', label: 'Compare the slab with the thin slices' },
    ],
    watch: ['windowLabel', 'tipInside'],
  },
  'changing-anatomy': {
    act: [
      { type: 'event', id: 'contour-captured', label: 'Capture a target contour' },
      {
        type: 'metric',
        metric: 'contourStale',
        op: 'eq',
        value: true,
        label: 'Change the anatomy after capturing',
      },
    ],
    observe: [
      {
        type: 'flag',
        key: 'overlay',
        value: false,
        label: 'Turn the overlay off and review the underlying image',
      },
    ],
    watch: ['storedShiftMm', 'currentShiftMm', 'contourStale'],
  },
  'staff-protection': {
    act: [
      {
        type: 'event',
        id: 'touched-distance',
        label: 'Change the operator’s distance from the patient',
      },
    ],
    observe: [
      { type: 'flag', key: 'shield', value: true, label: 'Position the shielding barrier' },
      {
        type: 'event',
        id: 'touched-orbit',
        label: 'Change the projection and inspect source, patient and barrier',
      },
    ],
    watch: ['inverseSquareRatio'],
  },
  'dose-reporting': {
    act: [
      {
        type: 'event',
        id: 'touched-area',
        label: 'Change the field area at fixed air kerma',
      },
    ],
    observe: [],
    watch: ['kapGyCm2', 'kapMicroGyM2'],
  },
  // Expert-session round, part 2 (A7): one nodule through the workflow. Every goal holds at once at
  // a 15° wedge and LAO 9° (model-truth.test.ts); the nudge and the clear view without the wedge
  // are the comparison.
  'suite-cases': {
    act: [
      {
        type: 'value',
        key: 'wedge',
        op: 'eq',
        value: ANGLE_EXAMPLES.wedge.wedge,
        label: 'Put the wedge under the left side',
      },
      {
        type: 'value',
        key: 'orbit',
        op: 'abs-lte',
        value: ANGLE_EXAMPLES.runThroughOrbitLimit,
        label: 'Keep the C-arm within the obliquity the docked platform allows',
      },
      {
        type: 'metric',
        metric: 'rayCrosses',
        op: 'eq',
        value: 'Lung only',
        label: 'Reach a projection with only lung over the nodule',
      },
      {
        type: 'metric',
        metric: 'irradiatedAreaPct',
        op: 'lte',
        value: (FIELD_FOR_PATH_MAX * FIELD_FOR_PATH_MAX) / 100,
        label: 'Narrow the collimated field around the lesion',
      },
      {
        type: 'metric',
        metric: 'contextRetained',
        op: 'eq',
        value: true,
        label: 'Keep the planned tool path and both landmarks in the field',
      },
      { type: 'event', id: 'touched-zoom', label: 'Inspect the stored image with display zoom' },
    ],
    observe: [
      {
        type: 'event',
        id: 'rib-moved-by-tilt',
        label: 'Nudge the beam tilt until a rib moves onto or off the nodule',
      },
      { type: 'value', key: 'wedge', op: 'eq', value: 0, label: 'Take the wedge out' },
      {
        type: 'metric',
        metric: 'rayCrosses',
        op: 'eq',
        value: 'Lung only',
        label: 'Find the clear projection again with the C-arm alone',
      },
    ],
    watch: ['viewObliquityDeg', 'rayCrosses', 'contextRetained'],
  },
}

export function imagingLabGoals(sectionId: ImagingSectionId): SectionLabGoals | null {
  return IMAGING_LAB_GOALS[sectionId] ?? null
}

export function validateImagingLabGoals(): readonly string[] {
  const errors: string[] = []
  for (const [sectionId, goals] of Object.entries(IMAGING_LAB_GOALS)) {
    if (!goals) continue
    const where = `Lab goals for ${sectionId}`
    if (goals.act.length === 0) errors.push(`${where} ask for nothing at Act.`)
    for (const goal of [...goals.act, ...goals.observe]) {
      errors.push(...imagingLearnerCopyErrors(`${where} label`, goal.label))
    }
    const labels = [...goals.act, ...goals.observe].map((goal) => goal.label)
    if (new Set(labels).size !== labels.length) errors.push(`${where} repeat a label.`)
  }
  return errors
}

const goalErrors = validateImagingLabGoals()
if (goalErrors.length > 0) {
  throw new Error(`The imaging lab goals are invalid:\n${goalErrors.join('\n')}`)
}
