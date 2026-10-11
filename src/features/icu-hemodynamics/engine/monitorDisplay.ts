import type { HemodynamicSimulationState, HemodynamicWaveformSample } from './types'
import { END_EXPIRATION_TOLERANCE_PHASE, respiratoryPhaseAt } from './simulation'
import { CARDIAC_PHASE } from './waveformMorphology'

export type PressureWaveformField = 'artMmHg' | 'cvpMmHg' | 'rvMmHg' | 'papMmHg' | 'pcwpMmHg'

export interface TracePressureMetrics {
  readonly systolic: number
  readonly diastolic: number
  readonly mean: number
}

export interface EndExpiratoryPressureCursor {
  readonly time: number
  readonly value: number
  readonly respiratoryPhase: number
  readonly cardiacPhase: number
}

/**
 * The c-wave base follows the small c-wave peak as the tracing returns toward its mean before the
 * x descent. This is the cardiac landmark used for the phase-specific CVP teaching cursor.
 */
export const RIGHT_ATRIAL_C_WAVE_BASE_PHASE = CARDIAC_PHASE.atrialCWave + 0.04

function circularPhaseDistance(first: number, second: number): number {
  const distance = Math.abs(first - second)
  return Math.min(distance, 1 - distance)
}

/**
 * Derives the numerical pressure readout from the most recent displayed cardiac cycle.
 * This keeps the rail synchronized with damping, respiratory variation, and the visible trace.
 */
export function recentTracePressureMetrics(
  samples: readonly HemodynamicWaveformSample[],
  field: PressureWaveformField,
  heartRateBpm: number,
): TracePressureMetrics | null {
  const latestTime = samples.at(-1)?.time
  if (latestTime === undefined || !Number.isFinite(heartRateBpm) || heartRateBpm <= 0) return null
  const cycleSeconds = 60 / heartRateBpm
  const recent = samples.filter((sample) => sample.time >= latestTime - cycleSeconds)
  if (recent.length === 0) return null
  const values = recent.map((sample) => sample[field]).filter(Number.isFinite)
  if (values.length === 0) return null
  return {
    systolic: Math.max(...values),
    diastolic: Math.min(...values),
    mean: values.reduce((total, value) => total + value, 0) / values.length,
  }
}

/**
 * Finds the latest displayed end-expiratory CVP sample at the base of the c wave.
 *
 * A rolling one-beat mean can fall anywhere in the respiratory cycle and is therefore not an
 * end-expiratory CVP. The latest respiratory boundary is selected first; only then is the sample
 * closest to the c-wave base chosen from that end-expiratory window.
 */
export function latestEndExpiratoryCvpCursor(
  samples: readonly HemodynamicWaveformSample[],
  heartRateBpm: number,
  respiratoryRateBpm: number,
): EndExpiratoryPressureCursor | null {
  const latestTime = samples.at(-1)?.time
  if (
    latestTime === undefined ||
    !Number.isFinite(heartRateBpm) ||
    heartRateBpm <= 0 ||
    !Number.isFinite(respiratoryRateBpm) ||
    respiratoryRateBpm <= 0
  ) {
    return null
  }

  const cardiacCycleSeconds = 60 / heartRateBpm
  const respiratoryCycleSeconds = 60 / respiratoryRateBpm
  const latestBoundary = Math.floor(latestTime / respiratoryCycleSeconds) * respiratoryCycleSeconds
  const halfWindowSeconds = END_EXPIRATION_TOLERANCE_PHASE * respiratoryCycleSeconds

  // Prefer the most recent complete end-expiratory window, but retain one prior boundary as a
  // fallback when the trace history starts inside the current window.
  for (const boundary of [latestBoundary, latestBoundary - respiratoryCycleSeconds]) {
    const candidates = samples.filter(
      (sample) =>
        sample.time >= boundary - halfWindowSeconds && sample.time <= boundary + halfWindowSeconds,
    )
    if (candidates.length === 0) continue

    const best = candidates.reduce((currentBest, candidate) => {
      const candidateRespiratoryPhase = respiratoryPhaseAt(candidate.time, respiratoryRateBpm)
      const bestRespiratoryPhase = respiratoryPhaseAt(currentBest.time, respiratoryRateBpm)
      const candidateCardiacPhase =
        (((candidate.time % cardiacCycleSeconds) + cardiacCycleSeconds) % cardiacCycleSeconds) /
        cardiacCycleSeconds
      const bestCardiacPhase =
        (((currentBest.time % cardiacCycleSeconds) + cardiacCycleSeconds) % cardiacCycleSeconds) /
        cardiacCycleSeconds
      const candidateScore =
        circularPhaseDistance(candidateCardiacPhase, RIGHT_ATRIAL_C_WAVE_BASE_PHASE) +
        circularPhaseDistance(candidateRespiratoryPhase, 0) * 2
      const bestScore =
        circularPhaseDistance(bestCardiacPhase, RIGHT_ATRIAL_C_WAVE_BASE_PHASE) +
        circularPhaseDistance(bestRespiratoryPhase, 0) * 2
      return candidateScore < bestScore ? candidate : currentBest
    })
    const respiratoryPhase = respiratoryPhaseAt(best.time, respiratoryRateBpm)
    const cardiacPhase =
      (((best.time % cardiacCycleSeconds) + cardiacCycleSeconds) % cardiacCycleSeconds) /
      cardiacCycleSeconds

    return {
      time: best.time,
      value: best.cvpMmHg,
      respiratoryPhase,
      cardiacPhase,
    }
  }

  return null
}

/* ------------------------------------------------------------------ *
 * The numbers the monitor prints
 * ------------------------------------------------------------------ */

/** Where a printed pressure came from, in the monitor's own terms. */
export type DisplayedPressureSampling =
  | 'recent-cardiac-cycle'
  | 'end-expiratory-c-wave-base'
  | 'model-estimate'

export interface DisplayedPressure {
  /** The integer the rail prints. */
  readonly displayedMmHg: number
  readonly sampling: DisplayedPressureSampling
}

export interface MonitorPressureReadouts {
  readonly arterial: {
    readonly systolicMmHg: number
    readonly diastolicMmHg: number
    readonly mean: DisplayedPressure
  }
  readonly rightAtrial: DisplayedPressure & {
    /** The cursor the rail marks on the CVP trace, when the window could be found. */
    readonly cursor: EndExpiratoryPressureCursor | null
  }
}

/**
 * One source for the pressures the bedside monitor shows.
 *
 * The rail does not print `state.measurements`. Its arterial numbers are the extrema and mean of
 * the most recent displayed cardiac cycle, and its central-venous number is the end-expiratory
 * sample at the base of the c wave — both derived from the drawn waveform, so they move with
 * damping and with respiration as the trace does. The model's own estimate is a fallback for the
 * moments before enough trace exists.
 *
 * `HD-PRE-REVIEW-01` added a decision-record adapter that described values as "displayed" while
 * reading the model estimate, and the two disagreed: on the capstone eight seconds in the rail
 * showed a mean arterial pressure of 69 and the record certified 68. Rather than reimplement the
 * rail's arithmetic a second time, both the monitor and the record read it from here, so a future
 * divergence would have to change what the monitor itself prints.
 *
 * Rounding is part of the answer: these are the integers on the screen, not the raw samples.
 */
/** The rail's rounding, including the one case where it matters: it never prints "-0". */
function printedInteger(value: number): number {
  const rounded = Math.round(value)
  return Object.is(rounded, -0) ? 0 : rounded
}

export function monitorPressureReadouts(
  state: HemodynamicSimulationState,
): MonitorPressureReadouts {
  const { measurements, parameters, waveforms } = state
  const arterialTrace = recentTracePressureMetrics(waveforms, 'artMmHg', measurements.heartRateBpm)
  const cursor = latestEndExpiratoryCvpCursor(
    waveforms,
    measurements.heartRateBpm,
    parameters.respiratoryRateBpm,
  )
  return {
    arterial: {
      systolicMmHg: printedInteger(arterialTrace?.systolic ?? measurements.artSystolicMmHg),
      diastolicMmHg: printedInteger(arterialTrace?.diastolic ?? measurements.artDiastolicMmHg),
      mean: {
        displayedMmHg: printedInteger(arterialTrace?.mean ?? measurements.mapMmHg),
        sampling: arterialTrace === null ? 'model-estimate' : 'recent-cardiac-cycle',
      },
    },
    rightAtrial: {
      displayedMmHg: printedInteger(cursor?.value ?? measurements.rapMmHg),
      sampling: cursor === null ? 'model-estimate' : 'end-expiratory-c-wave-base',
      cursor,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Axes and availability the monitor states, never infers
 * ------------------------------------------------------------------ */

export interface PressureAxis {
  readonly minimum: number
  readonly maximum: number
}

/** The largest offset the height and zero controls can add to or take from a displayed pressure. */
const REFERENCE_CONTROL_SPAN_MMHG = { below: 20 * 0.7355, above: 20 * 0.7355 + 5 } as const

/**
 * One axis for a whole reference comparison.
 *
 * The monitor normally fits each channel's axis to the pressure it is showing. In a demonstration
 * whose point is that a control moves every value by the same amount, that fitting is the problem:
 * lowering the transducer pushed the systolic value over the 0–40 axis' limit, the axis became
 * 0–80, and a pure offset was drawn as a waveform half the size (report L2-06). This returns the
 * axis that holds the demonstration's starting trace at every position of the height and zero
 * controls, so the axis never has to change and the shift is the only thing that moves.
 *
 * It is computed from the samples already on the strip, not from the model's estimate, so it
 * includes the respiratory swing the trace is actually drawn with.
 */
export function referenceComparisonAxis(
  baseline: Pick<HemodynamicSimulationState, 'waveforms'>,
  field: PressureWaveformField,
): PressureAxis | null {
  const values = baseline.waveforms.map((sample) => sample[field]).filter(Number.isFinite)
  if (values.length === 0) return null
  const lowest = Math.min(...values) - REFERENCE_CONTROL_SPAN_MMHG.below
  const highest = Math.max(...values) + REFERENCE_CONTROL_SPAN_MMHG.above
  return { minimum: Math.floor(lowest / 10) * 10, maximum: Math.ceil(highest / 10) * 10 }
}

/**
 * An axis fitted to the samples it is asked to show, with room above and below.
 *
 * Used for the enlarged still copy of a venous tracing. It is fitted to the data rather than chosen
 * from a list, so a raised right-atrial pressure is enlarged where it is instead of being cut off
 * by an axis sized for a normal one.
 */
export function fittedPressureAxis(values: readonly number[]): PressureAxis | null {
  const finite = values.filter(Number.isFinite)
  if (finite.length === 0) return null
  const lowest = Math.min(...finite)
  const highest = Math.max(...finite)
  const span = Math.max(4, highest - lowest)
  const step = span <= 10 ? 2 : span <= 25 ? 5 : span <= 60 ? 10 : 20
  const minimum = Math.floor((lowest - span * 0.15) / step) * step
  const maximum = Math.ceil((highest + span * 0.15) / step) * step
  return { minimum, maximum }
}

export interface MixedVenousAvailability {
  readonly available: boolean
  /** Why no value is shown. Empty when one is. */
  readonly reason: string
}

/**
 * Whether the distal lumen can yield a mixed-venous sample now, and if not, why.
 *
 * The rail said "not available before PA" for every unavailable state, including a tip that had
 * gone past the artery into an occluding position (report L9-04). No value is ever supplied for an
 * unavailable state; only the reason differs.
 */
export function mixedVenousAvailability(
  state: Pick<HemodynamicSimulationState, 'catheter'>,
): MixedVenousAvailability {
  const { position, targetPosition, balloonInflated } = state.catheter
  if (targetPosition !== null) {
    return { available: false, reason: 'not available while the tip is moving' }
  }
  if (position === 'wedge') {
    return {
      available: false,
      reason: balloonInflated
        ? 'no mixed-venous sample during a balloon occlusion'
        : 'no valid mixed-venous sample · tip in an occluding position',
    }
  }
  if (position === 'pa') {
    return balloonInflated
      ? { available: false, reason: 'no mixed-venous sample while the balloon is up' }
      : { available: true, reason: '' }
  }
  return { available: false, reason: 'not available before PA' }
}
