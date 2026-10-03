import type { HemodynamicSimulationState, MeasurementSystemState } from './types'

/**
 * Where the measurement system changed while the monitor was drawing.
 *
 * The waveform buffer keeps a few seconds of samples. Moving the transducer, zeroing it or
 * repairing a line changes every sample generated afterwards and none generated before, so for a
 * sweep's length the strip holds two instruments' worth of trace. Joined up, the step between them
 * looks like something happened to the patient (report L2-06). A seam is the engine's own record of
 * that moment — display metadata only: nothing reads it to decide a pressure, a goal or a
 * measurement, and it carries no clinical meaning.
 */
export type WaveformDisplaySeamKind = 'transducer-height' | 'zero' | 'line-response'

export interface WaveformDisplaySeam {
  readonly kind: WaveformDisplaySeamKind
  /** The drawn channels the change reached. */
  readonly scope: 'all-pressure-lines' | 'systemic-arterial-line'
  /** Model time the change began; a control dragged through several values keeps one seam. */
  readonly fromSeconds: number
  readonly untilSeconds: number
}

/** A seam older than this has scrolled out of every sweep the monitor offers. */
const SEAM_RETENTION_SECONDS = 12
/** Successive changes of the same control closer than this are one adjustment, not several. */
const SEAM_COALESCE_SECONDS = 1

function sharedLineChanged(previous: MeasurementSystemState, next: MeasurementSystemState) {
  return {
    'transducer-height': previous.transducerLevelCm !== next.transducerLevelCm,
    zero: previous.zeroed !== next.zeroed,
    'line-response':
      previous.dampingRatio !== next.dampingRatio ||
      previous.naturalFrequencyHz !== next.naturalFrequencyHz ||
      previous.artifact !== next.artifact,
  } as const
}

function arterialLineChanged(previous: MeasurementSystemState, next: MeasurementSystemState) {
  const before = previous.arterialLine
  const after = next.arterialLine
  return (
    before?.dampingRatio !== after?.dampingRatio ||
    before?.naturalFrequencyHz !== after?.naturalFrequencyHz ||
    before?.artifact !== after?.artifact
  )
}

/**
 * Records a seam when — and only when — the samples drawn from now on differ from those already
 * on the strip. An action the reducer absorbed (a zero pressed twice, a level set to the value it
 * already had) changes no sample and so leaves no mark.
 */
export function withDisplaySeam(
  previous: HemodynamicSimulationState,
  next: HemodynamicSimulationState,
): HemodynamicSimulationState {
  const changed = sharedLineChanged(previous.measurementSystem, next.measurementSystem)
  const arterial = arterialLineChanged(previous.measurementSystem, next.measurementSystem)
  const kind: WaveformDisplaySeamKind | null = changed['transducer-height']
    ? 'transducer-height'
    : changed.zero
      ? 'zero'
      : changed['line-response'] || arterial
        ? 'line-response'
        : null
  if (kind === null) return next
  const scope: WaveformDisplaySeam['scope'] =
    kind === 'line-response' && arterial && !changed['line-response']
      ? 'systemic-arterial-line'
      : 'all-pressure-lines'
  const now = next.timeSeconds
  const retained = (previous.displaySeams ?? []).filter(
    (seam) => seam.untilSeconds >= now - SEAM_RETENTION_SECONDS,
  )
  const last = retained.at(-1)
  const seams =
    last &&
    last.kind === kind &&
    last.scope === scope &&
    now - last.untilSeconds <= SEAM_COALESCE_SECONDS
      ? [...retained.slice(0, -1), { ...last, untilSeconds: now }]
      : [...retained, { kind, scope, fromSeconds: now, untilSeconds: now }]
  return { ...next, displaySeams: seams }
}

export function displaySeamWords(seam: WaveformDisplaySeam): string {
  switch (seam.kind) {
    case 'transducer-height':
      return 'transducer height changed'
    case 'zero':
      return 'zero reference changed'
    case 'line-response':
      return seam.scope === 'systemic-arterial-line'
        ? 'arterial line response changed'
        : 'line response changed'
  }
}

/** The seams a channel should draw: arterial-only changes do not mark the other lines. */
export function displaySeamsFor(
  state: Pick<HemodynamicSimulationState, 'displaySeams'>,
  channel: 'systemic-arterial' | 'other-pressure',
): readonly WaveformDisplaySeam[] {
  return (state.displaySeams ?? []).filter(
    (seam) => seam.scope === 'all-pressure-lines' || channel === 'systemic-arterial',
  )
}
