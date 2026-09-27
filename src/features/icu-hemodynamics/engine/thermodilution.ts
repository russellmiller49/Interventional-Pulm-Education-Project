import { clamp, roundTo } from './calculations'
import type {
  ThermodilutionGenerationInput,
  ThermodilutionSeriesIdentity,
  ThermodilutionTrial,
} from './types'

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

/* ------------------------------------------------------------------ *
 * Series identity — which curves may be averaged together
 * ------------------------------------------------------------------ */

/**
 * A curve built without acquisition context: a directly constructed or legacy trial. Its conditions
 * are not guessed. It never pools with a recorded series.
 */
export const UNRECORDED_THERMODILUTION_SERIES: ThermodilutionSeriesIdentity = Object.freeze({
  key: 'unrecorded',
  origin: 'unrecorded',
  method: 'bolus-thermodilution',
  sessionId: null,
  caseId: null,
  episode: null,
  injectate: null,
})

function injectateKey(injectate: ThermodilutionSeriesIdentity['injectate']): string {
  return injectate === null
    ? 'injectate-unrecorded'
    : `${injectate.volumeMl}mL@${injectate.temperatureC}C`
}

/** A learner's acquisition in one session, one physiological episode, one injectate configuration. */
export function learnerThermodilutionSeriesIdentity(input: {
  readonly sessionId: string
  readonly caseId: string
  readonly episode: NonNullable<ThermodilutionSeriesIdentity['episode']>
  readonly injectate: NonNullable<ThermodilutionSeriesIdentity['injectate']>
}): ThermodilutionSeriesIdentity {
  return {
    key: `${input.sessionId}|episode-${input.episode.index}|bolus-thermodilution|${injectateKey(input.injectate)}`,
    origin: 'learner-acquired',
    method: 'bolus-thermodilution',
    sessionId: input.sessionId,
    caseId: input.caseId,
    episode: input.episode,
    injectate: input.injectate,
  }
}

/** An authored teaching example: prior evidence written for the module, never the learner's own. */
export function authoredThermodilutionSeriesIdentity(input: {
  readonly exampleId: string
  readonly injectate: NonNullable<ThermodilutionSeriesIdentity['injectate']>
}): ThermodilutionSeriesIdentity {
  return {
    key: `authored:${input.exampleId}|bolus-thermodilution|${injectateKey(input.injectate)}`,
    origin: 'authored-example',
    method: 'bolus-thermodilution',
    sessionId: null,
    caseId: null,
    episode: null,
    injectate: input.injectate,
    exampleId: input.exampleId,
  }
}

export function thermodilutionSeriesIdentityOf(
  trial: ThermodilutionTrial,
): ThermodilutionSeriesIdentity {
  return trial.acquisition?.series ?? UNRECORDED_THERMODILUTION_SERIES
}

function acquiredAt(trial: ThermodilutionTrial): number {
  return trial.acquisition?.acquiredAtSeconds ?? trial.generatedAt
}

export interface ThermodilutionSeriesGroup {
  readonly identity: ThermodilutionSeriesIdentity
  readonly trials: readonly ThermodilutionTrial[]
}

/** Every series the trials belong to, in the order each was first acquired. Nothing is merged. */
export function thermodilutionSeriesGroups(
  trials: readonly ThermodilutionTrial[],
): readonly ThermodilutionSeriesGroup[] {
  const groups = new Map<
    string,
    { identity: ThermodilutionSeriesIdentity; trials: ThermodilutionTrial[] }
  >()
  for (const trial of trials) {
    const identity = thermodilutionSeriesIdentityOf(trial)
    const existing = groups.get(identity.key)
    if (existing) existing.trials.push(trial)
    else groups.set(identity.key, { identity, trials: [trial] })
  }
  return [...groups.values()]
}

/**
 * The series of the most recently acquired curve. The default a trial list is summarized by when no
 * series is named — never a pool of several. It is "most recent", not "current": whether conditions
 * have changed since is a question about the state, answered by `thermodilutionSeriesView`.
 */
export function latestThermodilutionSeriesKey(
  trials: readonly ThermodilutionTrial[],
): string | null {
  let latest: ThermodilutionTrial | null = null
  for (const trial of trials) {
    if (latest === null || acquiredAt(trial) >= acquiredAt(latest)) latest = trial
  }
  return latest === null ? null : thermodilutionSeriesIdentityOf(latest).key
}

function trialsInSeries(
  trials: readonly ThermodilutionTrial[],
  seriesKey: string | null | undefined,
): readonly ThermodilutionTrial[] {
  const key = seriesKey ?? latestThermodilutionSeriesKey(trials)
  if (key === null) return []
  return trials.filter((trial) => thermodilutionSeriesIdentityOf(trial).key === key)
}

/** The unrounded mean of one series' included curves, or `null` below the configured count. */
export function thermodilutionSeriesMeanUnrounded(
  trials: readonly ThermodilutionTrial[],
  seriesKey?: string | null,
): number | null {
  const included = trialsInSeries(trials, seriesKey).filter(thermodilutionTrialCountsTowardSeries)
  if (included.length < THERMODILUTION_SERIES_TRIAL_COUNT) return null
  return (
    included.reduce((total, trial) => total + trial.estimatedCardiacOutputLMin, 0) / included.length
  )
}

/**
 * The accepted average of one series.
 *
 * HD-PRE-REVIEW-02 (report P-05, Figure 42). This used to average every eligible curve in the list,
 * so three curves acquired before a fluid step and three after it came back as one "4.3 L/min from
 * 6 reviewed trials". It now averages exactly one series — the one named, or the one the most
 * recent curve belongs to — and a curve from another series never enters it, however many eligible
 * curves exist. A list of curves that carry no acquisition context is one unrecorded group, as
 * before; it never mixes with a recorded series.
 */
export function thermodilutionAcceptedAverage(
  trials: readonly ThermodilutionTrial[],
  seriesKey?: string | null,
): number | null {
  const mean = thermodilutionSeriesMeanUnrounded(trials, seriesKey)
  return mean === null ? null : roundTo(mean, 1)
}

/* ------------------------------------------------------------------ *
 * Three separate facts about one curve (report L7-03)
 * ------------------------------------------------------------------ */

export type ThermodilutionLearnerDecision = 'accepted' | 'excluded' | 'undecided'

export type ThermodilutionInclusionCode =
  | 'included'
  | 'not-reviewed'
  | 'undecided'
  | 'excluded-by-learner'
  | 'accepted-not-technically-usable'
  | 'accepted-with-quality-alert'

export interface ThermodilutionTrialInclusion {
  /** What the learner chose. Kept visible whatever the other two say. */
  readonly learnerDecision: ThermodilutionLearnerDecision
  /** The automatic technical assessment of the acquisition. A choice never changes it. */
  readonly technicalQuality: ThermodilutionTrial['quality']
  /** Whether this curve enters its series' calculation. */
  readonly included: boolean
  readonly code: ThermodilutionInclusionCode
  /** One sentence a card and its text equivalent both print. */
  readonly explanation: string
}

/**
 * Learner selection, technical quality and calculation inclusion, kept apart.
 *
 * Accepting a technically unusable curve used to badge it "Accepted trial" while the series quietly
 * left it out. The selection stays the learner's — it is shown, and it is not overwritten — but it
 * does not make the acquisition usable, and inclusion says so in the same words wherever the curve
 * is described. Acceptance is also not clinical approval: it is this learner's call about one curve.
 */
export function thermodilutionTrialInclusion(
  trial: ThermodilutionTrial,
): ThermodilutionTrialInclusion {
  const learnerDecision: ThermodilutionLearnerDecision =
    trial.accepted === true ? 'accepted' : trial.accepted === false ? 'excluded' : 'undecided'
  const base = { learnerDecision, technicalQuality: trial.quality }
  if (thermodilutionTrialCountsTowardSeries(trial)) {
    return {
      ...base,
      included: true,
      code: 'included',
      explanation:
        'Included in this series’ calculation: you accepted it and no automatic quality alert was raised.',
    }
  }
  if (!trial.reviewed) {
    return {
      ...base,
      included: false,
      code: 'not-reviewed',
      explanation: 'Not in the calculation: the raw curve has not been reviewed yet.',
    }
  }
  if (learnerDecision === 'excluded') {
    const reason = trial.exclusionReasonId
      ? thermodilutionExclusionReasonById.get(trial.exclusionReasonId)?.label
      : undefined
    return {
      ...base,
      included: false,
      code: 'excluded-by-learner',
      explanation: `Not in the calculation: you excluded it${reason ? ` — ${reason.toLowerCase()}` : ''}.`,
    }
  }
  if (learnerDecision === 'undecided') {
    return {
      ...base,
      included: false,
      code: 'undecided',
      explanation: 'Not in the calculation yet: reviewed, but not accepted or excluded.',
    }
  }
  const alerts = trial.alerts.length > 0 ? ` (${trial.alerts.join(' ')})` : ''
  if (trial.quality === 'invalid') {
    return {
      ...base,
      included: false,
      code: 'accepted-not-technically-usable',
      explanation: `You accepted this curve, and your choice is kept — but it is not in the calculation. The automatic check marks the acquisition not technically usable${alerts}, and accepting it does not change that. Excluding it with the technical reason it shows records why it is left out.`,
    }
  }
  return {
    ...base,
    included: false,
    code: 'accepted-with-quality-alert',
    explanation: `You accepted this curve, and your choice is kept — but it is not in the calculation. A quality alert was raised on the acquisition${alerts}; this simulation averages only curves with no automatic quality alert. Accepting it does not clear the alert.`,
  }
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
/**
 * How far the trace has to climb back above its own running minimum to count as a second excursion.
 *
 * Set well above the model's tail noise, which reaches roughly a hundredth of the peak excursion.
 * The rebound also has to happen once the trace is genuinely on its way down, or the first samples
 * after the peak would register their own jitter as a disturbance.
 */
const SECONDARY_REBOUND_FRACTION = 0.08
const SECONDARY_DECAYED_FRACTION = 0.5

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
   * A secondary excursion is a rise back above the running minimum once the trace is already well
   * down from its peak. Reading it off the trace rather than off the modifier that produced it means
   * an authored teaching state and a generated one are described the same way — and it means the
   * detector reports honestly when a modeled disturbance is a broadened tail rather than a second
   * excursion, which is what this model's regurgitation actually produces.
   */
  let secondaryDisturbanceTimeSeconds: number | null = null
  if (peakExcursion > 0) {
    let runningMinimum = Number.POSITIVE_INFINITY
    for (let index = peakIndex; index < points.length; index += 1) {
      const excursion = Math.abs(points[index].temperatureChangeC - baselineC)
      if (excursion < runningMinimum) runningMinimum = excursion
      if (runningMinimum > peakExcursion * SECONDARY_DECAYED_FRACTION) continue
      if (excursion - runningMinimum >= peakExcursion * SECONDARY_REBOUND_FRACTION) {
        secondaryDisturbanceTimeSeconds = points[index].timeSeconds
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
      ? 'Your decision: accepted.'
      : trial.accepted === false
        ? `Your decision: excluded. ${
            trial.exclusionReasonId
              ? (thermodilutionExclusionReasonById.get(trial.exclusionReasonId)?.label ??
                'Reason not recognized.')
              : 'No technical reason recorded.'
          }`
        : 'Your decision: not yet accepted or excluded.',
    // The same inclusion sentence the card prints, so the figure, the card and this description
    // cannot disagree about whether the curve is in the average (report L7-03).
    thermodilutionTrialInclusion(trial).explanation,
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
        'Indicator reached the thermistor more than once or by more than one route, so the simple area no longer describes one passage of the indicator.',
      appliesTo: (trial) => thermodilutionCurveFeatures(trial).secondaryDisturbance,
    },
    {
      /**
       * H4 §7. This is the reason the model's broadened curves actually satisfy. Regurgitant flow
       * and low output both widen the curve rather than adding a visible second excursion, and what
       * a learner can read off the trace is that its end point is not in the recording.
       */
      id: 'curve-does-not-settle',
      label: 'The trace does not return toward baseline inside the recording',
      whatItMeans:
        'The end of the curve is outside the recorded window, so where the integration stops is a judgement rather than an observation, and the area carries that uncertainty.',
      appliesTo: (trial) => thermodilutionCurveFeatures(trial).decayToTenthSeconds === null,
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
  /** The series this summary describes. Nothing from another series is counted here. */
  readonly identity: ThermodilutionSeriesIdentity
  /** Every curve in this series, in acquisition order. */
  readonly trialIds: readonly string[]
  /**
   * The curves in this series' calculation (accepted, reviewed, and free of an automatic quality
   * alert). The name predates the separation of selection from inclusion and is kept for the
   * existing consumers; `includedTrialIds` is the same list.
   */
  readonly acceptedTrialIds: readonly string[]
  readonly includedTrialIds: readonly string[]
  /** Curves the learner accepted — whether or not they are in the calculation. */
  readonly learnerAcceptedTrialIds: readonly string[]
  /** Accepted by the learner and still not in the calculation, with the reason. */
  readonly acceptedButNotIncluded: readonly {
    readonly trialId: string
    readonly sequence: number
    readonly explanation: string
  }[]
  readonly excludedTrialIds: readonly string[]
  readonly unreviewedTrialIds: readonly string[]
  readonly averageLMin: number | null
  /** The same mean before display rounding. */
  readonly averageUnroundedLMin: number | null
  readonly lowestLMin: number | null
  readonly highestLMin: number | null
  readonly spreadLMin: number | null
  /** Spread relative to the mean, as a fraction. Rendered by the surface, never authored as prose. */
  readonly relativeSpread: number | null
  /** True when every accepted trial used the same entered values and respiratory timing. */
  readonly techniqueConsistent: boolean
  /** What is still missing before the series can be summarized. */
  readonly blockedReasons: readonly string[]
  /**
   * Every other series in the same list, listed and never pooled. When any exist, `unpooledReason`
   * says why their curves are not in this number.
   */
  readonly otherSeries: readonly {
    readonly identity: ThermodilutionSeriesIdentity
    readonly trialCount: number
    readonly includedCount: number
    readonly averageLMin: number | null
  }[]
  readonly unpooledReason: string | null
}

/** Words for where a series came from, for a heading or a text equivalent. */
export function thermodilutionSeriesConditionWords(identity: ThermodilutionSeriesIdentity): string {
  if (identity.origin === 'unrecorded') {
    return 'acquisition conditions not recorded for these curves'
  }
  if (identity.origin === 'authored-example') {
    return 'an authored example series written for this module, not an acquisition of yours'
  }
  const episode = identity.episode
  if (!episode) return 'acquisition conditions not recorded'
  switch (episode.cause.kind) {
    case 'case-opened':
      return 'conditions as the case opened, before any modeled intervention'
    case 'intervention':
      return `conditions after ${episode.cause.label} (model time ${episode.startedAtSeconds.toFixed(0)} s)`
    case 'effect-waning':
      return `conditions after the modeled ${episode.cause.label} effect began to wane (model time ${episode.startedAtSeconds.toFixed(0)} s)`
    default:
      return 'acquisition conditions not recorded'
  }
}

/** Why two series are not averaged together, in one sentence. */
export function thermodilutionSeriesIncompatibility(
  a: ThermodilutionSeriesIdentity,
  b: ThermodilutionSeriesIdentity,
): string | null {
  if (a.key === b.key) return null
  if (a.origin === 'unrecorded' || b.origin === 'unrecorded') {
    return 'the acquisition conditions of one set of curves were not recorded, so this module cannot say they belong with the others'
  }
  if (a.origin !== b.origin) {
    return 'one set is authored example evidence and the other is your own acquisition'
  }
  if (a.sessionId !== b.sessionId || a.caseId !== b.caseId) {
    return 'they come from different runs of the case'
  }
  if (
    a.injectate?.volumeMl !== b.injectate?.volumeMl ||
    a.injectate?.temperatureC !== b.injectate?.temperatureC
  ) {
    return 'they were computed with different injectate constants'
  }
  if (a.episode?.index !== b.episode?.index) {
    return 'the patient’s modeled physiology changed between them'
  }
  return 'they are different series'
}

/**
 * Everything the series readout needs, derived once.
 *
 * `relativeSpread` is returned as a number and is never compared against a threshold here: this
 * module has no source-supported numeric agreement criterion (see `numeric-repeatability-criterion`
 * in `cardiacOutputSourceBoundaries.ts`), so the spread is shown and described rather than judged.
 */
export function thermodilutionSeriesSummary(
  allTrials: readonly ThermodilutionTrial[],
  seriesKey?: string | null,
  identityWhenEmpty?: ThermodilutionSeriesIdentity,
): ThermodilutionSeriesSummary {
  const key = seriesKey ?? latestThermodilutionSeriesKey(allTrials)
  const trials = trialsInSeries(allTrials, key)
  const identity =
    trials[0] !== undefined
      ? thermodilutionSeriesIdentityOf(trials[0])
      : (identityWhenEmpty ?? UNRECORDED_THERMODILUTION_SERIES)
  const accepted = trials.filter(thermodilutionTrialCountsTowardSeries)
  const excluded = trials.filter((trial) => trial.accepted === false)
  const unreviewed = trials.filter((trial) => !trial.reviewed)
  const values = accepted.map((trial) => trial.estimatedCardiacOutputLMin)
  const averageUnrounded = thermodilutionSeriesMeanUnrounded(trials, identity.key)
  const average = averageUnrounded === null ? null : roundTo(averageUnrounded, 1)
  const acceptedButNotIncluded = trials
    .filter((trial) => trial.accepted === true && !thermodilutionTrialCountsTowardSeries(trial))
    .map((trial) => ({
      trialId: trial.id,
      sequence: trial.sequence,
      explanation: thermodilutionTrialInclusion(trial).explanation,
    }))

  const blockedReasons: string[] = []
  if (accepted.length < THERMODILUTION_SERIES_TRIAL_COUNT) {
    // Report L7-03: "3 reviewed, technically usable trials; 2 are available" read as a riddle.
    blockedReasons.push(
      `${accepted.length} of the ${THERMODILUTION_SERIES_TRIAL_COUNT} usable curves this simulation averages ${accepted.length === 1 ? 'is' : 'are'} in this series so far.`,
    )
  }
  if (acceptedButNotIncluded.length > 0) {
    blockedReasons.push(
      `${acceptedButNotIncluded.length === 1 ? 'One curve you accepted is' : `${acceptedButNotIncluded.length} curves you accepted are`} not in the calculation, because the automatic check flagged the acquisition.`,
    )
  }
  if (unreviewed.length > 0) {
    blockedReasons.push(
      `${unreviewed.length} curve${unreviewed.length === 1 ? ' has' : 's have'} not been reviewed yet.`,
    )
  }
  const otherSeries = thermodilutionSeriesGroups(allTrials)
    .filter((group) => group.identity.key !== identity.key)
    .map((group) => ({
      identity: group.identity,
      trialCount: group.trials.length,
      includedCount: group.trials.filter(thermodilutionTrialCountsTowardSeries).length,
      averageLMin: thermodilutionAcceptedAverage(group.trials, group.identity.key),
    }))
  const reasons = [
    ...new Set(
      otherSeries
        .map((other) => thermodilutionSeriesIncompatibility(identity, other.identity))
        .filter((reason): reason is string => reason !== null),
    ),
  ]
  const otherCurveCount = otherSeries.reduce((total, other) => total + other.trialCount, 0)
  const unpooledReason =
    otherSeries.length === 0
      ? null
      : `${otherCurveCount} curve${otherCurveCount === 1 ? '' : 's'} from ${otherSeries.length === 1 ? 'another series' : `${otherSeries.length} other series`} ${otherCurveCount === 1 ? 'is' : 'are'} kept separately and not averaged into this one: ${reasons.join('; ')}.`

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
    identity,
    trialIds: trials.map((trial) => trial.id),
    acceptedTrialIds: accepted.map((trial) => trial.id),
    includedTrialIds: accepted.map((trial) => trial.id),
    learnerAcceptedTrialIds: trials
      .filter((trial) => trial.accepted === true)
      .map((trial) => trial.id),
    acceptedButNotIncluded,
    excludedTrialIds: excluded.map((trial) => trial.id),
    unreviewedTrialIds: unreviewed.map((trial) => trial.id),
    averageLMin: average,
    averageUnroundedLMin: averageUnrounded,
    lowestLMin: lowest,
    highestLMin: highest,
    spreadLMin: spread,
    relativeSpread:
      average !== null && spread !== null && average > 0 ? roundTo(spread / average, 4) : null,
    techniqueConsistent,
    blockedReasons,
    otherSeries,
    unpooledReason,
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
    // Describes what this model's trace actually does. It broadens and its decay may run past the
    // end of the recording; it does not add a visible second excursion, and saying so would send a
    // learner looking for a feature the curve does not have.
    alerts.push(
      'Significant tricuspid regurgitation broadens the curve, and its decay may not return toward baseline inside the recorded window.',
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
    acquisition: input.acquisition ?? null,
  }
}
