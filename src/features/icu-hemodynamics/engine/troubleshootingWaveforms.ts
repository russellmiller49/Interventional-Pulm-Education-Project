import type { ArtifactId } from '../content/troubleshootingAtlas'
import {
  PULMONARY_ARTERY_SHAPE,
  pulsatilePressureShape,
  wedgeDeviationMmHg,
} from './waveformMorphology'

export const TROUBLESHOOTING_HEART_RATE_BPM = 75
export const TROUBLESHOOTING_BEAT_SECONDS = 60 / TROUBLESHOOTING_HEART_RATE_BPM
export const TROUBLESHOOTING_BEAT_COUNT = 4
export const TROUBLESHOOTING_SAMPLE_RATE_HZ = 180
export const TROUBLESHOOTING_SCALE_MMHG = { minimum: 0, maximum: 40 } as const

const SAMPLES_PER_BEAT = Math.round(TROUBLESHOOTING_BEAT_SECONDS * TROUBLESHOOTING_SAMPLE_RATE_HZ)
const SAMPLE_COUNT = SAMPLES_PER_BEAT * TROUBLESHOOTING_BEAT_COUNT
const NORMAL_PA_DIASTOLIC_MMHG = 10
const NORMAL_PA_PULSE_PRESSURE_MMHG = 15

export type ZeroLevelMode =
  | 'transducer-too-low'
  | 'correctly-leveled'
  | 'transducer-too-high'
  | 'incorrect-zero'

export interface ZeroLevelOption {
  readonly id: ZeroLevelMode
  readonly label: string
  readonly offsetMmHg: number
  readonly explanation: string
}

export const zeroLevelOptions = {
  'transducer-too-low': {
    id: 'transducer-too-low',
    label: 'Transducer 10 cm too low',
    offsetMmHg: 7.5,
    explanation: 'The entire tracing shifts upward by approximately 7.5 mmHg.',
  },
  'correctly-leveled': {
    id: 'correctly-leveled',
    label: 'Correctly leveled and zeroed',
    offsetMmHg: 0,
    explanation: 'No hydrostatic or zero offset is applied.',
  },
  'transducer-too-high': {
    id: 'transducer-too-high',
    label: 'Transducer 10 cm too high',
    offsetMmHg: -7.5,
    explanation: 'The entire tracing shifts downward by approximately 7.5 mmHg.',
  },
  'incorrect-zero': {
    id: 'incorrect-zero',
    label: 'Incorrect zero (+5 mmHg)',
    offsetMmHg: 5,
    explanation: 'A constant +5 mmHg zero offset shifts every pressure upward.',
  },
} satisfies Record<ZeroLevelMode, ZeroLevelOption>

export interface TroubleshootingWaveformSample {
  readonly timeSeconds: number
  readonly beatIndex: number
  readonly cardiacPhase: number
  readonly pressureMmHg: number
}

export interface PressureMetrics {
  readonly systolicMmHg: number
  readonly diastolicMmHg: number
  readonly meanMmHg: number
  readonly pulsePressureMmHg: number
}

export type QualitativePressureEffect =
  | 'falsely high'
  | 'falsely low'
  | 'relatively preserved'
  | 'shifted high'
  | 'shifted low'
  | 'measuring a different compartment'
  | 'unreliable'

export interface ArtifactPressureEffects {
  readonly systolic: QualitativePressureEffect
  readonly diastolic: QualitativePressureEffect
  readonly mean: QualitativePressureEffect
  readonly pulsePressure: QualitativePressureEffect
}

export interface ArtifactWaveformOptions {
  readonly zeroLevelMode?: ZeroLevelMode
}

export interface ArtifactWaveformResult {
  readonly id: ArtifactId
  readonly samples: readonly TroubleshootingWaveformSample[]
  readonly beatMetrics: readonly PressureMetrics[]
  readonly metrics: PressureMetrics
  readonly effects: ArtifactPressureEffects
  readonly metricDisplay: 'derived' | 'unreliable' | 'different-compartment'
}

export type ArtifactWaveformTransform = (
  source: readonly TroubleshootingWaveformSample[],
  options?: ArtifactWaveformOptions,
) => readonly TroubleshootingWaveformSample[]

function wrapPhase(phase: number): number {
  return ((phase % 1) + 1) % 1
}

function cyclicGaussian(phase: number, center: number, width: number): number {
  const raw = Math.abs(wrapPhase(phase) - wrapPhase(center))
  const distance = Math.min(raw, 1 - raw)
  return Math.exp(-0.5 * (distance / width) ** 2)
}

function ringAfter(
  phase: number,
  triggerPhase: number,
  duration: number,
  cycles: number,
  amplitude: number,
  decay = 4.2,
): number {
  const elapsed = (wrapPhase(phase) - wrapPhase(triggerPhase) + 1) % 1
  if (elapsed > duration) return 0
  const progress = elapsed / duration
  return amplitude * Math.exp(-decay * progress) * Math.sin(progress * Math.PI * 2 * cycles)
}

export function normalPulmonaryArteryPressureMmHg(cardiacPhase: number): number {
  return (
    NORMAL_PA_DIASTOLIC_MMHG +
    NORMAL_PA_PULSE_PRESSURE_MMHG * pulsatilePressureShape(cardiacPhase, PULMONARY_ARTERY_SHAPE)
  )
}

function wedgePressureMmHg(cardiacPhase: number): number {
  return 12 + wedgeDeviationMmHg(cardiacPhase)
}

export function createNormalPulmonaryArteryWaveform(): readonly TroubleshootingWaveformSample[] {
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const beatIndex = Math.floor(index / SAMPLES_PER_BEAT)
    const cardiacPhase = (index % SAMPLES_PER_BEAT) / SAMPLES_PER_BEAT
    return {
      timeSeconds: index / TROUBLESHOOTING_SAMPLE_RATE_HZ,
      beatIndex,
      cardiacPhase,
      pressureMmHg: normalPulmonaryArteryPressureMmHg(cardiacPhase),
    }
  })
}

function replacePressures(
  source: readonly TroubleshootingWaveformSample[],
  pressures: readonly number[],
): readonly TroubleshootingWaveformSample[] {
  return source.map((sample, index) => ({ ...sample, pressureMmHg: pressures[index] }))
}

/**
 * Gaussian convolution is a true low-pass operation: it removes the notch and other
 * high-frequency detail before pulse-pressure attenuation is applied.
 */
function gaussianLowPass(
  source: readonly TroubleshootingWaveformSample[],
  sigmaSamples: number,
): readonly number[] {
  const radius = Math.ceil(sigmaSamples * 3)
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const offset = index - radius
    return Math.exp(-0.5 * (offset / sigmaSamples) ** 2)
  })
  const weightTotal = weights.reduce((total, weight) => total + weight, 0)

  return source.map((sample, index) => {
    const indexWithinBeat = index % SAMPLES_PER_BEAT
    const beatStart = sample.beatIndex * SAMPLES_PER_BEAT
    let total = 0
    for (let offset = -radius; offset <= radius; offset += 1) {
      const wrappedIndex = (indexWithinBeat + offset + SAMPLES_PER_BEAT) % SAMPLES_PER_BEAT
      total += source[beatStart + wrappedIndex].pressureMmHg * weights[offset + radius]
    }
    return total / weightTotal
  })
}

function overdampedTransform(
  source: readonly TroubleshootingWaveformSample[],
): readonly TroubleshootingWaveformSample[] {
  const smoothed = gaussianLowPass(source, 8.5)
  const mean = derivePressureMetrics(source).meanMmHg
  return replacePressures(
    source,
    smoothed.map((pressure) => mean + (pressure - mean) * 0.68),
  )
}

function underdampedTransform(
  source: readonly TroubleshootingWaveformSample[],
): readonly TroubleshootingWaveformSample[] {
  const mean = derivePressureMetrics(source).meanMmHg
  return source.map((sample) => {
    const amplified = mean + (sample.pressureMmHg - mean) * 1.1
    const systolicOvershoot =
      5.8 * cyclicGaussian(sample.cardiacPhase, 0.085, 0.013) +
      ringAfter(sample.cardiacPhase, 0.055, 0.18, 2.6, 4.6)
    const closureRinging =
      -3.8 * cyclicGaussian(sample.cardiacPhase, 0.465, 0.014) +
      ringAfter(sample.cardiacPhase, 0.45, 0.2, 2.7, -2.8)
    return {
      ...sample,
      pressureMmHg: amplified + systolicOvershoot + closureRinging,
    }
  })
}

function deterministicWhipAmplitude(beatIndex: number): number {
  const amplitudes = [9, 13, 10, 15] as const
  return amplitudes[beatIndex % amplitudes.length]
}

function catheterWhipTransform(
  source: readonly TroubleshootingWaveformSample[],
): readonly TroubleshootingWaveformSample[] {
  return source.map((sample) => {
    const amplitude = deterministicWhipAmplitude(sample.beatIndex)
    const spike = amplitude * cyclicGaussian(sample.cardiacPhase, 0.085, 0.009)
    const motion =
      ringAfter(sample.cardiacPhase, 0.08, 0.12, 3.2, amplitude * 0.18, 5.4) +
      (sample.beatIndex % 2 === 1 ? 1.4 * cyclicGaussian(sample.cardiacPhase, 0.41, 0.012) : 0)
    return { ...sample, pressureMmHg: sample.pressureMmHg + spike + motion }
  })
}

function wallContactAmount(sample: TroubleshootingWaveformSample): number {
  if (sample.beatIndex === 0) return 0
  if (sample.beatIndex === 1) {
    return sample.cardiacPhase >= 0.22 && sample.cardiacPhase <= 0.82 ? 0.94 : 0
  }
  if (sample.beatIndex === 2) return 0.97
  return sample.cardiacPhase < 0.34 ? 0.94 : 0
}

function wallContactTransform(
  source: readonly TroubleshootingWaveformSample[],
): readonly TroubleshootingWaveformSample[] {
  return source.map((sample) => {
    const contact = wallContactAmount(sample)
    const contactPressure = 15.5 + Math.sin(sample.cardiacPhase * Math.PI * 2) * 0.18
    return {
      ...sample,
      pressureMmHg: sample.pressureMmHg * (1 - contact) + contactPressure * contact,
    }
  })
}

function smoothStep(value: number): number {
  const bounded = Math.max(0, Math.min(1, value))
  return bounded * bounded * (3 - 2 * bounded)
}

function spontaneousWedgeTransform(
  source: readonly TroubleshootingWaveformSample[],
): readonly TroubleshootingWaveformSample[] {
  const transitionStart = TROUBLESHOOTING_BEAT_SECONDS * 1.18
  const transitionEnd = TROUBLESHOOTING_BEAT_SECONDS * 1.72
  return source.map((sample) => {
    const mix = smoothStep(
      (sample.timeSeconds - transitionStart) / (transitionEnd - transitionStart),
    )
    const wedge = wedgePressureMmHg(sample.cardiacPhase)
    return {
      ...sample,
      pressureMmHg: sample.pressureMmHg * (1 - mix) + wedge * mix,
    }
  })
}

function overwedgingTransform(
  source: readonly TroubleshootingWaveformSample[],
): readonly TroubleshootingWaveformSample[] {
  const wedgeStart = TROUBLESHOOTING_BEAT_SECONDS
  const pressureRiseStart = TROUBLESHOOTING_BEAT_SECONDS * 2
  const traceEnd = TROUBLESHOOTING_BEAT_SECONDS * TROUBLESHOOTING_BEAT_COUNT

  return source.map((sample) => {
    if (sample.timeSeconds < wedgeStart) return sample
    if (sample.timeSeconds < pressureRiseStart) {
      const mix = smoothStep(
        (sample.timeSeconds - wedgeStart) / (TROUBLESHOOTING_BEAT_SECONDS * 0.45),
      )
      const wedge = wedgePressureMmHg(sample.cardiacPhase)
      return {
        ...sample,
        pressureMmHg: sample.pressureMmHg * (1 - mix) + wedge * mix,
      }
    }

    const progress = Math.max(
      0,
      Math.min(1, (sample.timeSeconds - pressureRiseStart) / (traceEnd - pressureRiseStart)),
    )
    const residualAtrialWave = wedgeDeviationMmHg(sample.cardiacPhase) * (1 - progress) * 0.55
    return {
      ...sample,
      pressureMmHg: 13 + progress * 22 + residualAtrialWave,
    }
  })
}

function zeroLevelTransform(
  source: readonly TroubleshootingWaveformSample[],
  options: ArtifactWaveformOptions = {},
): readonly TroubleshootingWaveformSample[] {
  const mode = options.zeroLevelMode ?? 'transducer-too-low'
  const offset = zeroLevelOptions[mode].offsetMmHg
  return source.map((sample) => ({ ...sample, pressureMmHg: sample.pressureMmHg + offset }))
}

export const artifactTransforms = {
  overdamped: overdampedTransform,
  underdamped: underdampedTransform,
  'catheter-whip': catheterWhipTransform,
  'wall-contact': wallContactTransform,
  'spontaneous-wedge': spontaneousWedgeTransform,
  overwedging: overwedgingTransform,
  'zero-level': zeroLevelTransform,
} satisfies Record<ArtifactId, ArtifactWaveformTransform>

export function getArtifactWaveformTransform(id: string): ArtifactWaveformTransform {
  if (!Object.prototype.hasOwnProperty.call(artifactTransforms, id)) {
    throw new Error(`Unknown PA-catheter troubleshooting artifact: ${id}`)
  }
  return artifactTransforms[id as ArtifactId]
}

export function derivePressureMetrics(
  samples: readonly TroubleshootingWaveformSample[],
): PressureMetrics {
  if (samples.length === 0) {
    throw new Error('Cannot derive pressure metrics from an empty waveform.')
  }
  const pressures = samples.map((sample) => sample.pressureMmHg)
  const systolicMmHg = Math.max(...pressures)
  const diastolicMmHg = Math.min(...pressures)
  // Samples are uniformly spaced, so this is rectangular numerical integration divided by time.
  const meanMmHg = pressures.reduce((total, pressure) => total + pressure, 0) / pressures.length
  return {
    systolicMmHg,
    diastolicMmHg,
    meanMmHg,
    pulsePressureMmHg: systolicMmHg - diastolicMmHg,
  }
}

export function deriveBeatPressureMetrics(
  samples: readonly TroubleshootingWaveformSample[],
): readonly PressureMetrics[] {
  return Array.from({ length: TROUBLESHOOTING_BEAT_COUNT }, (_, beatIndex) =>
    derivePressureMetrics(samples.filter((sample) => sample.beatIndex === beatIndex)),
  )
}

function compareMetric(
  artifactValue: number,
  normalValue: number,
  threshold = 1,
): QualitativePressureEffect {
  const difference = artifactValue - normalValue
  if (difference > threshold) return 'falsely high'
  if (difference < -threshold) return 'falsely low'
  return 'relatively preserved'
}

function derivedEffects(
  normal: PressureMetrics,
  artifact: PressureMetrics,
): ArtifactPressureEffects {
  return {
    systolic: compareMetric(artifact.systolicMmHg, normal.systolicMmHg),
    diastolic: compareMetric(artifact.diastolicMmHg, normal.diastolicMmHg),
    mean: compareMetric(artifact.meanMmHg, normal.meanMmHg, 1.5),
    pulsePressure: compareMetric(artifact.pulsePressureMmHg, normal.pulsePressureMmHg),
  }
}

function pressureEffectsFor(
  id: ArtifactId,
  normal: PressureMetrics,
  artifact: PressureMetrics,
  zeroLevelMode: ZeroLevelMode,
): {
  readonly effects: ArtifactPressureEffects
  readonly metricDisplay: ArtifactWaveformResult['metricDisplay']
} {
  if (id === 'wall-contact' || id === 'overwedging') {
    return {
      effects: {
        systolic: 'unreliable',
        diastolic: 'unreliable',
        mean: 'unreliable',
        pulsePressure: 'unreliable',
      },
      metricDisplay: 'unreliable',
    }
  }
  if (id === 'spontaneous-wedge') {
    return {
      effects: {
        systolic: 'measuring a different compartment',
        diastolic: 'measuring a different compartment',
        mean: 'measuring a different compartment',
        pulsePressure: 'measuring a different compartment',
      },
      metricDisplay: 'different-compartment',
    }
  }
  if (id === 'zero-level') {
    const offset = zeroLevelOptions[zeroLevelMode].offsetMmHg
    const shiftedEffect: QualitativePressureEffect =
      offset > 0 ? 'shifted high' : offset < 0 ? 'shifted low' : 'relatively preserved'
    return {
      effects: {
        systolic: shiftedEffect,
        diastolic: shiftedEffect,
        mean: shiftedEffect,
        pulsePressure: 'relatively preserved',
      },
      metricDisplay: 'derived',
    }
  }
  return { effects: derivedEffects(normal, artifact), metricDisplay: 'derived' }
}

export function generateArtifactWaveform(
  id: string,
  options: ArtifactWaveformOptions = {},
): ArtifactWaveformResult {
  const transform = getArtifactWaveformTransform(id)
  const artifactId = id as ArtifactId
  const zeroLevelMode = options.zeroLevelMode ?? 'transducer-too-low'
  const source = createNormalPulmonaryArteryWaveform()
  const samples = transform(source, options)
  const normalMetrics = derivePressureMetrics(source)
  const metrics = derivePressureMetrics(samples)
  const interpretation = pressureEffectsFor(artifactId, normalMetrics, metrics, zeroLevelMode)
  return {
    id: artifactId,
    samples,
    beatMetrics: deriveBeatPressureMetrics(samples),
    metrics,
    effects: interpretation.effects,
    metricDisplay: interpretation.metricDisplay,
  }
}
