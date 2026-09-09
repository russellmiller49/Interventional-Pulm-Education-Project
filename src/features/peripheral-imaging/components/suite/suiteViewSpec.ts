import {
  LAB_CONTROLS,
  LAB_METRICS,
  labValue,
  labNumber,
  type LabValues,
} from '../../engine/labMetrics'
import { DEFAULT_GEOMETRY } from '../../lib/physics'
import { isChainStopId } from '../../content/imagingChain'
import type { SuiteInputs, SuiteViewSpec } from './types'

export const SUITE_MODES = [
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
] as const
export const SUITE_CAMERAS = [
  'suite',
  'beam',
  'anterior',
  'side',
  'head',
  'target',
  'room',
  'console',
] as const
export const SUITE_LAYERS = [
  'Airways',
  'Lungs',
  'Ribs and spine',
  'Thoracic envelope',
  'table',
  'gantry',
  'cone',
  'ray',
  'monitor',
  'staff',
  'barrier',
  'isodose',
  'fov',
  'planes',
  'probe',
  'fieldGenerator',
  'labels',
] as const

/** Bound values use precisely the lab engine's defaults and clamps; view defaults fill unbound inputs. */
export function resolveSuiteInputs(spec: SuiteViewSpec, values: LabValues): SuiteInputs {
  const n = (lab: Parameters<typeof labNumber>[0], key: string) =>
    labNumber(lab, {}, key, spec.sectionId)
  const result: { -readonly [K in keyof SuiteInputs]: SuiteInputs[K] } = {
    orbit: n('geometry', 'orbit'),
    tilt: n('geometry', 'tilt'),
    toolDepth: n('geometry', 'depth'),
    geometry: DEFAULT_GEOMETRY,
    fieldPercent: n('field', 'field'),
    crop: false,
    zoom: n('field', 'zoom'),
    focalSpotMm: 0.6,
    pulseRate: n('temporal', 'rate'),
    pulseWidthMs: n('temporal', 'width'),
    speedMmS: n('temporal', 'speed'),
    phase: 0,
    sweepDeg: n('dts', 'sweep'),
    planeDepth: n('dts', 'plane'),
    priorLayer: 'measured',
    orbitSpanDeg: 200,
    orbitProgress: 1,
    projectionCount: 24,
    acquisitionOrbit: n('acquisition', 'acquisitionOrbit'),
    offsetX: 0,
    offsetDepth: 0,
    toolFollowsAnatomy: true,
    displacement: 0,
    storedDisplacement:
      spec.lab === 'registration'
        ? labNumber('registration', values, 'previous', spec.sectionId)
        : 0,
    showStored: false,
    showCurrent: true,
    tipX: n('mpr', 'tipX'),
    tipY: n('mpr', 'tipY'),
    tipZ: n('mpr', 'tipZ'),
    axial: n('mpr', 'axial'),
    coronal: n('mpr', 'coronal'),
    sagittal: n('mpr', 'sagittal'),
    slab: false,
    probeAlong: 1,
    probeLateralMm: 0,
    transducerTurns: 1,
    probeState: 'probe',
    staffDistanceM: n('safety', 'distance'),
    barrier: false,
    kermaMgy: n('dose', 'kerma'),
    areaCm2: n('dose', 'area'),
    variant: spec.variant,
    ...spec.defaults,
  }
  for (const binding of spec.bindings) {
    if (!spec.lab) continue
    const value = labValue(spec.lab, values, binding.control, spec.sectionId)
    // Type compatibility is checked by suiteViewErrors; assignments preserve the public contract.
    Object.assign(result, {
      [binding.input]: typeof value === 'number' ? value * (binding.scale ?? 1) : value,
    })
  }
  return result
}

/** Data authors can call this at import time without loading any browser renderer. */
export function suiteViewErrors(spec: SuiteViewSpec): readonly string[] {
  const errors: string[] = []
  if (!(SUITE_MODES as readonly string[]).includes(spec.mode))
    errors.push(`Unknown suite mode: ${spec.mode}`)
  if (!(SUITE_CAMERAS as readonly string[]).includes(spec.camera))
    errors.push(`Unknown suite camera: ${spec.camera}`)
  for (const layer of spec.layers)
    if (!(SUITE_LAYERS as readonly string[]).includes(layer))
      errors.push(`Unknown suite layer: ${layer}`)
  if (spec.litStop !== null && !isChainStopId(spec.litStop))
    errors.push(`Unknown chain stop: ${spec.litStop}`)
  if (spec.chainAnswer && spec.litStop !== null)
    errors.push('A chain answer must have litStop: null')
  if (!spec.boundary.trim()) errors.push('A model boundary is required')
  if (!['fixed', 'mobile', 'generic'].includes(spec.variant))
    errors.push(`Unknown suite variant: ${spec.variant}`)
  if (!['beside', 'below', 'hidden'].includes(spec.monitor))
    errors.push(`Unknown monitor layout: ${spec.monitor}`)
  const controls = spec.lab ? LAB_CONTROLS[spec.lab] : undefined
  if (spec.lab && !controls) errors.push(`Unknown lab: ${spec.lab}`)
  const inputs = resolveSuiteInputs({ ...spec, bindings: [], lab: undefined }, {})
  for (const binding of spec.bindings) {
    const control = controls?.find((c) => c.key === binding.control)
    const storedRegistration = spec.lab === 'registration' && binding.control === 'previous'
    if (!control && !storedRegistration) errors.push(`Unknown binding control: ${binding.control}`)
    if (!(binding.input in inputs)) errors.push(`Unknown suite input: ${binding.input}`)
    if (binding.scale !== undefined && !Number.isFinite(binding.scale))
      errors.push(`Invalid binding scale: ${binding.control}`)
    if (control || storedRegistration) {
      const value = labValue(spec.lab!, {}, binding.control, spec.sectionId)
      if (typeof value !== typeof inputs[binding.input])
        errors.push(`Binding type differs: ${binding.control} → ${binding.input}`)
    }
  }
  for (const key of spec.controls ?? [])
    if (!controls?.some((c) => c.key === key)) errors.push(`Unknown visible control: ${key}`)
  for (const metric of spec.readouts ?? [])
    if (!(metric in LAB_METRICS)) errors.push(`Unknown readout: ${metric}`)
  return errors
}
