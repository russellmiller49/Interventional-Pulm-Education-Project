/**
 * Measurement-system distortions of an otherwise correct pressure waveform.
 *
 * These are the same transforms the live simulator applies, so an artifact shown in a teaching
 * figure and the same artifact selected at the bedside monitor distort the trace identically.
 *
 * Descriptions follow Ragosta & Kennedy, Textbook of Clinical Hemodynamics (3rd ed.), ch. 2,
 * Box 2.2 "Common Sources of Error or Inaccuracy in Hemodynamic Assessment".
 */

import { cyclicGaussian } from './waveformMorphology'
import type { DynamicResponseKind, FastFlushLineType } from './types'

export type PressureArtifactKind =
  | 'none'
  | 'overdamped'
  | 'underdamped'
  | 'catheter-whip'
  | 'wall-contact'
  | 'false-wedge'

export interface DynamicResponseState {
  readonly artifact: PressureArtifactKind
  readonly dampingRatio: number
  readonly naturalFrequencyHz: number
}

/**
 * Reference values for an adequate catheter-tubing-transducer response. Reproducing the pressure
 * waveform faithfully requires a system that responds across the roughly 0-20 cycles per second
 * present in the human pressure pulse.
 */
export const DYNAMIC_RESPONSE_REFERENCE = {
  /** Damping coefficient above which the system attenuates rapid pressure change. */
  overdampedAbove: 0.95,
  /** Damping coefficient below which the system resonates and overshoots. */
  underdampedBelow: 0.4,
  /** Damping that reproduces the signal without visible distortion. */
  optimalRangeLow: 0.6,
  optimalRangeHigh: 0.7,
  /** Upper bound of the frequency content in a human pressure pulse, in cycles per second. */
  signalBandwidthHz: 20,
} as const

export function isOverdamped(state: DynamicResponseState): boolean {
  return (
    state.artifact === 'overdamped' ||
    state.dampingRatio > DYNAMIC_RESPONSE_REFERENCE.overdampedAbove
  )
}

export function isUnderdamped(state: DynamicResponseState): boolean {
  return (
    state.artifact === 'underdamped' ||
    state.dampingRatio < DYNAMIC_RESPONSE_REFERENCE.underdampedBelow
  )
}

/**
 * Gain applied to the pulsatile component of the signal around its mean.
 *
 * Overdamping absorbs the pressure wave and falsely lowers peak pressures. Underdamping
 * resonates, overestimating peak pressure and underestimating the pressure nadir. Neither
 * changes the mean pressure appreciably — which is why a mean is more trustworthy than a
 * systolic or diastolic value on a system with poor dynamic response.
 */
export function pulsatileGainFor(state: DynamicResponseState): number {
  if (isOverdamped(state)) return 0.55
  if (isUnderdamped(state)) return 1.35
  return 1
}

/**
 * Resonant oscillation superimposed on an underdamped trace: the narrow spikes that overshoot
 * true pressure on the upstroke and undershoot it on the downstroke.
 */
export function ringArtifactMmHg(
  state: DynamicResponseState,
  timeSeconds: number,
  cardiacPhase?: number,
  pulsePressureMmHg = 20,
): number {
  if (!isUnderdamped(state)) return 0

  if (cardiacPhase !== undefined) {
    const phase = ((cardiacPhase % 1) + 1) % 1
    const ringAfter = (
      triggerPhase: number,
      duration: number,
      cycles: number,
      amplitude: number,
    ) => {
      const elapsed = (phase - triggerPhase + 1) % 1
      if (elapsed > duration) return 0
      const progress = elapsed / duration
      return amplitude * Math.exp(-4.2 * progress) * Math.sin(progress * Math.PI * 2 * cycles)
    }

    const boundedPulsePressure = Math.max(2, Math.min(100, pulsePressureMmHg))
    return (
      ringAfter(0.035, 0.14, 2.2, boundedPulsePressure * 0.16) +
      ringAfter(0.4, 0.18, 2.4, boundedPulsePressure * 0.1)
    )
  }

  return Math.sin(timeSeconds * Math.PI * 2 * state.naturalFrequencyHz) * 2.4
}

/**
 * Catheter whip, or fling: acceleration of the fluid column inside a catheter that is moving
 * rapidly, seen with balloon-tipped catheters in hyperdynamic hearts or with extraneous loops
 * in the pulmonary artery. It overestimates systolic and underestimates diastolic pressure.
 */
export function whipArtifactMmHg(
  state: DynamicResponseState,
  timeSeconds: number,
  cardiacPhase?: number,
  pulsePressureMmHg = 20,
): number {
  if (state.artifact !== 'catheter-whip') return 0
  if (cardiacPhase !== undefined) {
    const beatVariation = 0.82 + ((Math.floor(timeSeconds * 1.25) * 37) % 7) * 0.055
    const boundedPulsePressure = Math.max(4, Math.min(80, pulsePressureMmHg))
    const spike =
      boundedPulsePressure * 0.72 * beatVariation * cyclicGaussian(cardiacPhase, 0.085, 0.009)
    const motion = ringArtifactFromTrigger(
      cardiacPhase,
      0.08,
      0.12,
      3.1,
      boundedPulsePressure * 0.1,
    )
    return spike + motion
  }
  return cyclicGaussian((timeSeconds * 1.7) % 1, 0.18, 0.025) * 12
}

function ringArtifactFromTrigger(
  cardiacPhase: number,
  triggerPhase: number,
  duration: number,
  cycles: number,
  amplitude: number,
): number {
  const phase = ((cardiacPhase % 1) + 1) % 1
  const elapsed = (phase - triggerPhase + 1) % 1
  if (elapsed > duration) return 0
  const progress = elapsed / duration
  return amplitude * Math.exp(-5.2 * progress) * Math.sin(progress * Math.PI * 2 * cycles)
}

/**
 * Applies every measurement-system distortion to a single pressure sample.
 *
 * Wall contact damps the trace to a flat line, because the catheter tip is against a chamber
 * wall rather than sampling the blood pool.
 */
export function applyPressureArtifact({
  value,
  mean,
  state,
  timeSeconds,
  cardiacPhase,
  pulsePressureMmHg,
  gainAlreadyApplied = false,
}: {
  readonly value: number
  readonly mean: number
  readonly state: DynamicResponseState
  readonly timeSeconds: number
  readonly cardiacPhase?: number
  readonly pulsePressureMmHg?: number
  /** Prevents applying the same systolic/diastolic gain twice when endpoints are pre-distorted. */
  readonly gainAlreadyApplied?: boolean
}): number {
  if (state.artifact === 'wall-contact') return mean
  if (isOverdamped(state) && cardiacPhase !== undefined && pulsePressureMmHg !== undefined) {
    // A damped catheter still transmits a pressure pulse. Model a rounded early upstroke and
    // broader runoff instead of replacing the arterial family with a symmetric sine/Gaussian.
    const earlyShoulder = cyclicGaussian(cardiacPhase, 0.145, 0.065)
    const broadRunoff = cyclicGaussian(cardiacPhase, 0.285, 0.155)
    const smoothPulse = earlyShoulder * 0.46 + broadRunoff * 0.54
    const smoothPulseMean = Math.sqrt(2 * Math.PI) * (0.46 * 0.065 + 0.54 * 0.155)
    const amplitude = pulsePressureMmHg * (gainAlreadyApplied ? 1 : pulsatileGainFor(state))
    return mean + amplitude * (smoothPulse - smoothPulseMean)
  }
  const damped = gainAlreadyApplied ? value : mean + (value - mean) * pulsatileGainFor(state)
  return (
    damped +
    ringArtifactMmHg(state, timeSeconds, cardiacPhase, pulsePressureMmHg) +
    whipArtifactMmHg(state, timeSeconds, cardiacPhase, pulsePressureMmHg)
  )
}

/**
 * Qualitative fast-flush (square-wave) release response.
 *
 * Returns a normalized trace in [0, 1] where 0 is the resting baseline and 1 is the flush
 * plateau. The number of oscillations after release is the readable feature: an adequately
 * damped system settles after a small number of oscillations, an underdamped system rings on,
 * and an overdamped system creeps back without oscillating at all.
 */
export function fastFlushReleaseShape(
  response: DynamicResponseKind,
  /** Time after release, normalized so that 1 is the full displayed release window. */
  elapsed: number,
): number {
  if (elapsed <= 0) return 1
  if (response === 'overdamped') {
    // Sluggish, non-oscillatory return to baseline.
    return Math.exp(-3.1 * elapsed)
  }
  const decay = response === 'acceptable' ? 7.4 : 1.75
  const cycles = response === 'acceptable' ? 2.4 : 6
  return Math.exp(-decay * elapsed) * Math.cos(elapsed * Math.PI * 2 * cycles)
}

export const FAST_FLUSH_RISE_DURATION_SECONDS = 0.045
export const FAST_FLUSH_HOLD_DURATION_SECONDS = 0.68
export const FAST_FLUSH_LIVE_DURATION_SECONDS = 2.4
export const FAST_FLUSH_PRESSURE_MMHG = 300

/**
 * Pressure offset after the flush valve is released.
 *
 * Release is an event independent of cardiac phase. The first excursion is below the native
 * pressure baseline, followed by rapid alternating bounces. An acceptable system settles after
 * one to two small oscillations; an underdamped system rings longer; an overdamped system returns
 * slowly without crossing the baseline.
 */
export function fastFlushReleaseOffsetMmHg(
  lineType: FastFlushLineType,
  response: DynamicResponseKind,
  elapsedSeconds: number,
): number {
  if (elapsedSeconds < 0) return 0

  if (response === 'overdamped') {
    const amplitude = lineType === 'pulmonary-artery' ? 31 : 86
    return amplitude * Math.exp(-3.25 * elapsedSeconds)
  }

  const acceptable = response === 'acceptable'
  const amplitude = lineType === 'pulmonary-artery' ? (acceptable ? 6.5 : 17) : acceptable ? 19 : 48
  const decayPerSecond = acceptable ? 9.5 : 2.05
  const frequencyHz = acceptable ? 7.1 : 7.8
  return (
    -amplitude *
    Math.exp(-decayPerSecond * elapsedSeconds) *
    Math.cos(Math.PI * 2 * frequencyHz * elapsedSeconds)
  )
}

/**
 * Applies the line-specific square-wave event to an already generated native pressure sample.
 * The underlying cardiac waveform continues to advance during the maneuver, so it resumes at
 * the patient's actual cardiac phase rather than at a conveniently aligned new beat.
 */
export function applyFastFlushEvent({
  baselinePressureMmHg,
  lineType,
  response,
  elapsedSeconds,
}: {
  readonly baselinePressureMmHg: number
  readonly lineType: FastFlushLineType
  readonly response: DynamicResponseKind
  readonly elapsedSeconds: number
}): number {
  if (elapsedSeconds < 0) return baselinePressureMmHg
  if (elapsedSeconds < FAST_FLUSH_RISE_DURATION_SECONDS) {
    const progress = elapsedSeconds / FAST_FLUSH_RISE_DURATION_SECONDS
    return baselinePressureMmHg + (FAST_FLUSH_PRESSURE_MMHG - baselinePressureMmHg) * progress
  }
  if (elapsedSeconds < FAST_FLUSH_HOLD_DURATION_SECONDS) return FAST_FLUSH_PRESSURE_MMHG

  return (
    baselinePressureMmHg +
    fastFlushReleaseOffsetMmHg(
      lineType,
      response,
      elapsedSeconds - FAST_FLUSH_HOLD_DURATION_SECONDS,
    )
  )
}
