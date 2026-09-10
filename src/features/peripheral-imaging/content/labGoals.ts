import type { LabGoal } from '../engine/labGoalEvaluation'
import { ACQUISITION_CHECK_KEYS, type LabMetricId } from '../engine/labMetrics'
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
  label: 'Capture the verified setup',
}
const movedAfterCapture: LabGoal = {
  type: 'event',
  id: 'moved-after-capture',
  label: 'Move the setup after capturing, and watch readiness lapse',
}

export const IMAGING_LAB_GOALS: Readonly<Partial<Record<ImagingSectionId, SectionLabGoals>>> = {
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
        type: 'metric',
        metric: 'separationMm',
        op: 'gte',
        value: 10,
        label: 'Rotate until the projected separation reaches ten millimetres',
      },
      {
        type: 'value',
        key: 'depth',
        op: 'abs-gte',
        value: 15,
        label: 'Keep the tool fifteen millimetres or more from the lesion along the X-ray path',
      },
    ],
    // A state goal, not an event: the overlap event fires on the first tick of the orbit slider
    // during the Act, so an event goal here would be met before this step began. The Act leaves
    // the separation at ten millimetres or more, so this reads false on entry and flips only
    // when the learner brings the beam back.
    observe: [
      {
        type: 'metric',
        metric: 'separationMm',
        op: 'lte',
        value: 0.5,
        label: 'Return to a projection where the tool and lesion overlap again',
      },
    ],
    watch: ['separationMm', 'depthMm'],
  },
  signal: {
    act: [
      { type: 'event', id: 'touched-orbit', label: 'Change the C-arm projection' },
      {
        type: 'value',
        key: 'orbit',
        op: 'abs-gte',
        value: 20,
        label: 'Reach twenty degrees of obliquity or more',
      },
    ],
    observe: [{ type: 'event', id: 'touched-tilt', label: 'Add cranial or caudal angulation' }],
    watch: ['separationMm'],
  },
  field: {
    act: [
      {
        type: 'flag',
        key: 'crop',
        value: false,
        label: 'Use collimation, not electronic cropping',
      },
      {
        type: 'value',
        key: 'field',
        op: 'lte',
        value: 70,
        label: 'Collimate to seven tenths of the full field width or less',
      },
    ],
    observe: [
      {
        type: 'flag',
        key: 'crop',
        value: true,
        label: 'Switch to electronic cropping and compare the irradiated area',
      },
      {
        type: 'value',
        key: 'zoom',
        op: 'gte',
        value: 1.5,
        label: 'Apply display zoom of one and a half times or more to the stored image',
      },
    ],
    watch: ['irradiatedAreaPct', 'zoomAddsExposure'],
  },
  time: {
    act: [
      {
        type: 'value',
        key: 'rate',
        op: 'eq',
        value: 3.75,
        label: 'Halve the pulse rate to the lowest setting',
      },
      { type: 'value', key: 'width', op: 'eq', value: 10, label: 'Double the pulse width' },
    ],
    observe: [
      {
        type: 'metric',
        metric: 'interFrameTravelMm',
        op: 'gte',
        value: 4,
        label: 'Raise the speed until the tool travels four millimetres or more between frames',
      },
    ],
    watch: ['masPerSecond', 'inFrameBlurMm', 'interFrameTravelMm', 'intervalMs'],
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
        type: 'value',
        key: 'sweep',
        op: 'gte',
        value: 50,
        label: 'Widen the DTS arc to fifty degrees or more',
      },
    ],
    watch: ['sweepDeg', 'planeMm'],
  },
  'cbct-acquisition': {
    act: [centeredGoal, ...acquisitionChecks, capturedGoal],
    observe: [movedAfterCapture],
    watch: ['centered', 'ready', 'captured'],
  },
  'fixed-suite': {
    act: [
      {
        type: 'value',
        key: 'kind',
        op: 'eq',
        value: 'fixed',
        label: 'Choose the fixed C-arm workflow',
      },
      centeredGoal,
      capturedGoal,
    ],
    observe: [movedAfterCapture],
    watch: ['centered', 'ready', 'captured'],
  },
  'mobile-suite': {
    act: [
      {
        type: 'value',
        key: 'kind',
        op: 'eq',
        value: 'mobile',
        label: 'Choose the mobile CBCT workflow',
      },
      centeredGoal,
      capturedGoal,
    ],
    observe: [
      {
        type: 'value',
        key: 'acquisitionOrbit',
        op: 'abs-gte',
        value: 90,
        label: 'Rotate the C-arm ninety degrees or more to inspect the spin path',
      },
    ],
    watch: ['centered', 'ready', 'captured'],
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
        type: 'value',
        key: 'distance',
        op: 'gte',
        value: 2.5,
        label: 'Step back to two and a half metres or more',
      },
    ],
    observe: [
      { type: 'flag', key: 'shield', value: true, label: 'Position the shielding barrier' },
      {
        type: 'value',
        key: 'orbit',
        op: 'abs-gte',
        value: 60,
        label: 'Rotate the C-arm sixty degrees or more',
      },
    ],
    watch: ['inverseSquareRatio'],
  },
  'dose-reporting': {
    act: [
      {
        type: 'value',
        key: 'area',
        op: 'lte',
        value: 100,
        label: 'Collimate the beam area to one hundred square centimetres or less',
      },
      {
        type: 'value',
        key: 'kerma',
        op: 'gte',
        value: 12,
        label: 'Raise the air kerma to twelve milligray or more',
      },
    ],
    observe: [
      {
        type: 'metric',
        metric: 'kapGyCm2',
        op: 'lte',
        value: 1.5,
        label: 'Bring the kerma–area product to one and a half gray-square-centimetres or less',
      },
    ],
    watch: ['kapGyCm2', 'kapMicroGyM2'],
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
