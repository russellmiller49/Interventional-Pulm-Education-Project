import { clamp, roundTo } from './calculations'
import type { ThermodilutionGenerationInput, ThermodilutionTrial } from './types'

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function thermodilutionAcceptedAverage(
  trials: readonly ThermodilutionTrial[],
): number | null {
  const accepted = trials.filter((trial) => trial.accepted === true && trial.quality === 'valid')
  if (accepted.length < 3) return null
  const mean =
    accepted.reduce((total, trial) => total + trial.estimatedCardiacOutputLMin, 0) / accepted.length
  return roundTo(mean, 1)
}

export function generateThermodilutionCurve(
  input: ThermodilutionGenerationInput,
): ThermodilutionTrial {
  const sequence = input.sequence ?? 1
  const random = seededRandom(input.seed + sequence * 7919)
  const modifiers = input.modifiers ?? {}
  const alerts: string[] = []
  const configuredVolume = input.configuration.injectateVolumeMl
  const configuredTemperature = input.configuration.injectateTemperatureC
  const technique = input.technique

  if (Math.abs(technique.injectateVolumeMl - configuredVolume) > 1) {
    alerts.push('Injectate volume differs from the configured computation constant.')
  }
  if (Math.abs(technique.injectateTemperatureC - configuredTemperature) > 3) {
    alerts.push('Injectate temperature differs materially from the configured value.')
  }
  if (technique.injectionDurationSeconds > 4) alerts.push('Injection was too slow.')
  if (technique.injectionDurationSeconds < 0.6)
    alerts.push('Injection was abrupt and may mix irregularly.')
  if (technique.smoothness < 0.7) alerts.push('Injection was not smooth and continuous.')
  if (technique.respiratoryPhase === 'variable')
    alerts.push('Respiratory timing varied between trials.')
  if (modifiers.catheterPosition !== undefined && modifiers.catheterPosition !== 'pa') {
    alerts.push('Thermistor or injectate port position is not appropriate for this measurement.')
  }
  if ((modifiers.tricuspidRegurgitationSeverity ?? 0) > 0.45) {
    alerts.push(
      'Significant tricuspid regurgitation broadens recirculation and increases uncertainty.',
    )
  }
  if ((modifiers.shuntFraction ?? 0) > 0.25)
    alerts.push('Intracardiac shunt may distort indicator transit.')
  if ((modifiers.lowFlowFraction ?? 0) > 0.55)
    alerts.push('Low flow produces a prolonged, low-amplitude curve.')
  if ((modifiers.rhythmRegularity ?? 1) < 0.75)
    alerts.push('Rhythm variability increases between-trial spread.')

  const volumeError = configuredVolume / Math.max(1, technique.injectateVolumeMl)
  const temperatureGradientConfigured = 37 - configuredTemperature
  const temperatureGradientActual = Math.max(4, 37 - technique.injectateTemperatureC)
  const temperatureError = temperatureGradientConfigured / temperatureGradientActual
  const durationError = 1 + Math.max(0, technique.injectionDurationSeconds - 4) * 0.07
  const smoothnessError = 1 + (1 - clamp(technique.smoothness, 0, 1)) * 0.18
  const respiratoryBias =
    technique.respiratoryPhase === 'inspiration'
      ? 1.035
      : technique.respiratoryPhase === 'variable'
        ? 0.96 + random() * 0.09
        : 1
  const trBias = 1 - (modifiers.tricuspidRegurgitationSeverity ?? 0) * 0.12
  const shuntBias = 1 + (modifiers.shuntFraction ?? 0) * 0.16
  const rhythmNoise = (1 - (modifiers.rhythmRegularity ?? 1)) * (random() - 0.5) * 0.3
  const seededNoise = (random() - 0.5) * 0.08
  const estimatedCardiacOutputLMin = clamp(
    input.trueCardiacOutputLMin *
      volumeError *
      temperatureError *
      durationError *
      smoothnessError *
      respiratoryBias *
      trBias *
      shuntBias *
      (1 + rhythmNoise + seededNoise),
    0.8,
    15,
  )

  const lowFlow = modifiers.lowFlowFraction ?? clamp((3 - input.trueCardiacOutputLMin) / 3, 0, 0.8)
  const tau = 0.75 + lowFlow * 0.95 + (modifiers.tricuspidRegurgitationSeverity ?? 0) * 0.7
  const curveArea = 20 / estimatedCardiacOutputLMin
  const rawPoints: { timeSeconds: number; shape: number }[] = []
  let rawArea = 0
  for (let index = 0; index <= 160; index += 1) {
    const timeSeconds = index * 0.05
    const shifted = Math.max(0, timeSeconds - 0.2)
    const primary = shifted ** 2 * Math.exp(-shifted / tau)
    const recirculation =
      (modifiers.tricuspidRegurgitationSeverity ?? 0) *
      Math.max(0, shifted - 2.4) ** 2 *
      Math.exp(-Math.max(0, shifted - 2.4) / 1.1) *
      0.16
    const shape = primary + recirculation
    rawArea += shape * 0.05
    rawPoints.push({ timeSeconds, shape })
  }
  const scale = curveArea / Math.max(0.001, rawArea)
  const noiseMagnitude = 0.008 + (1 - technique.smoothness) * 0.025
  const curve = rawPoints.map((point) => ({
    timeSeconds: point.timeSeconds,
    temperatureChangeC: roundTo(-point.shape * scale + (random() - 0.5) * noiseMagnitude, 4),
  }))

  const severeAlerts = alerts.filter((alert) =>
    /position|volume differs|too slow|not smooth|shunt/i.test(alert),
  )
  const quality: ThermodilutionTrial['quality'] =
    severeAlerts.length >= 2 ||
    (modifiers.catheterPosition !== undefined && modifiers.catheterPosition !== 'pa')
      ? 'invalid'
      : alerts.length > 0
        ? 'questionable'
        : 'valid'

  return {
    id: `td-${sequence}-${input.seed}`,
    sequence,
    generatedAt: input.generatedAt ?? 0,
    technique: { ...technique },
    estimatedCardiacOutputLMin: roundTo(estimatedCardiacOutputLMin, 1),
    curveArea: roundTo(curveArea, 3),
    curve,
    quality,
    alerts,
    accepted: null,
  }
}
