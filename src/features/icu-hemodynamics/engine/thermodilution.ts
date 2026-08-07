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

/**
 * H4 §7. The series summarizes three trials, and that number is this module's own configuration
 * rather than a clinical acceptance criterion — see `minimum-accepted-trials` in
 * `cardiacOutputSourceBoundaries.ts`, which is where the qualifier a learner reads comes from.
 */
export const THERMODILUTION_SERIES_TRIAL_COUNT = 3

/**
 * A trial belongs in the accepted series only if all three hold.
 *
 * The reviewed condition is the H4 addition. Before it, `accepted === true` could be set on a trial
 * whose curve had never been looked at, which made "the monitor produced a number" and "a
 * measurement was accepted" the same event — exactly the conflation this section exists to break.
 */
export function thermodilutionTrialCountsTowardSeries(trial: ThermodilutionTrial): boolean {
  return trial.accepted === true && trial.quality === 'valid' && trial.reviewed === true
}

export function thermodilutionAcceptedAverage(
  trials: readonly ThermodilutionTrial[],
): number | null {
  const accepted = trials.filter(thermodilutionTrialCountsTowardSeries)
  if (accepted.length < THERMODILUTION_SERIES_TRIAL_COUNT) return null
  const mean =
    accepted.reduce((total, trial) => total + trial.estimatedCardiacOutputLMin, 0) / accepted.length
  return roundTo(mean, 1)
}

/* ------------------------------------------------------------------ *
 * Raw curve features — the object the result is derived from
 * ------------------------------------------------------------------ */

export interface ThermodilutionCurveFeatures {
  /** Mean temperature change over the settled trace before onset. */
  readonly baselineC: number
  readonly onsetSeconds: number | null
  readonly peakChangeC: number
  readonly peakTimeSeconds: number
  /** How long the trace takes to fall back to a tenth of its peak excursion. */
  readonly decayToTenthSeconds: number | null
  readonly secondaryDisturbance: boolean
  readonly secondaryDisturbanceTimeSeconds: number | null
  /** The engine quantity the derived flow is read off. */
  readonly curveArea: number
}

const ONSET_FRACTION = 0.05
const SECONDARY_FRACTION = 0.12

/**
 * The named parts of the curve, derived from the trace rather than authored beside it.
 *
 * A learner is asked to read baseline, onset, peak, decay, and any secondary disturbance off the
 * figure before the derived number is shown, so those five have to be quantities the figure and its
 * text equivalent both come from — not labels drawn on top of a picture.
 */
export function thermodilutionCurveFeatures(
  trial: ThermodilutionTrial,
): ThermodilutionCurveFeatures {
  const points = trial.curve
  if (points.length === 0) {
    return {
      baselineC: 0,
      onsetSeconds: null,
      peakChangeC: 0,
      peakTimeSeconds: 0,
      decayToTenthSeconds: null,
      secondaryDisturbance: false,
      secondaryDisturbanceTimeSeconds: null,
      curveArea: trial.curveArea,
    }
  }

  const preOnset = points.filter((point) => point.timeSeconds <= 0.2)
  const baselineC =
    preOnset.length > 0
      ? preOnset.reduce((total, point) => total + point.temperatureChangeC, 0) / preOnset.length
      : 0

  let peakIndex = 0
  for (let index = 1; index < points.length; index += 1) {
    if (
      Math.abs(points[index].temperatureChangeC - baselineC) >
      Math.abs(points[peakIndex].temperatureChangeC - baselineC)
    ) {
      peakIndex = index
    }
  }
  const peakExcursion = Math.abs(points[peakIndex].temperatureChangeC - baselineC)

  const onsetPoint = points.find(
    (point) => Math.abs(point.temperatureChangeC - baselineC) >= peakExcursion * ONSET_FRACTION,
  )

  let decayToTenthSeconds: number | null = null
  for (let index = peakIndex; index < points.length; index += 1) {
    if (Math.abs(points[index].temperatureChangeC - baselineC) <= peakExcursion * 0.1) {
      decayToTenthSeconds = points[index].timeSeconds
      break
    }
  }

  /**
   * A secondary excursion is a rise back above a floor after the trace has already settled toward
   * it. Reading it off the trace rather than off the modifier that produced it means an authored
   * teaching state and a generated one are described the same way.
   */
  let secondaryDisturbanceTimeSeconds: number | null = null
  if (decayToTenthSeconds !== null) {
    let settled = false
    for (const point of points) {
      if (point.timeSeconds < decayToTenthSeconds) continue
      const excursion = Math.abs(point.temperatureChangeC - baselineC)
      if (!settled && excursion <= peakExcursion * 0.06) settled = true
      if (settled && excursion >= peakExcursion * SECONDARY_FRACTION) {
        secondaryDisturbanceTimeSeconds = point.timeSeconds
        break
      }
    }
  }

  return {
    baselineC: roundTo(baselineC, 4),
    onsetSeconds: onsetPoint ? onsetPoint.timeSeconds : null,
    peakChangeC: roundTo(points[peakIndex].temperatureChangeC - baselineC, 4),
    peakTimeSeconds: points[peakIndex].timeSeconds,
    decayToTenthSeconds,
    secondaryDisturbance: secondaryDisturbanceTimeSeconds !== null,
    secondaryDisturbanceTimeSeconds,
    curveArea: trial.curveArea,
  }
}

export const thermodilutionQualityLabels: Readonly<Record<ThermodilutionTrial['quality'], string>> =
  Object.freeze({
    valid: 'No automatic quality alert',
    questionable: 'Quality alert raised',
    invalid: 'Not technically usable',
  })

/**
 * The curve, in words, before the number is mentioned.
 *
 * Deliberately ends with the acceptance state and never leads with the derived flow: a learner who
 * reads the alternative text should meet the raw data in the same order as one who reads the figure.
 */
export function thermodilutionCurveTextEquivalent(trial: ThermodilutionTrial): string {
  const features = thermodilutionCurveFeatures(trial)
  const parts = [
    `Trial ${trial.sequence}, temperature change against time.`,
    `Baseline sits at ${features.baselineC.toFixed(3)} degrees Celsius from the settled trace.`,
    features.onsetSeconds === null
      ? 'No onset is identifiable on this trace.'
      : `The change begins ${features.onsetSeconds.toFixed(2)} seconds after the injection.`,
    `The peak excursion is ${Math.abs(features.peakChangeC).toFixed(3)} degrees Celsius below baseline at ${features.peakTimeSeconds.toFixed(2)} seconds.`,
    features.decayToTenthSeconds === null
      ? 'The trace does not return to within a tenth of its peak excursion inside the recorded window.'
      : `It decays back to within a tenth of that excursion by ${features.decayToTenthSeconds.toFixed(2)} seconds.`,
    features.secondaryDisturbance
      ? `A secondary disturbance appears at ${(features.secondaryDisturbanceTimeSeconds ?? 0).toFixed(2)} seconds, after the trace had settled.`
      : 'No secondary disturbance appears after the trace settles.',
    `The area the calculation integrates is ${features.curveArea.toFixed(3)} in the model's units.`,
    `Quality: ${thermodilutionQualityLabels[trial.quality].toLowerCase()}.`,
    trial.alerts.length > 0 ? `Alerts: ${trial.alerts.join(' ')}` : '',
    trial.reviewed ? 'This curve has been reviewed.' : 'This curve has not been reviewed yet.',
    trial.accepted === true
      ? 'State: accepted trial.'
      : trial.accepted === false
        ? `State: excluded trial. ${
            trial.exclusionReasonId
              ? (thermodilutionExclusionReasonById.get(trial.exclusionReasonId)?.label ??
                'Reason not recognized.')
              : 'No technical reason recorded.'
          }`
        : 'State: not yet accepted or excluded.',
  ]
  return parts.filter((part) => part.length > 0).join(' ')
}

/* ------------------------------------------------------------------ *
 * Exclusion reasons — a trial may only be dropped for something it shows
 * ------------------------------------------------------------------ */

export interface ThermodilutionExclusionReason {
  readonly id: string
  readonly label: string
  readonly whatItMeans: string
  /** Whether this specific trial actually exhibits the problem. */
  readonly appliesTo: (trial: ThermodilutionTrial) => boolean
}

/**
 * Why a trial may be left out of the series.
 *
 * Every reason is a predicate over the trial itself, so "this one disagrees with the others" is not
 * expressible: there is no reason here that a concordant, technically clean trial satisfies. That is
 * the whole design. Selection by convenience is the failure mode this section is built against, and
 * a free-text reason field would have let it straight back in.
 */
export const thermodilutionExclusionReasons: readonly ThermodilutionExclusionReason[] =
  Object.freeze([
    {
      id: 'delivery-did-not-match-entered-values',
      label: 'The delivery did not match the entered values',
      whatItMeans:
        'The volume or temperature actually delivered differed from the computation constant, so the calculation described an injection that did not happen.',
      appliesTo: (trial) =>
        trial.alerts.some((alert) => /volume differs|temperature differs/i.test(alert)),
    },
    {
      id: 'inadequate-or-variable-indicator-delivery',
      label: 'The bolus was prolonged, abrupt, or not continuous',
      whatItMeans:
        'The indicator went in over a different time course than the rest of the series, spreading or compressing the curve independently of the patient.',
      appliesTo: (trial) =>
        trial.alerts.some((alert) => /too slow|abrupt|not smooth/i.test(alert)) ||
        trial.technique.injectionDurationSeconds > 4 ||
        trial.technique.injectionDurationSeconds < 0.6 ||
        trial.technique.smoothness < 0.7,
    },
    {
      id: 'respiratory-phase-inconsistent',
      label: 'The respiratory timing was not the series timing',
      whatItMeans:
        'The bolus was delivered at a different point in the respiratory cycle than the other trials, so its spread belongs to the operator rather than the patient.',
      appliesTo: (trial) => trial.technique.respiratoryPhase === 'variable',
    },
    {
      id: 'catheter-position-not-confirmed',
      label: 'The injectate port or thermistor was not in the assumed compartment',
      whatItMeans:
        'The method assumes indicator enters near the right atrium and is detected in the pulmonary artery. This trial was acquired without that.',
      appliesTo: (trial) => trial.alerts.some((alert) => /position/i.test(alert)),
    },
    {
      id: 'secondary-curve-disturbance',
      label: 'A secondary disturbance follows the main curve',
      whatItMeans:
        'Indicator reached the thermistor more than once or by more than one route, so the simple area no longer describes a single pass.',
      appliesTo: (trial) => thermodilutionCurveFeatures(trial).secondaryDisturbance,
    },
    {
      id: 'baseline-not-stable',
      label: 'The baseline was not stable before the injection',
      whatItMeans:
        'Blood temperature was already moving, so the curve has no unambiguous level to be measured from.',
      appliesTo: (trial) => {
        const preOnset = trial.curve.filter((point) => point.timeSeconds <= 0.2)
        if (preOnset.length < 2) return false
        const values = preOnset.map((point) => point.temperatureChangeC)
        const peak = Math.abs(thermodilutionCurveFeatures(trial).peakChangeC)
        if (peak <= 0) return false
        return (Math.max(...values) - Math.min(...values)) / peak > 0.08
      },
    },
  ])

export const thermodilutionExclusionReasonById: ReadonlyMap<string, ThermodilutionExclusionReason> =
  new Map(thermodilutionExclusionReasons.map((reason) => [reason.id, reason]))

/** The reasons this trial actually shows. Empty means there is no defensible basis for exclusion. */
export function thermodilutionExclusionReasonsFor(
  trial: ThermodilutionTrial,
): readonly ThermodilutionExclusionReason[] {
  return thermodilutionExclusionReasons.filter((reason) => reason.appliesTo(trial))
}

export function canExcludeThermodilutionTrial(
  trial: ThermodilutionTrial,
  reasonId: string | undefined,
): boolean {
  if (!reasonId) return false
  const reason = thermodilutionExclusionReasonById.get(reasonId)
  if (!reason) return false
  return reason.appliesTo(trial)
}

/* ------------------------------------------------------------------ *
 * The accepted series
 * ------------------------------------------------------------------ */

export interface ThermodilutionSeriesSummary {
  readonly acceptedTrialIds: readonly string[]
  readonly excludedTrialIds: readonly string[]
  readonly unreviewedTrialIds: readonly string[]
  readonly averageLMin: number | null
  readonly lowestLMin: number | null
  readonly highestLMin: number | null
  readonly spreadLMin: number | null
  /** Spread relative to the mean, as a fraction. Rendered by the surface, never authored as prose. */
  readonly relativeSpread: number | null
  /** True when every accepted trial used the same entered values and respiratory timing. */
  readonly techniqueConsistent: boolean
  /** What is still missing before the series can be summarized. */
  readonly blockedReasons: readonly string[]
}

/**
 * Everything the series readout needs, derived once.
 *
 * `relativeSpread` is returned as a number and is never compared against a threshold here: this
 * module has no source-supported numeric agreement criterion (see `numeric-repeatability-criterion`
 * in `cardiacOutputSourceBoundaries.ts`), so the spread is shown and described rather than judged.
 */
export function thermodilutionSeriesSummary(
  trials: readonly ThermodilutionTrial[],
): ThermodilutionSeriesSummary {
  const accepted = trials.filter(thermodilutionTrialCountsTowardSeries)
  const excluded = trials.filter((trial) => trial.accepted === false)
  const unreviewed = trials.filter((trial) => !trial.reviewed)
  const values = accepted.map((trial) => trial.estimatedCardiacOutputLMin)
  const average = thermodilutionAcceptedAverage(trials)

  const blockedReasons: string[] = []
  if (accepted.length < THERMODILUTION_SERIES_TRIAL_COUNT) {
    blockedReasons.push(
      `This series summarizes ${THERMODILUTION_SERIES_TRIAL_COUNT} reviewed, technically usable trials; ${accepted.length} are available.`,
    )
  }
  if (unreviewed.length > 0) {
    blockedReasons.push(
      `${unreviewed.length} curve${unreviewed.length === 1 ? ' has' : 's have'} not been reviewed yet.`,
    )
  }

  const first = accepted[0]
  const techniqueConsistent =
    accepted.length === 0 ||
    accepted.every(
      (trial) =>
        trial.technique.injectateVolumeMl === first.technique.injectateVolumeMl &&
        trial.technique.injectateTemperatureC === first.technique.injectateTemperatureC &&
        trial.technique.respiratoryPhase === first.technique.respiratoryPhase,
    )

  const lowest = values.length > 0 ? Math.min(...values) : null
  const highest = values.length > 0 ? Math.max(...values) : null
  const spread = lowest !== null && highest !== null ? roundTo(highest - lowest, 2) : null

  return {
    acceptedTrialIds: accepted.map((trial) => trial.id),
    excludedTrialIds: excluded.map((trial) => trial.id),
    unreviewedTrialIds: unreviewed.map((trial) => trial.id),
    averageLMin: average,
    lowestLMin: lowest,
    highestLMin: highest,
    spreadLMin: spread,
    relativeSpread:
      average !== null && spread !== null && average > 0 ? roundTo(spread / average, 4) : null,
    techniqueConsistent,
    blockedReasons,
  }
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
    reviewed: false,
    exclusionReasonId: null,
  }
}
