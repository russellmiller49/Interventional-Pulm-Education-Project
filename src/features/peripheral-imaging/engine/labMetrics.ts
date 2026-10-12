import type { LabId } from '../types'
import {
  centeredForTeaching,
  fieldContextCoverage,
  spineInField,
  clamp,
  kapGyCm2,
  kapMicroGyM2,
  LESION_CENTER,
  projectToDetector,
  temporalMetrics,
  toolTipForDepth,
  windowRelationship,
  type Point3,
} from '../lib/physics'

/**
 * The lab controls and the arithmetic behind every readout, in one place.
 *
 * The draft computed each readout inline in the lab body (`components/ImagingLab.tsx`), which
 * meant a goal on the lesson stage could only be written by re-deriving the number. Here the
 * control registry says what each lab can change (key, kind, range, default, label), and
 * `labReadouts` derives every displayed value from those controls through `lib/physics.ts` — so
 * the simulator pane, the Now card's goals and the "what changed" table read one function and
 * cannot disagree. Nothing here estimates dose or device performance: every range is authored
 * teaching geometry, as the physics module says of itself.
 */
export type LabValue = string | number | boolean
export type LabValues = Readonly<Record<string, LabValue>>

export interface LabState {
  readonly values: LabValues
  /** History-dependent things the learner has done on this lab, in the order they happened. */
  readonly events: readonly string[]
}

export type LabControlKind = 'range' | 'toggle' | 'select' | 'choice' | 'action'

export interface LabControlSpec {
  readonly key: string
  readonly kind: LabControlKind
  /** The label the draft's lab printed; the suite pane and the test double print the same one. */
  readonly label: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly unit?: string
  readonly options?: readonly { readonly value: LabValue; readonly label: string }[]
  readonly default: LabValue | ((lessonId: string) => LabValue)
  /** For an action: the patch applied when it is pressed. */
  readonly patch?: LabValues
}

export const PULSE_RATES = [3.75, 7.5, 15] as const

const ACQUISITION_CHECKS = ['target', 'clearance', 'state', 'protection'] as const

function acquisitionKindDefault(lessonId: string): LabValue {
  return lessonId === 'fixed-suite' ? 'fixed' : 'mobile'
}

const FIELD_CONTROLS: readonly LabControlSpec[] = [
  {
    key: 'field',
    kind: 'range',
    label: 'Collimated field width',
    // Tight enough to take the spine and most of the mediastinum out of the field around the lesion.
    min: 30,
    max: 100,
    step: 1,
    unit: '%',
    default: 100,
  },
  {
    key: 'crop',
    kind: 'toggle',
    label: 'Electronic crop of the stored image',
    default: false,
  },
  {
    key: 'cropWidth',
    kind: 'range',
    label: 'Displayed crop width',
    min: 45,
    max: 100,
    step: 1,
    unit: '%',
    default: 70,
  },
  {
    key: 'zoom',
    kind: 'range',
    label: 'Display zoom on the stored image',
    min: 1,
    max: 2,
    step: 0.25,
    unit: '×',
    default: 1,
  },
]

export const LAB_CONTROLS: Readonly<Record<LabId, readonly LabControlSpec[]>> = {
  geometry: [
    ...FIELD_CONTROLS,
    {
      key: 'orbit',
      kind: 'range',
      label: 'C-arm obliquity',
      min: -75,
      max: 75,
      step: 1,
      unit: '°',
      default: 0,
    },
    {
      key: 'tilt',
      kind: 'range',
      label: 'Beam tilt',
      min: -25,
      max: 25,
      step: 1,
      unit: '°',
      default: 0,
    },
    {
      key: 'depth',
      kind: 'range',
      label: 'Tool depth offset',
      min: -30,
      max: 30,
      step: 1,
      unit: ' mm',
      default: (lessonId) => (lessonId === 'signal' ? 0 : 22),
    },
    {
      key: 'resetGeometry',
      kind: 'action',
      label: 'Reset geometry',
      default: false,
      patch: { orbit: 0, tilt: 0, depth: 22 },
    },
  ],
  field: FIELD_CONTROLS,
  temporal: [
    {
      key: 'rate',
      kind: 'select',
      label: 'Pulse rate',
      options: PULSE_RATES.map((value) => ({ value, label: `${value} pulses/s` })),
      default: 7.5,
    },
    {
      key: 'width',
      kind: 'range',
      label: 'Pulse width',
      min: 5,
      max: 20,
      step: 1,
      unit: ' ms',
      default: 5,
    },
    {
      key: 'speed',
      kind: 'range',
      label: 'Tool speed',
      min: 0,
      max: 40,
      step: 1,
      unit: ' mm/s',
      default: 20,
    },
  ],
  dts: [
    {
      key: 'sweep',
      kind: 'range',
      label: 'DTS arc',
      min: 20,
      max: 60,
      step: 10,
      unit: '°',
      default: 30,
    },
    {
      key: 'plane',
      kind: 'range',
      label: 'DTS plane depth',
      min: -30,
      max: 30,
      step: 1,
      unit: ' mm',
      default: 0,
    },
    {
      key: 'planeTool',
      kind: 'action',
      label: 'Tool plane',
      default: false,
      patch: { plane: -18 },
    },
    {
      key: 'planeLesion',
      kind: 'action',
      label: 'Lesion plane',
      default: false,
      patch: { plane: 0 },
    },
    {
      key: 'planeDeeper',
      kind: 'action',
      label: 'Deeper plane',
      default: false,
      patch: { plane: 25 },
    },
  ],
  acquisition: [
    {
      key: 'kind',
      kind: 'choice',
      label: 'CBCT workflow',
      options: [
        { value: 'fixed', label: 'Fixed CBCT suite' },
        { value: 'mobile', label: 'Mobile CBCT suite' },
      ],
      default: acquisitionKindDefault,
    },
    {
      key: 'acquisitionOrbit',
      kind: 'range',
      label: 'Gantry rotation',
      min: -100,
      max: 100,
      step: 1,
      unit: '°',
      default: 0,
    },
    {
      key: 'offsetX',
      kind: 'range',
      label: 'Lesion horizontal offset',
      min: -30,
      max: 30,
      step: 1,
      unit: ' mm',
      default: 18,
    },
    {
      key: 'offsetDepth',
      kind: 'range',
      label: 'Lesion depth offset',
      min: -30,
      max: 30,
      step: 1,
      unit: ' mm',
      default: 18,
    },
    {
      key: 'center',
      kind: 'action',
      label: 'Center the lesion',
      default: false,
      patch: { offsetX: 0, offsetDepth: 0 },
    },
    {
      key: 'target',
      kind: 'toggle',
      label: 'Target, tool and required anatomy covered',
      default: false,
    },
    {
      key: 'clearance',
      kind: 'toggle',
      label: 'Full CBCT spin path and lines checked',
      default: false,
    },
    {
      key: 'state',
      kind: 'toggle',
      label: 'Instrument state and anesthesia plan agreed',
      default: false,
    },
    {
      key: 'protection',
      kind: 'toggle',
      label: 'Protection, monitoring and patient access confirmed',
      default: false,
    },
    {
      key: 'captured',
      kind: 'action',
      label: 'Run the CBCT spin',
      default: false,
      patch: { captured: true },
    },
  ],
  mpr: [
    {
      key: 'tipX',
      kind: 'range',
      label: 'Tip along needle axis',
      min: -5,
      max: 28,
      step: 1,
      unit: ' mm',
      default: 14,
    },
    {
      key: 'tipY',
      kind: 'range',
      label: 'Anterior / posterior offset',
      min: -20,
      max: 20,
      step: 1,
      unit: ' mm',
      default: 14,
    },
    {
      key: 'tipZ',
      kind: 'range',
      label: 'Superior / inferior offset',
      min: -15,
      max: 15,
      step: 1,
      unit: ' mm',
      default: 0,
    },
    { key: 'slab', kind: 'toggle', label: 'Thick slab (combine depths)', default: false },
    {
      key: 'slicesTarget',
      kind: 'action',
      label: 'Slices through target center',
      default: false,
      patch: { axial: 0, coronal: 0, sagittal: 0, slab: false },
    },
    {
      key: 'axial',
      kind: 'range',
      label: 'Axial slice (superior / inferior)',
      min: -20,
      max: 20,
      step: 1,
      unit: ' mm',
      default: 0,
    },
    {
      key: 'coronal',
      kind: 'range',
      label: 'Coronal slice (anterior / posterior)',
      min: -20,
      max: 20,
      step: 1,
      unit: ' mm',
      default: 0,
    },
    {
      key: 'sagittal',
      kind: 'range',
      label: 'Sagittal slice (left / right)',
      min: -20,
      max: 20,
      step: 1,
      unit: ' mm',
      default: 0,
    },
    { key: 'revealed', kind: 'toggle', label: 'Reveal geometric explanation', default: false },
  ],
  registration: [
    {
      key: 'shift',
      kind: 'range',
      label: 'Anatomical displacement',
      min: -30,
      max: 30,
      step: 1,
      unit: ' mm',
      default: 0,
    },
    { key: 'overlay', kind: 'toggle', label: 'Show the stored contour', default: true },
    {
      key: 'showCurrent',
      kind: 'toggle',
      label: 'Show the current lesion position',
      default: true,
    },
    { key: 'capture', kind: 'action', label: 'Capture a new stored contour', default: false },
  ],
  safety: [
    {
      key: 'distance',
      kind: 'range',
      label: 'Distance from patient center',
      min: 1.3,
      max: 3,
      step: 0.1,
      unit: ' m',
      default: 1.6,
    },
    {
      key: 'orbit',
      kind: 'range',
      label: 'C-arm rotation',
      min: -90,
      max: 90,
      step: 1,
      unit: '°',
      default: 0,
    },
    {
      key: 'shield',
      kind: 'toggle',
      label: 'Place the shielding barrier between patient and staff',
      default: false,
    },
  ],
  dose: [
    {
      key: 'kerma',
      kind: 'range',
      label: 'Air kerma at the chosen plane',
      min: 1,
      max: 20,
      step: 1,
      unit: ' mGy',
      default: 10,
    },
    {
      key: 'area',
      kind: 'range',
      label: 'Beam area at the same plane',
      min: 50,
      max: 500,
      step: 10,
      unit: ' cm²',
      default: 400,
    },
    {
      key: 'presetInitial',
      kind: 'action',
      label: 'Initial field',
      default: false,
      patch: { kerma: 10, area: 400 },
    },
    {
      key: 'presetSmaller',
      kind: 'action',
      label: 'Smaller field, greater kerma',
      default: false,
      patch: { kerma: 12, area: 100 },
    },
  ],
}

/** The hidden values a lab carries that no control sets directly. */
const HIDDEN_DEFAULTS: Readonly<Record<LabId, LabValues>> = {
  geometry: {},
  field: {},
  temporal: {},
  dts: {},
  acquisition: { captured: false },
  mpr: {},
  registration: { previous: 0 },
  safety: {},
  dose: {},
}

export function labControl(lab: LabId, key: string): LabControlSpec | undefined {
  return LAB_CONTROLS[lab].find((control) => control.key === key)
}

export function controlDefault(control: LabControlSpec, lessonId: string): LabValue {
  return typeof control.default === 'function' ? control.default(lessonId) : control.default
}

export function labDefaults(lab: LabId, lessonId: string): LabValues {
  const values: Record<string, LabValue> = { ...HIDDEN_DEFAULTS[lab] }
  for (const control of LAB_CONTROLS[lab]) {
    if (control.kind === 'action') continue
    values[control.key] = controlDefault(control, lessonId)
  }
  return values
}

/** A control's current value, clamped to its range and falling back to its default — the draft's `num`/`flag`. */
export function labValue(lab: LabId, values: LabValues, key: string, lessonId: string): LabValue {
  const control = labControl(lab, key)
  const raw = values[key]
  if (!control) {
    const hidden = HIDDEN_DEFAULTS[lab][key]
    if (typeof hidden === 'number')
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : hidden
    if (typeof hidden === 'boolean') return typeof raw === 'boolean' ? raw : hidden
    return raw ?? hidden ?? false
  }
  const fallback = controlDefault(control, lessonId)
  switch (control.kind) {
    case 'range':
      return typeof raw === 'number' && Number.isFinite(raw)
        ? clamp(raw, control.min ?? -Infinity, control.max ?? Infinity)
        : fallback
    // An action is a momentary trigger: pressing it applies its `patch` to other keys and its own
    // key is never stored, so `raw` is undefined and the default stands. The exception is an
    // action whose patch latches its own key — `captured` is the one — and that stored boolean has
    // to read back, or the flag the learner just set reads false everywhere it is used.
    case 'action':
    case 'toggle':
      return typeof raw === 'boolean' ? raw : fallback
    case 'select':
    case 'choice':
      return control.options?.some((option) => option.value === raw) ? raw : fallback
    default:
      return fallback
  }
}

export function labNumber(lab: LabId, values: LabValues, key: string, lessonId: string): number {
  const value = labValue(lab, values, key, lessonId)
  return typeof value === 'number' ? value : Number(value) || 0
}

export function labFlag(lab: LabId, values: LabValues, key: string, lessonId: string): boolean {
  return labValue(lab, values, key, lessonId) === true
}

export type LabMetricId =
  | 'separationMm'
  | 'depthMm'
  | 'irradiatedAreaPct'
  | 'contextRetained'
  | 'spineInField'
  | 'zoomAddsExposure'
  | 'pulseRate'
  | 'masPerSecond'
  | 'inFrameBlurMm'
  | 'interFrameTravelMm'
  | 'intervalMs'
  | 'sweepDeg'
  | 'planeMm'
  | 'centered'
  | 'ready'
  | 'captured'
  | 'windowLabel'
  | 'windowIntersects'
  | 'windowFull'
  | 'tipInside'
  | 'storedShiftMm'
  | 'currentShiftMm'
  | 'contourStale'
  | 'inverseSquareRatio'
  | 'kapGyCm2'
  | 'kapMicroGyM2'

export type LabReadouts = Readonly<Partial<Record<LabMetricId, LabValue>>>

export interface LabMetricSpec {
  readonly label: string
  readonly unit?: string
  readonly digits?: number
}

/** The readout labels the draft printed, one per metric. */
export const LAB_METRICS: Readonly<Record<LabMetricId, LabMetricSpec>> = {
  separationMm: { label: 'Projected tool–lesion separation', unit: ' mm', digits: 1 },
  depthMm: { label: 'True depth offset along the X-ray path', unit: ' mm', digits: 0 },
  contextRetained: { label: 'Lesion, tool path and landmarks in the field' },
  spineInField: { label: 'Spine in the field' },
  irradiatedAreaPct: { label: 'Irradiated area vs the open field', unit: '%', digits: 0 },
  zoomAddsExposure: { label: 'Extra exposure from display zoom' },
  pulseRate: { label: 'Pulse rate', unit: ' pulses/s', digits: 2 },
  masPerSecond: { label: 'Tube load at fixed 20 mA', unit: ' mAs/s', digits: 2 },
  inFrameBlurMm: { label: 'Motion blur during one pulse', unit: ' mm', digits: 2 },
  interFrameTravelMm: { label: 'Travel between frames', unit: ' mm', digits: 1 },
  intervalMs: { label: 'Time between acquired frames', unit: ' ms', digits: 0 },
  sweepDeg: { label: 'DTS arc', unit: '°', digits: 0 },
  planeMm: { label: 'DTS plane depth', unit: ' mm', digits: 0 },
  centered: { label: 'Lesion centered on both scout images' },
  ready: { label: 'Acquisition readiness' },
  captured: { label: 'Spin run on the checked setup' },
  windowLabel: { label: 'Side-cutting window and lesion' },
  windowIntersects: { label: 'Side-cutting window intersects the lesion' },
  windowFull: { label: 'Side-cutting window fully within the lesion' },
  tipInside: { label: 'Needle tip inside the lesion' },
  storedShiftMm: { label: 'Stored contour state', unit: ' mm', digits: 0 },
  currentShiftMm: { label: 'Current anatomy state', unit: ' mm', digits: 0 },
  contourStale: { label: 'Stored contour differs from current anatomy' },
  inverseSquareRatio: {
    label: 'Scatter exposure vs 1 m, unshielded',
    unit: '×',
    digits: 2,
  },
  kapGyCm2: { label: 'Calculated KAP', unit: ' Gy·cm²', digits: 2 },
  kapMicroGyM2: { label: 'Equivalent unit expression', unit: ' µGy·m²', digits: 0 },
}

/**
 * What each displayed readout is, in one sentence, read from the arithmetic in `labReadouts` below.
 *
 * Report 2.11 (fellow walkthrough, PDF p.20): three readouts arrived with no explanation. These are
 * statements about the model's quantities, not clinical meanings; where a value cannot be anything
 * but one answer (display zoom never adds exposure) the sentence says so.
 */
export const LAB_METRIC_MEANINGS: Readonly<Record<LabMetricId, string>> = {
  separationMm:
    'The distance on the detector between where the tool tip and the target project in this projection. Zero means they are superimposed, however far apart they are in depth.',
  depthMm:
    'How far the tool tip sits from the target along the frontal X-ray path: the depth a single projection collapses.',
  irradiatedAreaPct:
    'The collimated field’s area as a share of the open field, from the field width squared. Scatter is produced in the irradiated tissue, so less area means less scatter reaching the detector.',
  contextRetained:
    'Whether the lesion, both numbered landmarks and the whole dashed planned tool path fall inside the field.',
  spineInField:
    'Whether any of the vertebral column lies inside the collimated field. With it outside, the display range and the automatic exposure control are set by the lung, the lesion and the tool.',
  zoomAddsExposure: 'Always no: display zoom re-displays acquired pixels and delivers no X-rays.',
  pulseRate: 'How often a new image is acquired.',
  masPerSecond:
    'Pulse rate × pulse width × a fixed 20 mA: the output the tube is asked for each second. Tube load is not patient dose.',
  inFrameBlurMm:
    'How far the tool travels during one pulse at the set tool speed: the blur within one frame.',
  interFrameTravelMm: 'How far the tool travels between one acquired frame and the next.',
  intervalMs: 'The time between acquired frames: one second divided by the pulse rate.',
  sweepDeg: 'The angular width of the DTS arc.',
  planeMm: 'The depth of the reconstructed plane relative to the target plane.',
  centered: 'Whether the lesion lies within 8 mm of center on both scout images.',
  ready: 'Centered, with all four pre-spin checks confirmed.',
  captured: 'Whether the spin was run on a centered, checked setup.',
  windowLabel: 'Where the side-cutting window lies relative to the lesion.',
  windowIntersects: 'Whether any part of the side-cutting window lies inside the lesion.',
  windowFull: 'Whether the whole side-cutting window lies inside the lesion.',
  tipInside:
    'Whether the tip lies inside the lesion, which is a different question from the window.',
  storedShiftMm: 'The displacement at which the stored contour was captured.',
  currentShiftMm: 'The displacement the current anatomy sits at now.',
  contourStale:
    'Yes when the stored contour was captured at a different displacement from the current anatomy.',
  inverseSquareRatio:
    'One over the distance squared, relative to one meter: the inverse-square trend with distance. It is not a measured staff dose.',
  kapGyCm2: 'Air kerma × beam area at the chosen plane.',
  kapMicroGyM2: 'The same kerma–area product in µGy·m²: 1 Gy·cm² is 100 µGy·m².',
}

export function formatReadout(metric: LabMetricId, value: LabValue | undefined): string {
  if (value === undefined) return '—'
  const spec = LAB_METRICS[metric]
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'number') return `${value.toFixed(spec.digits ?? 0)}${spec.unit ?? ''}`
  return value
}

/** Every displayed value of a lab, derived from its controls through the physics module. */
export function labReadouts(lab: LabId, values: LabValues, lessonId: string): LabReadouts {
  const n = (key: string) => labNumber(lab, values, key, lessonId)
  const f = (key: string) => labFlag(lab, values, key, lessonId)
  switch (lab) {
    case 'geometry': {
      const orbit = n('orbit'),
        tilt = n('tilt'),
        depth = n('depth')
      const target = projectToDetector(LESION_CENTER, orbit, tilt)
      const tip = projectToDetector(toolTipForDepth(depth), orbit, tilt)
      return {
        separationMm: Math.hypot(target[0] - tip[0], target[1] - tip[1]),
        depthMm: depth,
        irradiatedAreaPct: n('field') ** 2 / 100,
        zoomAddsExposure: false,
        contextRetained: fieldContextCoverage(n('field'), orbit, tilt),
      }
    }
    case 'field': {
      const field = n('field')
      return {
        irradiatedAreaPct: (field * field) / 100,
        zoomAddsExposure: false,
        contextRetained: fieldContextCoverage(field),
        spineInField: spineInField(field),
      }
    }
    case 'temporal': {
      const rate = n('rate'),
        width = n('width'),
        speed = n('speed')
      const metrics = temporalMetrics(rate, width, 20, speed)
      return {
        pulseRate: rate,
        masPerSecond: metrics.masPerSecond,
        inFrameBlurMm: metrics.inFrameBlur,
        interFrameTravelMm: metrics.interFrameTravel,
        intervalMs: metrics.intervalMs,
      }
    }
    case 'dts':
      return { sweepDeg: n('sweep'), planeMm: n('plane') }
    case 'acquisition': {
      const centered = centeredForTeaching(n('offsetX'), n('offsetDepth'))
      const ready = centered && ACQUISITION_CHECKS.every((key) => f(key))
      return { centered, ready, captured: f('captured') }
    }
    case 'mpr': {
      const tip: Point3 = [n('tipX'), n('tipY'), n('tipZ')]
      const relationship = windowRelationship(tip)
      return {
        windowLabel: relationship.label,
        windowIntersects: relationship.intersects,
        windowFull: relationship.full,
        tipInside: relationship.tipInside,
      }
    }
    case 'registration': {
      const shift = n('shift'),
        previous = n('previous')
      return { storedShiftMm: previous, currentShiftMm: shift, contourStale: previous !== shift }
    }
    case 'safety': {
      const distance = n('distance')
      return { inverseSquareRatio: 1 / (distance * distance) }
    }
    case 'dose': {
      const kap = kapGyCm2(n('kerma'), n('area'))
      return { kapGyCm2: kap, kapMicroGyM2: kapMicroGyM2(kap) }
    }
    default:
      return {}
  }
}

export const ACQUISITION_CHECK_KEYS = ACQUISITION_CHECKS
