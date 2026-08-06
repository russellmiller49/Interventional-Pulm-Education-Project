/**
 * Display selectors for the live MCS teaching panels.
 *
 * Everything here reads state the engine already produced. Nothing here computes physiology: there
 * is no second model, no re-derivation of a number that `deriveMcsMetrics` already returned, and no
 * diagnosis inferred from a single reading. What these functions do is choose which values a figure
 * needs, subtract two readings the runtime already holds, classify the direction of that difference
 * against an authored display deadband, organize topology, and say when a value is not modeled.
 *
 * The deadbands are the reason this file exists at all. The reducer advances modeled time by one
 * fixed step on every control change, and the workspace ticks continuously, so two readings taken a
 * few seconds apart differ slightly even when the learner did nothing. Measured against the engine,
 * that idle drift is up to 6 mm Hg of mean pressure, 5 mL of end-diastolic volume, 0.11 L/min of
 * flow and 0.1 of the pulmonary pulsatility ratio. A panel that called any of that a response to the
 * learner's action would be lying. Each deadband below is set above the drift for its quantity and
 * below the change the section's own authored action produces, and every raw value either side of a
 * deadband is printed, so the word never replaces the numbers.
 */

import { deriveIabpCycleState } from '../../engine/model'
import type {
  McsAlarm,
  McsDerivedMetrics,
  McsSimulationState,
  McsTrendSample,
  McsWaveformSample,
} from '../../engine/types'

/* ------------------------------------------------------------------ *
 * Value kinds
 * ------------------------------------------------------------------ */

/**
 * What kind of quantity a number on a panel is.
 *
 * Deliberately has no `measured` member. Nothing in this simulation puts a probe in a bloodstream,
 * and the module's own source layer never uses that word for an engine value, so the type makes the
 * claim unavailable rather than relying on an author to avoid it.
 */
export type McsLiveValueKind =
  | 'displayed'
  | 'estimated'
  | 'modeled'
  | 'derived'
  | 'reasoned'
  | 'not-available'
  | 'not-modeled'

export const mcsLiveValueKindLabels: Readonly<Record<McsLiveValueKind, string>> = {
  displayed: 'directly displayed',
  estimated: 'estimated',
  modeled: 'modeled',
  derived: 'derived',
  reasoned: 'reasoned',
  'not-available': 'not available',
  'not-modeled': 'not modeled',
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/** A number, or the words for its absence. Never NaN, never Infinity, never an empty cell. */
export function reading(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'not available'
  return value.toFixed(digits)
}

export function readingWithUnit(
  value: number | null | undefined,
  unit: string,
  digits = 1,
): string {
  const text = reading(value, digits)
  return text === 'not available' || !unit ? text : `${text} ${unit}`
}

export function isReported(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

/* ------------------------------------------------------------------ *
 * Direction, with a display deadband
 * ------------------------------------------------------------------ */

export type McsDirection = 'higher' | 'lower' | 'unchanged'

export const mcsDirectionWords: Readonly<Record<McsDirection, string>> = {
  higher: 'higher',
  lower: 'lower',
  unchanged: 'about the same',
}

/** Arrows are paired with these words everywhere, so direction never depends on colour or shape. */
export const mcsDirectionMarks: Readonly<Record<McsDirection, string>> = {
  higher: '▲',
  lower: '▼',
  unchanged: '=',
}

export function directionOf(delta: number, deadband: number): McsDirection {
  if (!Number.isFinite(delta)) return 'unchanged'
  if (delta > deadband) return 'higher'
  if (delta < -deadband) return 'lower'
  return 'unchanged'
}

/**
 * Display deadbands, per metric, in that metric's own unit.
 *
 * Set from the engine's measured idle drift rather than from a clinical tolerance. None of these is
 * a threshold, a safety margin, or a limit of any kind, and every panel that uses one says so.
 */
export const MCS_DISPLAY_DEADBANDS: Readonly<Partial<Record<keyof McsDerivedMetrics, number>>> = {
  // The largest of them all, and the one worth knowing about: this engine's mean arterial pressure
  // carries a within-beat ripple of up to about 8 mm Hg, because a quarter of it is taken from the
  // instantaneous arterial compartment pressure. Two readings taken at different points in the beat
  // differ by that much with nothing having happened, so the band has to cover it — and every panel
  // that shows a mean pressure says so where a learner reads the comparison.
  mapMmHg: 8,
  pulsePressureMmHg: 1.5,
  rapMmHg: 1.5,
  pcwpMmHg: 1.5,
  lvedpMmHg: 1.5,
  lvedvMl: 5.5,
  papSystolicMmHg: 2,
  papDiastolicMmHg: 2,
  papi: 0.25,
  nativeFlowLMin: 0.2,
  leftDeviceFlowLMin: 0.4,
  rightDeviceFlowLMin: 0.3,
  deviceFlowLMin: 0.4,
  effectiveSystemicFlowLMin: 0.25,
  recirculatingFlowLMin: 0.2,
  pumpBalanceLMin: 0.4,
  svo2Percent: 1.5,
  cardiacPowerOutputW: 0.1,
  timingQualityPercent: 2,
  pumpPowerW: 0.3,
  pulsatilityIndex: 0.35,
}

/**
 * The largest idle movement each of these quantities shows with nothing done to the model.
 *
 * Measured against the reducer across the nine authored starting states and a range of sampling
 * offsets, then used to set the bands above. Kept here so that the numbers behind the bands are
 * inspectable rather than folklore, and so a test can assert the relationship still holds.
 */
export const MCS_MEASURED_IDLE_DRIFT: Readonly<Partial<Record<keyof McsDerivedMetrics, number>>> = {
  mapMmHg: 8,
  pulsePressureMmHg: 1,
  rapMmHg: 1,
  pcwpMmHg: 1,
  lvedvMl: 5,
  papi: 0.2,
  nativeFlowLMin: 0.14,
  leftDeviceFlowLMin: 0.34,
  deviceFlowLMin: 0.34,
  effectiveSystemicFlowLMin: 0.2,
  svo2Percent: 1,
  cardiacPowerOutputW: 0.07,
  timingQualityPercent: 0,
  pumpPowerW: 0.2,
  pulsatilityIndex: 0.3,
}

export function deadbandFor(metric: keyof McsDerivedMetrics): number {
  return MCS_DISPLAY_DEADBANDS[metric] ?? 0
}

export interface McsBeforeAfterReading {
  readonly metric: keyof McsDerivedMetrics
  readonly label: string
  readonly unit: string
  readonly digits: number
  readonly kind: McsLiveValueKind
  readonly before: number | null
  readonly current: number | null
  readonly direction: McsDirection
  /** True when there is no baseline to compare against yet. */
  readonly baselineMissing: boolean
}

export interface McsBeforeAfterRequest {
  readonly metric: keyof McsDerivedMetrics
  readonly label: string
  readonly unit: string
  readonly digits?: number
  readonly kind: McsLiveValueKind
}

/**
 * Two readings the runtime already holds, and the direction between them.
 *
 * The baseline is the snapshot `McsLearnSection` captured on entering the act phase. It is passed in
 * rather than captured here, because a second baseline taken at a second moment is a second story
 * about what the learner did.
 */
export function beforeAfterReadings(
  requests: readonly McsBeforeAfterRequest[],
  before: McsDerivedMetrics | null,
  current: McsDerivedMetrics,
): readonly McsBeforeAfterReading[] {
  return requests.map((request) => {
    const beforeValue = before ? before[request.metric] : null
    const currentValue = current[request.metric]
    const beforeNumber = typeof beforeValue === 'number' ? beforeValue : null
    const currentNumber = typeof currentValue === 'number' ? currentValue : null
    const comparable = isReported(beforeNumber) && isReported(currentNumber)
    return {
      metric: request.metric,
      label: request.label,
      unit: request.unit,
      digits: request.digits ?? 1,
      kind: request.kind,
      before: beforeNumber,
      current: currentNumber,
      direction: comparable
        ? directionOf(currentNumber - beforeNumber, deadbandFor(request.metric))
        : 'unchanged',
      baselineMissing: !isReported(beforeNumber),
    }
  })
}

/* ------------------------------------------------------------------ *
 * The flow account
 * ------------------------------------------------------------------ */

export type McsDeviceFlowPresentation = 'none-reported' | 'single-pump' | 'left-and-right'

export interface McsFlowAccountLineView {
  readonly id: 'native' | 'device' | 'right-pulmonary' | 'effective' | 'recirculating'
  readonly label: string
  readonly valueText: string
  readonly value: number | null
  readonly kind: McsLiveValueKind
  /** What the number is a flow *of*, so a line is never read as a total. */
  readonly destination: string
}

export interface McsFlowAccountView {
  readonly presentation: McsDeviceFlowPresentation
  readonly lines: readonly McsFlowAccountLineView[]
  readonly native: number
  readonly effective: number
  readonly leftDevice: number
  readonly rightDevice: number
  readonly recirculating: number
  /** The largest single line, so bars can be scaled without stacking them. */
  readonly scaleLMin: number
}

export function flowAccountView(state: McsSimulationState): McsFlowAccountView {
  const metrics = state.metrics
  const impella = state.device.kind === 'impella'
  const counterpulsation = state.device.kind === 'iabp'
  const presentation: McsDeviceFlowPresentation = counterpulsation
    ? 'none-reported'
    : impella
      ? 'left-and-right'
      : 'single-pump'

  const lines: McsFlowAccountLineView[] = [
    {
      id: 'native',
      label: 'Native contribution',
      valueText: `${reading(metrics.nativeFlowLMin, 1)} L/min`,
      value: metrics.nativeFlowLMin,
      kind: 'modeled',
      destination: 'ejected by the patient’s own ventricle',
    },
  ]

  if (presentation === 'none-reported') {
    lines.push({
      id: 'device',
      label: 'Displayed device contribution',
      valueText: 'none reported',
      value: null,
      kind: 'not-available',
      destination: 'no pathway of its own on this mechanism',
    })
  } else if (presentation === 'left-and-right') {
    lines.push({
      id: 'device',
      label: 'Left-sided pump flow',
      valueText: `${reading(metrics.leftDeviceFlowLMin, 1)} L/min`,
      value: metrics.leftDeviceFlowLMin,
      kind: 'estimated',
      destination: 'left ventricle into the aorta',
    })
    lines.push({
      id: 'right-pulmonary',
      label: 'Right-sided pump flow',
      valueText: `${reading(metrics.rightDeviceFlowLMin, 1)} L/min`,
      value: metrics.rightDeviceFlowLMin,
      kind: 'estimated',
      destination: 'caval blood into the pulmonary artery — a delivery to the lung',
    })
  } else {
    lines.push({
      id: 'device',
      label: 'Displayed pump flow',
      valueText: `${reading(metrics.deviceFlowLMin, 1)} L/min`,
      value: metrics.deviceFlowLMin,
      kind: 'estimated',
      destination: 'left ventricular apex into the ascending aorta',
    })
  }

  lines.push({
    id: 'effective',
    label: 'Effective systemic delivery',
    valueText: `${reading(metrics.effectiveSystemicFlowLMin, 1)} L/min`,
    value: metrics.effectiveSystemicFlowLMin,
    kind: 'reasoned',
    destination: 'what reaches the systemic circulation once the pathway is accounted for',
  })

  if (metrics.recirculatingFlowLMin > 0) {
    lines.push({
      id: 'recirculating',
      label: 'Recirculating flow',
      valueText: `${reading(metrics.recirculatingFlowLMin, 1)} L/min`,
      value: metrics.recirculatingFlowLMin,
      kind: 'modeled',
      destination: 'returned across an incompetent aortic valve, counted out of the effective line',
    })
  }

  const scale = Math.max(1, ...lines.map((line) => (isReported(line.value) ? line.value : 0)))

  return {
    presentation,
    lines,
    native: metrics.nativeFlowLMin,
    effective: metrics.effectiveSystemicFlowLMin,
    leftDevice: metrics.leftDeviceFlowLMin,
    rightDevice: metrics.rightDeviceFlowLMin,
    recirculating: metrics.recirculatingFlowLMin,
    scaleLMin: scale,
  }
}

/* ------------------------------------------------------------------ *
 * Support topology
 * ------------------------------------------------------------------ */

export interface McsPathwayView {
  readonly id: string
  readonly source: string
  readonly activeComponent: string
  readonly destination: string
  readonly relationship: 'series' | 'parallel' | 'no-pathway'
  readonly relationshipLabel: string
  readonly chamberUnloaded: string
  readonly chamberOrBedLoaded: string
  readonly gasExchange: boolean
  readonly gasExchangeLabel: string
  readonly movesBlood: boolean
}

const iabpPathway: McsPathwayView = {
  id: 'iabp-counterpulsation',
  source: 'No source compartment',
  activeComponent: 'Balloon inside the descending thoracic aorta',
  destination: 'No destination compartment',
  relationship: 'no-pathway',
  relationshipLabel: 'Timing, not a pathway — the balloon displaces blood already in the aorta',
  chamberUnloaded: 'Left ventricle, indirectly, by lowering the pressure ejection opens against',
  chamberOrBedLoaded: 'Left ventricle itself, when inflation arrives before the valve has closed',
  gasExchange: false,
  gasExchangeLabel: 'No gas exchange',
  movesBlood: false,
}

const impellaLeftPathway: McsPathwayView = {
  id: 'impella-left-transvalvular',
  source: 'Left ventricle, inlet below the aortic valve',
  activeComponent: 'Microaxial pump across the aortic valve',
  destination: 'Ascending aorta, outlet above the valve',
  relationship: 'parallel',
  relationshipLabel: 'Parallel with native ejection — both leave the same ventricle',
  chamberUnloaded: 'Left ventricle, directly, by removing volume from it',
  chamberOrBedLoaded:
    'Right ventricle inherits the delivery requirement; the aorta takes the return',
  gasExchange: false,
  gasExchangeLabel: 'No gas exchange',
  movesBlood: true,
}

const impellaRightPathway: McsPathwayView = {
  id: 'impella-right-caval-to-pa',
  source: 'Inferior vena cava and right atrium',
  activeComponent: 'Microaxial pump across the tricuspid and pulmonic valves',
  destination: 'Pulmonary artery, bypassing the right ventricle',
  relationship: 'series',
  relationshipLabel: 'In series ahead of the left heart — its blood has not reached the body yet',
  chamberUnloaded: 'Right ventricle, directly, by taking venous return past it',
  chamberOrBedLoaded: 'Pulmonary vascular bed, and through it the left heart',
  gasExchange: false,
  gasExchangeLabel: 'No gas exchange — it delivers blood to the patient’s own lungs',
  movesBlood: true,
}

const lvadPathway: McsPathwayView = {
  id: 'durable-continuous-flow-lvad',
  source: 'Left ventricular apex, implanted inflow cannula',
  activeComponent: 'Implanted continuous-flow pump',
  destination: 'Ascending aorta, implanted outflow graft',
  relationship: 'parallel',
  relationshipLabel: 'Parallel with whatever the native ventricle still ejects',
  chamberUnloaded: 'Left ventricle, directly and continuously',
  chamberOrBedLoaded: 'Right ventricle, which must fill a pump that never stops asking',
  gasExchange: false,
  gasExchangeLabel: 'No gas exchange',
  movesBlood: true,
}

/** The pathways currently in place, in the order blood meets them. */
export function activePathways(state: McsSimulationState): readonly McsPathwayView[] {
  if (state.device.kind === 'iabp') return [iabpPathway]
  if (state.device.kind === 'lvad') return [lvadPathway]
  const pathways: McsPathwayView[] = []
  if (state.device.right.enabled) pathways.push(impellaRightPathway)
  if (state.device.left.enabled) pathways.push(impellaLeftPathway)
  return pathways.length > 0 ? pathways : [impellaLeftPathway]
}

export const mcsComparisonPathways = {
  iabp: iabpPathway,
  impellaLeft: impellaLeftPathway,
  impellaRight: impellaRightPathway,
  lvad: lvadPathway,
} as const

/* ------------------------------------------------------------------ *
 * Counterpulsation timing
 * ------------------------------------------------------------------ */

export interface McsIabpTimingView {
  readonly running: boolean
  readonly triggerSource: string
  readonly assistRatio: string
  readonly inflationOffsetMs: number
  readonly deflationOffsetMs: number
  /** Cycle fraction, 0–1, where inflation begins in the modeled beat. */
  readonly inflationPhase: number
  readonly deflationPhase: number
  /** Where the modeled trace places aortic-valve closure, i.e. the dicrotic notch. */
  readonly notchPhase: number
  readonly nextUpstrokePhase: number
  readonly assistedBeatNow: boolean
  readonly timingQualityPercent: number | null
  readonly inflationRelation: 'before the notch' | 'at the notch' | 'after the notch'
  readonly deflationRelation: 'before the next upstroke' | 'into the next upstroke'
}

/**
 * The modeled beat's landmarks, read from the same helper the waveform and the 3D balloon use.
 *
 * `0.42` is the cycle fraction the engine places aortic-valve closure at, and it is the zero point
 * the inflation offset is measured from — so the notch is not a second timing calculation, it is the
 * engine's own reference restated where a learner can see it.
 */
const MODELED_NOTCH_PHASE = 0.42
const MODELED_NEXT_UPSTROKE_PHASE = 1

export function iabpTimingView(state: McsSimulationState): McsIabpTimingView | null {
  if (state.device.kind !== 'iabp') return null
  const device = state.device
  const cycle = deriveIabpCycleState(state.timeSeconds, state.patient.heartRateBpm, device)
  const inflation = device.inflationOffsetMs
  const deflation = device.deflationOffsetMs
  return {
    running: device.running,
    triggerSource: device.triggerSource,
    assistRatio: `1:${device.assistRatio}`,
    inflationOffsetMs: inflation,
    deflationOffsetMs: deflation,
    inflationPhase: cycle.inflationStart,
    deflationPhase: Math.min(cycle.deflationEnd, 1.24),
    notchPhase: MODELED_NOTCH_PHASE,
    nextUpstrokePhase: MODELED_NEXT_UPSTROKE_PHASE,
    assistedBeatNow: cycle.assistedBeat,
    timingQualityPercent: state.metrics.timingQualityPercent,
    inflationRelation:
      inflation < -20 ? 'before the notch' : inflation > 20 ? 'after the notch' : 'at the notch',
    deflationRelation: deflation > 20 ? 'into the next upstroke' : 'before the next upstroke',
  }
}

/* ------------------------------------------------------------------ *
 * Traces
 * ------------------------------------------------------------------ */

export interface McsTraceView {
  readonly points: readonly { readonly x: number; readonly y: number }[]
  readonly minimum: number
  readonly maximum: number
}

/** A normalized trace, or null when the buffer has not produced enough samples to draw one. */
export function waveformTrace(
  samples: readonly McsWaveformSample[],
  read: (sample: McsWaveformSample) => number,
  maximumSamples = 240,
): McsTraceView | null {
  const window = samples.slice(-maximumSamples).filter((sample) => Number.isFinite(read(sample)))
  if (window.length < 8) return null
  const values = window.map(read)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum || 1
  const first = window[0].time
  const last = window[window.length - 1].time
  const duration = last - first || 1
  return {
    points: window.map((sample) => ({
      x: (sample.time - first) / duration,
      y: 1 - (read(sample) - minimum) / span,
    })),
    minimum,
    maximum,
  }
}

export function trendTrace(
  samples: readonly McsTrendSample[],
  read: (sample: McsTrendSample) => number,
): McsTraceView | null {
  const window = samples.filter((sample) => Number.isFinite(read(sample)))
  if (window.length < 3) return null
  const values = window.map(read)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum || 1
  const first = window[0].time
  const last = window[window.length - 1].time
  const duration = last - first || 1
  return {
    points: window.map((sample) => ({
      x: (sample.time - first) / duration,
      y: 1 - (read(sample) - minimum) / span,
    })),
    minimum,
    maximum,
  }
}

export type McsIabpLandmarkId = 'notch' | 'inflation' | 'deflation' | 'upstroke'

export interface McsIabpLandmark {
  readonly id: McsIabpLandmarkId
  readonly label: string
  /** Position across the drawn strip, 0–1. */
  readonly x: number
  readonly beatIndex: number
  readonly assistedBeat: boolean
}

export interface McsIabpStripView {
  readonly ecg: McsTraceView
  readonly arterial: McsTraceView
  readonly landmarks: readonly McsIabpLandmark[]
  /** One band per beat, so an assisted beat is distinguishable without relying on colour. */
  readonly beats: readonly {
    readonly index: number
    readonly start: number
    readonly end: number
    readonly assisted: boolean
  }[]
  readonly windowSeconds: number
}

const landmarkLabels: Readonly<Record<McsIabpLandmarkId, string>> = {
  notch: 'dicrotic notch — modeled aortic-valve closure',
  inflation: 'inflation begins',
  deflation: 'deflation complete',
  upstroke: 'next systolic upstroke',
}

/**
 * The ECG and arterial strip over the last few beats, with the balloon's own timing landmarks on it.
 *
 * The landmark positions are read from `deriveIabpCycleState` — the same helper that drives the
 * waveform and the 3D balloon — so this figure cannot drift away from what the trace is doing. The
 * notch sits at the cycle fraction the engine measures the inflation offset from, which is why it is
 * a restatement of the engine's own reference rather than a second timing calculation.
 *
 * Returns null while the buffer is too short to draw, so a caller renders a waiting state instead of
 * an empty figure.
 */
export function iabpStripView(
  state: McsSimulationState,
  timing: McsIabpTimingView,
  beats = 3,
): McsIabpStripView | null {
  const cycleSeconds = 60 / Math.max(25, state.patient.heartRateBpm)
  const windowSeconds = cycleSeconds * beats
  const last = state.waveforms[state.waveforms.length - 1]
  if (!last || !Number.isFinite(last.time)) return null
  const start = last.time - windowSeconds
  const window = state.waveforms.filter(
    (sample) =>
      sample.time >= start && Number.isFinite(sample.arterialMmHg) && Number.isFinite(sample.ecgMv),
  )
  if (window.length < 16) return null

  const normalize = (read: (sample: McsWaveformSample) => number): McsTraceView => {
    const values = window.map(read)
    const minimum = Math.min(...values)
    const maximum = Math.max(...values)
    const span = maximum - minimum || 1
    return {
      points: window.map((sample) => ({
        x: (sample.time - start) / windowSeconds,
        y: 1 - (read(sample) - minimum) / span,
      })),
      minimum,
      maximum,
    }
  }

  const firstBeat = Math.floor(start / cycleSeconds)
  const lastBeat = Math.floor(last.time / cycleSeconds)
  const landmarks: McsIabpLandmark[] = []
  const beatBands: {
    index: number
    start: number
    end: number
    assisted: boolean
  }[] = []
  const assistRatio = state.device.kind === 'iabp' ? state.device.assistRatio : 1

  for (let index = firstBeat; index <= lastBeat; index += 1) {
    const beatStart = index * cycleSeconds
    const assisted = index % assistRatio === 0
    beatBands.push({
      index,
      start: (beatStart - start) / windowSeconds,
      end: (beatStart + cycleSeconds - start) / windowSeconds,
      assisted,
    })
    const positions: readonly (readonly [McsIabpLandmarkId, number])[] = [
      ['notch', timing.notchPhase],
      ['inflation', timing.inflationPhase],
      ['deflation', timing.deflationPhase],
      ['upstroke', timing.nextUpstrokePhase],
    ]
    for (const [id, phase] of positions) {
      const x = (beatStart + phase * cycleSeconds - start) / windowSeconds
      if (x < 0 || x > 1) continue
      // Only assisted beats carry balloon landmarks; every beat carries the notch and the upstroke.
      if (!assisted && (id === 'inflation' || id === 'deflation')) continue
      landmarks.push({
        id,
        label: landmarkLabels[id],
        x,
        beatIndex: index,
        assistedBeat: assisted,
      })
    }
  }

  return {
    ecg: normalize((sample) => sample.ecgMv),
    arterial: normalize((sample) => sample.arterialMmHg),
    landmarks,
    beats: beatBands,
    windowSeconds,
  }
}

/** An SVG polyline path from a normalized trace. */
export function tracePath(trace: McsTraceView, width: number, height: number): string {
  return trace.points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${(point.x * width).toFixed(2)} ${(point.y * height).toFixed(2)}`,
    )
    .join(' ')
}

/* ------------------------------------------------------------------ *
 * Alarms
 * ------------------------------------------------------------------ */

const priorityRank: Readonly<Record<McsAlarm['priority'], number>> = {
  critical: 0,
  warning: 1,
  advisory: 2,
}

export const mcsAlarmPriorityWords: Readonly<Record<McsAlarm['priority'], string>> = {
  critical: 'critical priority',
  warning: 'warning priority',
  advisory: 'advisory priority',
}

export function activeAlarms(state: McsSimulationState): readonly McsAlarm[] {
  return [...state.alarms]
    .filter((alarm) => alarm.active)
    .sort((first, second) => priorityRank[first.priority] - priorityRank[second.priority])
}

export function hasAlarm(state: McsSimulationState, id: string): boolean {
  return state.alarms.some((alarm) => alarm.id === id && alarm.active)
}

/* ------------------------------------------------------------------ *
 * Device state, as words
 * ------------------------------------------------------------------ */

export const mcsImpellaLeftPositionWords: Readonly<Record<string, string>> = {
  correct: 'aligned — inlet in the ventricle, outlet in the aorta',
  'too-deep': 'too deep — the inlet has moved further into the ventricle',
  'too-shallow': 'too shallow — the inlet has withdrawn toward the valve',
}

export const mcsImpellaRightPositionWords: Readonly<Record<string, string>> = {
  correct: 'aligned — caval inlet, pulmonary-artery outlet',
  'inlet-too-high': 'inlet too high',
  'outlet-too-proximal': 'outlet too proximal',
  'too-distal': 'too distal',
}

export const mcsPurgeWords: Readonly<Record<string, string>> = {
  normal: 'no purge warning',
  'high-pressure': 'purge pressure high',
  'low-pressure': 'purge pressure low',
}

/**
 * One of the engine's own display signals, read rather than recomputed.
 *
 * `supportEffect.displaySignals` is where the model already publishes the quantities a console would
 * show — the pressure gradient across a pump, the suction flag, the placement state. Reading them
 * here is what keeps a panel from deriving a second version of a number the engine already stands
 * behind.
 */
export function displaySignalNumber(state: McsSimulationState, key: string): number | null {
  const value = state.supportEffect.displaySignals?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function displaySignalFlag(state: McsSimulationState, key: string): boolean {
  return state.supportEffect.displaySignals?.[key] === true
}

export interface McsImpellaView {
  readonly leftEnabled: boolean
  readonly leftRunning: boolean
  readonly leftLevel: number
  readonly leftVariant: string
  readonly leftPosition: string
  readonly leftPositionWords: string
  readonly leftPurge: string
  readonly leftPurgeWords: string
  readonly leftSuction: boolean
  readonly rightEnabled: boolean
  readonly rightRunning: boolean
  readonly rightLevel: number
  readonly rightPosition: string
  readonly rightPositionWords: string
  readonly rightPurge: string
  readonly rightPurgeWords: string
  readonly rightSuction: boolean
}

export function impellaView(state: McsSimulationState): McsImpellaView | null {
  if (state.device.kind !== 'impella') return null
  const { left, right } = state.device
  return {
    leftEnabled: left.enabled,
    leftRunning: left.running,
    leftLevel: left.performanceLevel,
    leftVariant: left.variant === '55' ? 'larger transvalvular pump' : 'transvalvular pump',
    leftPosition: left.position,
    leftPositionWords: mcsImpellaLeftPositionWords[left.position] ?? left.position,
    leftPurge: left.purgeState,
    leftPurgeWords: mcsPurgeWords[left.purgeState] ?? left.purgeState,
    leftSuction: hasAlarm(state, 'impella-left-suction'),
    rightEnabled: right.enabled,
    rightRunning: right.running,
    rightLevel: right.performanceLevel,
    rightPosition: right.position,
    rightPositionWords: mcsImpellaRightPositionWords[right.position] ?? right.position,
    rightPurge: right.purgeState,
    rightPurgeWords: mcsPurgeWords[right.purgeState] ?? right.purgeState,
    rightSuction: hasAlarm(state, 'impella-right-suction'),
  }
}

export interface McsLvadView {
  readonly running: boolean
  readonly speedRpm: number
  readonly powerConnected: boolean
  readonly controllerFault: boolean
  readonly highPowerPattern: boolean
  readonly pumpPowerW: number | null
  readonly pulsatilityIndex: number | null
  readonly displayedFlowLMin: number
}

export function lvadView(state: McsSimulationState): McsLvadView | null {
  if (state.device.kind !== 'lvad') return null
  const device = state.device
  return {
    running: device.running,
    speedRpm: device.speedRpm,
    powerConnected: device.powerConnected,
    controllerFault: device.controllerFault,
    highPowerPattern: device.suspectedPumpThrombosis,
    pumpPowerW: state.metrics.pumpPowerW,
    pulsatilityIndex: state.metrics.pulsatilityIndex,
    displayedFlowLMin: state.metrics.deviceFlowLMin,
  }
}

/* ------------------------------------------------------------------ *
 * Filling-pressure phenotype
 * ------------------------------------------------------------------ */

export type McsDominantProblem =
  | 'left-dominant'
  | 'right-dominant'
  | 'biventricular'
  | 'not-resolved'

export interface McsFillingProfileView {
  readonly rapMmHg: number
  readonly pcwpMmHg: number
  readonly ratio: number
  readonly dominant: McsDominantProblem
  readonly statement: string
}

/**
 * Which side the modeled filling pressures point at — as a reading of a relationship, never as a
 * device recommendation.
 *
 * The engine already produces both pressures; nothing is recomputed. The classification is the
 * relationship between them stated in words, and it has an explicit `not-resolved` branch, because a
 * profile that does not separate is a real answer and a forced one would be a fabricated diagnosis.
 * No panel turns this into a device choice: every one of them prints the four bedside questions that
 * the two numbers cannot answer beside it.
 */
export function fillingProfileView(state: McsSimulationState): McsFillingProfileView {
  const rap = state.metrics.rapMmHg
  const pcwp = state.metrics.pcwpMmHg
  const ratio = pcwp > 0 ? rap / pcwp : Number.POSITIVE_INFINITY
  const bothHigh = rap >= 15 && pcwp >= 20
  const rightDominant = rap >= 15 && ratio >= 0.85
  const leftDominant = pcwp >= 20 && ratio <= 0.6
  const dominant: McsDominantProblem = bothHigh
    ? 'biventricular'
    : rightDominant
      ? 'right-dominant'
      : leftDominant
        ? 'left-dominant'
        : 'not-resolved'
  const statement =
    dominant === 'right-dominant'
      ? 'Right atrial pressure is high relative to the wedge pressure. In this model that relationship reads as a delivery problem upstream of the left ventricle.'
      : dominant === 'left-dominant'
        ? 'The wedge pressure dominates the right atrial pressure. In this model that relationship reads as left-sided congestion.'
        : dominant === 'biventricular'
          ? 'Both filling pressures are raised together. In this model that relationship does not separate the two sides.'
          : 'These two pressures do not separate the two sides in this model. That is the reading, not a failure to read.'
  return { rapMmHg: rap, pcwpMmHg: pcwp, ratio, dominant, statement }
}

/* ------------------------------------------------------------------ *
 * Things this engine does not model
 * ------------------------------------------------------------------ */

export interface McsUnmodeledSignal {
  readonly id: string
  readonly label: string
  readonly whyItMatters: string
}

/** Named in one place so no panel can imply the engine answers at the organ level. */
export const MCS_UNMODELED_ORGAN_SIGNALS: readonly McsUnmodeledSignal[] = Object.freeze([
  {
    id: 'mentation',
    label: 'Mentation',
    whyItMatters: 'The earliest bedside sign that cerebral perfusion has changed.',
  },
  {
    id: 'urine-output',
    label: 'Urine output',
    whyItMatters: 'An hour-by-hour statement about renal perfusion that no screen value replaces.',
  },
  {
    id: 'lactate',
    label: 'Lactate trajectory',
    whyItMatters:
      'Whether delivery is keeping up with demand, over time rather than at an instant.',
  },
  {
    id: 'skin-perfusion',
    label: 'Skin perfusion and capillary refill',
    whyItMatters: 'A peripheral answer that can disagree with a preserved mean pressure.',
  },
  {
    id: 'renal-function',
    label: 'Renal and hepatic function',
    whyItMatters: 'Where sustained low delivery is eventually recorded.',
  },
  {
    id: 'organ-recovery',
    label: 'Organ recovery',
    whyItMatters:
      'The question support exists to buy time for, and the one it cannot answer itself.',
  },
])

export const MCS_OXYGEN_DELIVERY_BOUNDARY =
  'This simulation does not calculate whole-body oxygen delivery. Haemoglobin and arterial oxygen content are not modeled, so no oxygen-delivery figure exists here. The mixed venous saturation below is a modeled downstream balance signal — what the tissues left behind — and it is not a measurement of delivery.'

export const MCS_ESTIMATED_FLOW_BOUNDARY =
  'A displayed pump flow in this simulation is an estimate produced from pump behaviour and assumed loading, exactly as it is on the real controller. Nothing here reads blood with a probe.'
