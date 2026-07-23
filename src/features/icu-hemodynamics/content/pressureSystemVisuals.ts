import {
  PULMONARY_ARTERY_MEAN_FRACTION,
  PULMONARY_ARTERY_SHAPE,
  pulsatilePressureShape,
  SYSTEMIC_ARTERIAL_MEAN_FRACTION,
  SYSTEMIC_ARTERIAL_SHAPE,
} from '../engine/waveformMorphology'
import {
  applyFastFlushEvent,
  FAST_FLUSH_HOLD_DURATION_SECONDS,
  FAST_FLUSH_PRESSURE_MMHG as SHARED_FAST_FLUSH_PRESSURE_MMHG,
  FAST_FLUSH_RISE_DURATION_SECONDS,
} from '../engine/waveformArtifacts'
import type { DynamicResponseKind, FastFlushLineType } from '../engine/types'

export type { DynamicResponseKind, FastFlushLineType } from '../engine/types'

export const HYDROSTATIC_PRESSURE_MMHG_PER_CM = 0.74

export interface DynamicResponseDefinition {
  readonly id: DynamicResponseKind
  readonly label: string
  readonly shortLabel: string
  readonly observation: string
  readonly interpretation: string
  readonly pressureEffect: string
  readonly artifact: 'none' | 'overdamped' | 'underdamped'
}

export const dynamicResponseDefinitions: readonly DynamicResponseDefinition[] = [
  {
    id: 'acceptable',
    label: 'Acceptable dynamic response',
    shortLabel: 'Acceptable',
    observation:
      'Prompt return with one or two small oscillations that decay rapidly into the pulsatile waveform.',
    interpretation: 'The monitoring system reproduces the pressure signal without obvious damping.',
    pressureEffect: 'Systolic, diastolic, and pulse-pressure morphology are not visibly distorted.',
    artifact: 'none',
  },
  {
    id: 'overdamped',
    label: 'Overdamped response',
    shortLabel: 'Overdamped',
    observation:
      'Sluggish return with a rounded transition and no meaningful ringing, followed by a blunted pulsatile waveform.',
    interpretation: 'The monitoring system attenuates rapid pressure changes.',
    pressureEffect:
      'Systolic pressure reads low, diastolic pressure reads high, pulse pressure narrows, and mean pressure is relatively preserved.',
    artifact: 'overdamped',
  },
  {
    id: 'underdamped',
    label: 'Underdamped response',
    shortLabel: 'Underdamped',
    observation:
      'Several oscillations persist after release; each is sharp and smaller than the last before the pulsatile waveform resumes.',
    interpretation: 'The monitoring system resonates and exaggerates rapid pressure changes.',
    pressureEffect:
      'Systolic pressure reads high, diastolic pressure reads low, pulse pressure widens, and mean pressure is relatively preserved.',
    artifact: 'underdamped',
  },
] as const

export const dynamicResponseChallenges = [
  { id: 'response-a', label: 'Response A', response: 'underdamped' },
  { id: 'response-b', label: 'Response B', response: 'acceptable' },
  { id: 'response-c', label: 'Response C', response: 'overdamped' },
] as const

export type DynamicResponseChallengeId = (typeof dynamicResponseChallenges)[number]['id']

export function getDynamicResponseDefinition(
  response: DynamicResponseKind,
): DynamicResponseDefinition {
  const definition = dynamicResponseDefinitions.find((candidate) => candidate.id === response)
  if (!definition) throw new Error(`Unknown dynamic-response definition: ${response}`)
  return definition
}

export function getDynamicResponseChallenge(challengeId: DynamicResponseChallengeId) {
  const challenge = dynamicResponseChallenges.find((candidate) => candidate.id === challengeId)
  if (!challenge) throw new Error(`Unknown dynamic-response challenge: ${challengeId}`)
  return challenge
}

export function classifyDynamicResponse(measurementSystem: {
  readonly artifact: string
  readonly dampingRatio: number
}): DynamicResponseKind {
  if (measurementSystem.artifact === 'overdamped' || measurementSystem.dampingRatio > 0.95) {
    return 'overdamped'
  }
  if (measurementSystem.artifact === 'underdamped' || measurementSystem.dampingRatio < 0.4) {
    return 'underdamped'
  }
  return 'acceptable'
}

export function hydrostaticPressureOffsetMmHg(transducerLevelCm: number): number {
  if (transducerLevelCm === 0) return 0
  return -transducerLevelCm * HYDROSTATIC_PRESSURE_MMHG_PER_CM
}

export function formatSignedPressure(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} mmHg`
}

export interface FastFlushLineDefinition {
  readonly id: FastFlushLineType
  readonly label: string
  readonly shortLabel: string
  readonly systolicMmHg: number
  readonly diastolicMmHg: number
  readonly scaleMinimumMmHg: number
  readonly scaleMaximumMmHg: number
  readonly notchLabel: string
}

export const fastFlushLineDefinitions = {
  'pulmonary-artery': {
    id: 'pulmonary-artery',
    label: 'Pulmonary artery catheter',
    shortLabel: 'PA catheter',
    systolicMmHg: 25,
    diastolicMmHg: 10,
    scaleMinimumMmHg: 0,
    scaleMaximumMmHg: 40,
    notchLabel: 'pulmonic closure notch',
  },
  'systemic-arterial': {
    id: 'systemic-arterial',
    label: 'Systemic arterial line',
    shortLabel: 'Arterial line',
    systolicMmHg: 120,
    diastolicMmHg: 80,
    scaleMinimumMmHg: 40,
    scaleMaximumMmHg: 160,
    notchLabel: 'aortic closure notch',
  },
} satisfies Record<FastFlushLineType, FastFlushLineDefinition>

export type FastFlushSegment = 'baseline' | 'flush-rise' | 'flush-plateau' | 'release'

export interface FastFlushWaveformSample {
  readonly timeSeconds: number
  readonly cardiacPhase: number
  readonly pressureMmHg: number
  readonly segment: FastFlushSegment
}

export interface FastFlushWaveform {
  readonly lineType: FastFlushLineType
  readonly response: DynamicResponseKind
  readonly samples: readonly FastFlushWaveformSample[]
  readonly durationSeconds: number
  readonly flushStartSeconds: number
  readonly releaseSeconds: number
  readonly flushPressureMmHg: number
  readonly line: FastFlushLineDefinition
}

export const FAST_FLUSH_HEART_RATE_BPM = 75
export const FAST_FLUSH_CYCLE_SECONDS = 60 / FAST_FLUSH_HEART_RATE_BPM
export const FAST_FLUSH_DURATION_SECONDS = 5.2
// The valve is released between beats on purpose. The release response must not be phase-aligned
// to a convenient new systole.
export const FAST_FLUSH_START_SECONDS = FAST_FLUSH_CYCLE_SECONDS * 1.875
export const FAST_FLUSH_PLATEAU_START_SECONDS =
  FAST_FLUSH_START_SECONDS + FAST_FLUSH_RISE_DURATION_SECONDS
export const FAST_FLUSH_RELEASE_SECONDS =
  FAST_FLUSH_START_SECONDS + FAST_FLUSH_HOLD_DURATION_SECONDS
export const FAST_FLUSH_PRESSURE_MMHG = SHARED_FAST_FLUSH_PRESSURE_MMHG

const FAST_FLUSH_SAMPLE_RATE_HZ = 150

function cyclicGaussian(phase: number, center: number, width: number): number {
  const wrapped = ((phase % 1) + 1) % 1
  const raw = Math.abs(wrapped - center)
  const distance = Math.min(raw, 1 - raw)
  return Math.exp(-0.5 * (distance / width) ** 2)
}

function lineShape(lineType: FastFlushLineType, cardiacPhase: number): number {
  return pulsatilePressureShape(
    cardiacPhase,
    lineType === 'pulmonary-artery' ? PULMONARY_ARTERY_SHAPE : SYSTEMIC_ARTERIAL_SHAPE,
  )
}

function lineMeanFraction(lineType: FastFlushLineType): number {
  return lineType === 'pulmonary-artery'
    ? PULMONARY_ARTERY_MEAN_FRACTION
    : SYSTEMIC_ARTERIAL_MEAN_FRACTION
}

function eventRinging(
  lineType: FastFlushLineType,
  cardiacPhase: number,
  response: DynamicResponseKind,
): number {
  if (response !== 'underdamped') return 0
  const line = fastFlushLineDefinitions[lineType]
  const pulsePressure = line.systolicMmHg - line.diastolicMmHg
  const ringAfter = (trigger: number, duration: number, cycles: number, amplitude: number) => {
    const elapsed = (cardiacPhase - trigger + 1) % 1
    if (elapsed > duration) return 0
    const progress = elapsed / duration
    return amplitude * Math.exp(-4.5 * progress) * Math.sin(progress * Math.PI * 2 * cycles)
  }
  return (
    pulsePressure * 0.18 * cyclicGaussian(cardiacPhase, 0.085, 0.012) +
    ringAfter(0.055, 0.17, 2.4, pulsePressure * 0.14) +
    ringAfter(lineType === 'pulmonary-artery' ? 0.45 : 0.4, 0.19, 2.5, pulsePressure * 0.1)
  )
}

export function fastFlushBaselinePressureMmHg(
  lineType: FastFlushLineType,
  response: DynamicResponseKind,
  cardiacPhase: number,
): number {
  const line = fastFlushLineDefinitions[lineType]
  const pulsePressure = line.systolicMmHg - line.diastolicMmHg
  const mean = line.diastolicMmHg + pulsePressure * lineMeanFraction(lineType)
  const clean = line.diastolicMmHg + pulsePressure * lineShape(lineType, cardiacPhase)

  if (response === 'overdamped') {
    // Causal smoothing preserves the fast-rise/slow-runoff arterial family while attenuating its
    // higher-frequency detail. It intentionally avoids the symmetric sine-wave appearance.
    const filteredShape =
      lineShape(lineType, cardiacPhase) * 0.43 +
      lineShape(lineType, cardiacPhase - 0.035) * 0.29 +
      lineShape(lineType, cardiacPhase - 0.075) * 0.18 +
      lineShape(lineType, cardiacPhase - 0.125) * 0.1
    const filtered = line.diastolicMmHg + pulsePressure * filteredShape
    return mean + (filtered - mean) * 0.55
  }
  if (response === 'underdamped') {
    return mean + (clean - mean) * 1.08 + eventRinging(lineType, cardiacPhase, response)
  }
  return clean
}

export function generateFastFlushWaveform(
  lineType: FastFlushLineType,
  response: DynamicResponseKind,
): FastFlushWaveform {
  const line = fastFlushLineDefinitions[lineType]
  const sampleCount = Math.ceil(FAST_FLUSH_DURATION_SECONDS * FAST_FLUSH_SAMPLE_RATE_HZ)
  const samples = Array.from({ length: sampleCount }, (_, index): FastFlushWaveformSample => {
    const timeSeconds = index / FAST_FLUSH_SAMPLE_RATE_HZ
    const cardiacPhase = (timeSeconds % FAST_FLUSH_CYCLE_SECONDS) / FAST_FLUSH_CYCLE_SECONDS
    const baseline = fastFlushBaselinePressureMmHg(lineType, response, cardiacPhase)

    if (timeSeconds < FAST_FLUSH_START_SECONDS) {
      return { timeSeconds, cardiacPhase, pressureMmHg: baseline, segment: 'baseline' }
    }
    if (timeSeconds < FAST_FLUSH_PLATEAU_START_SECONDS) {
      return {
        timeSeconds,
        cardiacPhase,
        pressureMmHg: applyFastFlushEvent({
          baselinePressureMmHg: baseline,
          lineType,
          response,
          elapsedSeconds: timeSeconds - FAST_FLUSH_START_SECONDS,
        }),
        segment: 'flush-rise',
      }
    }
    if (timeSeconds < FAST_FLUSH_RELEASE_SECONDS) {
      return {
        timeSeconds,
        cardiacPhase,
        pressureMmHg: FAST_FLUSH_PRESSURE_MMHG,
        segment: 'flush-plateau',
      }
    }
    const elapsedSeconds = timeSeconds - FAST_FLUSH_RELEASE_SECONDS
    return {
      timeSeconds,
      cardiacPhase,
      pressureMmHg: applyFastFlushEvent({
        baselinePressureMmHg: baseline,
        lineType,
        response,
        elapsedSeconds: timeSeconds - FAST_FLUSH_START_SECONDS,
      }),
      segment: 'release',
    }
  })

  return {
    lineType,
    response,
    samples,
    durationSeconds: FAST_FLUSH_DURATION_SECONDS,
    flushStartSeconds: FAST_FLUSH_START_SECONDS,
    releaseSeconds: FAST_FLUSH_RELEASE_SECONDS,
    flushPressureMmHg: FAST_FLUSH_PRESSURE_MMHG,
    line,
  }
}

function clampTraceY(value: number): number {
  return Math.max(7, Math.min(103, value))
}

/** Backward-compatible SVG path helper backed by the full pulsatile fast-flush model. */
export function fastFlushTracePath(
  response: DynamicResponseKind,
  lineType: FastFlushLineType = 'pulmonary-artery',
): string {
  const waveform = generateFastFlushWaveform(lineType, response)
  const { scaleMinimumMmHg, scaleMaximumMmHg } = waveform.line
  return waveform.samples
    .map((sample, index) => {
      const x = (sample.timeSeconds / waveform.durationSeconds) * 300
      const fraction =
        (sample.pressureMmHg - scaleMinimumMmHg) / (scaleMaximumMmHg - scaleMinimumMmHg)
      const y = clampTraceY(103 - fraction * 96)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export const levelingPressureTracePath =
  'M 0 66 C 12 66, 15 63, 19 44 C 23 22, 29 20, 35 34 C 42 49, 48 54, 56 54 C 64 54, 69 50, 76 50 C 83 50, 88 56, 96 60 C 108 66, 117 66, 128 66 C 140 66, 143 63, 147 44 C 151 22, 157 20, 163 34 C 170 49, 176 54, 184 54 C 192 54, 197 50, 204 50 C 211 50, 216 56, 224 60 C 236 66, 246 66, 258 66 C 270 66, 273 63, 277 44 C 281 22, 287 20, 293 34 C 300 49, 306 54, 314 54 C 322 54, 327 50, 334 50 C 341 50, 346 56, 354 60 C 366 66, 376 66, 388 66'
