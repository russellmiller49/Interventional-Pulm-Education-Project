import type { SuiteBinding, SuiteMode, SuiteViewSpec } from '../components/suite/types'
import { LAB_CONTROLS, LAB_METRICS, type LabMetricId } from '../engine/labMetrics'
import type { LabId } from '../types'
import { chainCaption, isChainStopId, type ChainStopId } from './imagingChain'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { imagingLesson, peripheralImagingSectionIds, type ImagingSectionId } from './pathway'
import { imagingSectionSpec } from './sectionSpecs'

/**
 * What the suite shows for each section: the mode, the lit stop, the camera, the layers, which
 * lab dock is open and which readouts are printed. Authored here as data against the contract in
 * `components/suite/types.ts`; the suite (Codex) validates the shape with its own `suiteViewErrors`
 * once it lands, and this registry checks what it can — modes, stops, bindings, readouts, copy.
 * A step may override a view (`suiteViewForStep`) to light a different stop, hide the stop while a
 * chain-answered prediction is open, or expose a subset of the controls.
 */
const SUITE_MODES: readonly SuiteMode[] = [
  'projection',
  'signal',
  'field',
  'time',
  'dts',
  'dts-prior',
  'cbct',
  'sampling',
  'rebus',
  'navigation',
  'augmented',
  'staff',
  'dose',
  'room',
]

const bindingsFor: Readonly<Record<LabId, readonly SuiteBinding[]>> = {
  geometry: [
    { input: 'orbit', control: 'orbit' },
    { input: 'tilt', control: 'tilt' },
    { input: 'toolDepth', control: 'depth' },
  ],
  field: [
    { input: 'fieldPercent', control: 'field' },
    { input: 'crop', control: 'crop' },
    { input: 'zoom', control: 'zoom' },
  ],
  temporal: [
    { input: 'pulseRate', control: 'rate' },
    { input: 'pulseWidthMs', control: 'width' },
    { input: 'speedMmS', control: 'speed' },
  ],
  dts: [
    { input: 'sweepDeg', control: 'sweep' },
    { input: 'planeDepth', control: 'plane' },
  ],
  acquisition: [
    { input: 'variant', control: 'kind' },
    { input: 'acquisitionOrbit', control: 'acquisitionOrbit' },
    { input: 'offsetX', control: 'offsetX' },
    { input: 'offsetDepth', control: 'offsetDepth' },
  ],
  mpr: [
    { input: 'tipX', control: 'tipX' },
    { input: 'tipY', control: 'tipY' },
    { input: 'tipZ', control: 'tipZ' },
    { input: 'axial', control: 'axial' },
    { input: 'coronal', control: 'coronal' },
    { input: 'sagittal', control: 'sagittal' },
    { input: 'slab', control: 'slab' },
  ],
  registration: [
    { input: 'displacement', control: 'shift' },
    { input: 'storedDisplacement', control: 'previous' },
    { input: 'showStored', control: 'overlay' },
    { input: 'showCurrent', control: 'showCurrent' },
  ],
  safety: [
    { input: 'staffDistanceM', control: 'distance' },
    { input: 'orbit', control: 'orbit' },
    { input: 'barrier', control: 'shield' },
  ],
  dose: [
    { input: 'kermaMgy', control: 'kerma' },
    { input: 'areaCm2', control: 'area' },
  ],
}

const ANATOMY = ['Airways', 'Lungs'] as const
const SUITE = ['table', 'gantry', 'cone', 'labels'] as const

interface ViewInput {
  readonly mode: SuiteMode
  readonly litStop: ChainStopId | null
  readonly camera: SuiteViewSpec['camera']
  readonly layers: SuiteViewSpec['layers']
  readonly variant?: SuiteViewSpec['variant']
  readonly monitor?: SuiteViewSpec['monitor']
  readonly animation?: SuiteViewSpec['animation']
  readonly defaults?: SuiteViewSpec['defaults']
  readonly controls?: readonly string[]
  readonly readouts?: readonly LabMetricId[]
}

function view(sectionId: ImagingSectionId, input: ViewInput): SuiteViewSpec {
  const lesson = imagingLesson(sectionId)
  const spec = imagingSectionSpec(sectionId)
  return {
    sectionId,
    mode: input.mode,
    litStop: input.litStop,
    stopSentence: chainCaption(input.litStop),
    camera: input.camera,
    layers: input.layers,
    variant: input.variant ?? 'generic',
    monitor: input.monitor ?? (lesson.lab ? 'beside' : 'hidden'),
    animation: input.animation,
    bindings: lesson.lab ? bindingsFor[lesson.lab] : [],
    defaults: input.defaults ?? {},
    lab: lesson.lab,
    controls: input.controls,
    readouts: input.readouts,
    boundary: spec.modelBoundary,
  }
}

export const SUITE_VIEWS: Readonly<Record<ImagingSectionId, SuiteViewSpec>> = {
  'imaging-questions': view('imaging-questions', {
    mode: 'projection',
    litStop: 'display',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
  }),
  'chain-walk': view('chain-walk', {
    mode: 'projection',
    litStop: 'source',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'ray', 'monitor'],
    controls: ['orbit', 'tilt'],
    readouts: ['separationMm'],
  }),
  'good-image': view('good-image', {
    mode: 'projection',
    litStop: 'beam',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
  }),
  'current-anatomy': view('current-anatomy', {
    mode: 'navigation',
    litStop: 'patient',
    camera: 'suite',
    layers: [...ANATOMY, 'table', 'fieldGenerator', 'labels', 'monitor'],
    readouts: ['storedShiftMm', 'currentShiftMm', 'contourStale'],
  }),
  projection: view('projection', {
    mode: 'projection',
    litStop: 'beam',
    camera: 'beam',
    layers: [...ANATOMY, ...SUITE, 'ray', 'monitor'],
    readouts: ['separationMm', 'depthMm'],
  }),
  signal: view('signal', {
    mode: 'signal',
    litStop: 'patient',
    camera: 'beam',
    layers: [...ANATOMY, 'Ribs and spine', ...SUITE, 'ray', 'monitor'],
    controls: ['orbit', 'tilt'],
    readouts: ['separationMm'],
    defaults: { toolDepth: 0 },
  }),
  field: view('field', {
    mode: 'field',
    litStop: 'beam',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
    readouts: ['irradiatedAreaPct', 'zoomAddsExposure'],
    defaults: { orbit: 25, toolDepth: 12 },
  }),
  time: view('time', {
    mode: 'time',
    litStop: 'detector',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
    animation: { kind: 'pulse', autoplay: true, loop: true },
    readouts: ['pulseRate', 'masPerSecond', 'inFrameBlurMm', 'interFrameTravelMm', 'intervalMs'],
  }),
  'two-dimensional': view('two-dimensional', {
    mode: 'projection',
    litStop: 'display',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
  }),
  'dts-acquisition': view('dts-acquisition', {
    mode: 'dts',
    litStop: 'reconstruction',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
    animation: { kind: 'sweep', autoplay: true, loop: false },
    readouts: ['sweepDeg', 'planeMm'],
  }),
  'dts-interpretation': view('dts-interpretation', {
    mode: 'dts-prior',
    litStop: 'reconstruction',
    // The suite is drawn here, as it is in every other reconstruction section. Without it the
    // scene held only a small anatomy and the console board, so the chain read as a handful of
    // labels floating in an empty room — and on the suite camera, which fits the whole chain, the
    // frame came out almost entirely empty.
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
  }),
  'cbct-acquisition': view('cbct-acquisition', {
    mode: 'cbct',
    litStop: 'reconstruction',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'fov', 'monitor'],
    animation: { kind: 'orbit', autoplay: false, loop: false },
    readouts: ['centered', 'ready', 'captured'],
  }),
  'fixed-suite': view('fixed-suite', {
    mode: 'cbct',
    litStop: 'patient',
    camera: 'room',
    layers: [...ANATOMY, ...SUITE, 'fov', 'monitor'],
    variant: 'fixed',
    animation: { kind: 'orbit', autoplay: false, loop: false },
    readouts: ['centered', 'ready', 'captured'],
  }),
  'mobile-suite': view('mobile-suite', {
    mode: 'cbct',
    litStop: 'patient',
    camera: 'room',
    layers: [...ANATOMY, ...SUITE, 'fov', 'monitor'],
    variant: 'mobile',
    animation: { kind: 'orbit', autoplay: false, loop: false },
    readouts: ['centered', 'ready', 'captured'],
  }),
  'tool-confirmation': view('tool-confirmation', {
    mode: 'sampling',
    litStop: 'display',
    camera: 'target',
    layers: [...ANATOMY, 'planes', 'labels'],
    readouts: ['windowLabel', 'windowIntersects', 'tipInside'],
  }),
  'changing-anatomy': view('changing-anatomy', {
    mode: 'augmented',
    litStop: 'reconstruction',
    camera: 'beam',
    layers: [...ANATOMY, ...SUITE, 'ray', 'monitor'],
    readouts: ['storedShiftMm', 'currentShiftMm', 'contourStale'],
  }),
  'staff-protection': view('staff-protection', {
    mode: 'staff',
    litStop: 'patient',
    camera: 'room',
    layers: [...ANATOMY, ...SUITE, 'staff', 'barrier', 'isodose'],
    readouts: ['inverseSquareRatio'],
  }),
  'dose-reporting': view('dose-reporting', {
    mode: 'dose',
    litStop: 'detector',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'planes', 'monitor'],
    readouts: ['kapGyCm2', 'kapMicroGyM2'],
  }),
  'suite-cases': view('suite-cases', {
    mode: 'projection',
    litStop: 'display',
    camera: 'suite',
    layers: [...ANATOMY, ...SUITE, 'monitor'],
  }),
}

export interface SuiteViewOverrides {
  readonly litStop?: ChainStopId | null
  readonly camera?: SuiteViewSpec['camera']
  readonly controls?: readonly string[]
  readonly readouts?: readonly LabMetricId[]
  readonly chainAnswer?: boolean
  readonly autoplay?: boolean
}

export function suiteViewForStep(
  sectionId: ImagingSectionId,
  overrides: SuiteViewOverrides = {},
): SuiteViewSpec {
  const base = SUITE_VIEWS[sectionId]
  const litStop = overrides.chainAnswer
    ? null
    : overrides.litStop === undefined
      ? base.litStop
      : overrides.litStop
  return {
    ...base,
    litStop,
    stopSentence: chainCaption(litStop),
    camera: overrides.camera ?? base.camera,
    controls: overrides.controls ?? base.controls,
    readouts: overrides.readouts ?? base.readouts,
    chainAnswer: overrides.chainAnswer ?? false,
    animation:
      base.animation && overrides.autoplay !== undefined
        ? { ...base.animation, autoplay: overrides.autoplay }
        : base.animation,
  }
}

export function validateImagingSuiteViews(): readonly string[] {
  const errors: string[] = []
  for (const sectionId of peripheralImagingSectionIds) {
    const spec = SUITE_VIEWS[sectionId]
    const where = `Suite view ${sectionId}`
    if (!spec) {
      errors.push(`${where} is missing.`)
      continue
    }
    if (!SUITE_MODES.includes(spec.mode)) errors.push(`${where} has an unknown mode ${spec.mode}.`)
    if (spec.litStop !== null && !isChainStopId(spec.litStop))
      errors.push(`${where} lights an unknown stop.`)
    if (spec.chainAnswer && spec.litStop !== null)
      errors.push(`${where} lights a stop while the pins are the answer.`)
    if (spec.lab) {
      const keys = new Set([...LAB_CONTROLS[spec.lab].map((control) => control.key), 'previous'])
      for (const binding of spec.bindings) {
        if (!keys.has(binding.control))
          errors.push(`${where} binds an unknown control ${binding.control}.`)
      }
      for (const key of spec.controls ?? []) {
        if (!keys.has(key)) errors.push(`${where} exposes an unknown control ${key}.`)
      }
    } else if (spec.bindings.length > 0 || spec.controls) {
      errors.push(`${where} binds controls without a lab.`)
    }
    for (const metric of spec.readouts ?? []) {
      if (!(metric in LAB_METRICS)) errors.push(`${where} prints an unknown readout ${metric}.`)
    }
    if (spec.layers.length === 0) errors.push(`${where} shows no layer.`)
    errors.push(...imagingLearnerCopyErrors(`${where} boundary`, spec.boundary))
  }
  return errors
}

const suiteViewErrors = validateImagingSuiteViews()
if (suiteViewErrors.length > 0) {
  throw new Error(`The imaging suite views are invalid:\n${suiteViewErrors.join('\n')}`)
}
