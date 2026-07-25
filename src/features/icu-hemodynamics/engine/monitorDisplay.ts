import type { HemodynamicWaveformSample } from './types'
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
