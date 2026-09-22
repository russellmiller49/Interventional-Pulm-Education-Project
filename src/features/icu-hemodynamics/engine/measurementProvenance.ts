import { clamp } from './calculations'
import { isEndExpiration, respiratoryPhaseAt } from './simulation'
import {
  learnerThermodilutionSeriesIdentity,
  thermodilutionSeriesGroups,
  thermodilutionSeriesSummary,
  type ThermodilutionSeriesSummary,
} from './thermodilution'
import type {
  HemodynamicSimulationState,
  HemodynamicWaveformSample,
  PhysiologicalEpisode,
  StoredWedgeRecord,
  ThermodilutionAcquisition,
  ThermodilutionSeriesIdentity,
  WedgeCursorPlacement,
  WedgeCursorReading,
} from './types'

/**
 * Where a value came from (HD-PRE-REVIEW-02).
 *
 * Every value the module shows about the patient is one of these, and a surface that shows one says
 * which. They are not interchangeable: a latent model value is not something a learner could have
 * seen at the bedside, a displayed observation is not a stored measurement, a stored measurement
 * from before an intervention is not a current one, and an authored example is not the learner's
 * own acquisition.
 */
export type MeasurementProvenanceKind =
  | 'latent-model'
  | 'displayed-observation'
  | 'learner-acquired'
  | 'stored-historical'
  | 'authored-example'
  | 'derived'

export const measurementProvenanceLabels: Readonly<Record<MeasurementProvenanceKind, string>> =
  Object.freeze({
    'latent-model': 'Model-only value — the simulation’s internal state, not a measurement',
    'displayed-observation': 'Shown on the monitor at that moment',
    'learner-acquired': 'Acquired by you in this run',
    'stored-historical': 'Stored earlier, under conditions that have since changed',
    'authored-example': 'Authored example evidence, not an acquisition of yours',
    derived: 'Calculated from the inputs listed with it',
  })

/* ------------------------------------------------------------------ *
 * Thermodilution: which series is current
 * ------------------------------------------------------------------ */

/** The acquisition context a curve acquired right now would carry. */
export function thermodilutionAcquisitionFor(
  state: HemodynamicSimulationState,
): ThermodilutionAcquisition {
  return {
    series: currentThermodilutionSeriesIdentity(state),
    acquiredAtSeconds: state.timeSeconds,
    catheterPosition: state.catheter.position,
  }
}

export function currentThermodilutionSeriesIdentity(
  state: HemodynamicSimulationState,
): ThermodilutionSeriesIdentity {
  return learnerThermodilutionSeriesIdentity({
    sessionId: state.sessionId,
    caseId: state.caseId,
    episode: state.physiologicalEpisode,
    injectate: {
      volumeMl: state.caseDefinition.thermodilution.injectateVolumeMl,
      temperatureC: state.caseDefinition.thermodilution.injectateTemperatureC,
    },
  })
}

export interface ThermodilutionSeriesView {
  /** The series for the conditions measurements are acquired under now. May hold no curves yet. */
  readonly current: ThermodilutionSeriesSummary
  readonly currentEstablished: boolean
  /**
   * When the current series is not established: the most recent series from earlier conditions
   * that is, kept for comparison and never presented as current.
   */
  readonly latestEarlierEstablished: ThermodilutionSeriesSummary | null
  /** Every other series, most recently acquired first. Their curves are never pooled with `current`. */
  readonly earlier: readonly ThermodilutionSeriesSummary[]
}

/**
 * The thermodilution evidence as it stands now, series by series (report P-05).
 *
 * A curve list with no acquisition context (a constructed or legacy state) is one unrecorded group.
 * It stands in for the current series only in a session that has had a single set of conditions,
 * so nothing is guessed about which episode it belongs to — and surfaces say its conditions were
 * not recorded.
 */
export function thermodilutionSeriesView(
  state: HemodynamicSimulationState,
): ThermodilutionSeriesView {
  const trials = state.thermodilutionTrials
  const currentIdentity = currentThermodilutionSeriesIdentity(state)
  const groups = thermodilutionSeriesGroups(trials)
  const hasCurrent = groups.some((group) => group.identity.key === currentIdentity.key)
  const onlyUnrecorded =
    groups.length > 0 && groups.every((group) => group.identity.origin === 'unrecorded')
  const currentKey =
    !hasCurrent && onlyUnrecorded && state.physiologicalEpisodes.length <= 1
      ? groups[0].identity.key
      : currentIdentity.key
  const current = thermodilutionSeriesSummary(trials, currentKey, currentIdentity)
  const order = [...groups].reverse()
  const earlier = order
    .filter((group) => group.identity.key !== currentKey)
    .map((group) => thermodilutionSeriesSummary(trials, group.identity.key))
  const currentEstablished = current.averageLMin !== null
  return {
    current,
    currentEstablished,
    latestEarlierEstablished: currentEstablished
      ? null
      : (earlier.find((summary) => summary.averageLMin !== null) ?? null),
    earlier,
  }
}

/** The accepted average for the current conditions, or `null`. Never an earlier episode's value. */
export function currentThermodilutionAverage(state: HemodynamicSimulationState): number | null {
  return thermodilutionSeriesView(state).current.averageLMin
}

/* ------------------------------------------------------------------ *
 * Wedge: the captured occlusion trace and the reading cursor (L6-02)
 * ------------------------------------------------------------------ */

export interface OcclusionCapture {
  readonly start: number
  readonly end: number
  readonly samples: readonly HemodynamicWaveformSample[]
  /** One cardiac cycle, the width of the window a cursor reading averages over. */
  readonly cycleSeconds: number
  /** The earliest and latest cursor times whose centred cardiac cycle lies inside the capture. */
  readonly cursorMin: number
  readonly cursorMax: number
  readonly respiratoryCycleSeconds: number
}

/**
 * The samples of the occlusion in progress: the trace from the moment this balloon went up.
 *
 * Only these can be read as an occlusion pressure. Samples from before the inflation carry the
 * model's wedge channel too, but nothing was occluded then.
 */
export function occlusionCapture(state: HemodynamicSimulationState): OcclusionCapture | null {
  const catheter = state.catheter
  if (
    catheter.position !== 'wedge' ||
    !catheter.balloonInflated ||
    catheter.wedgeStartedAt === null
  ) {
    return null
  }
  const startedAt = catheter.wedgeStartedAt
  const samples = state.waveforms.filter((sample) => sample.time >= startedAt)
  if (samples.length < 2) return null
  const cycleSeconds = 60 / Math.max(1, state.parameters.heartRateBpm)
  const start = samples[0].time
  const end = samples[samples.length - 1].time
  return {
    start,
    end,
    samples,
    cycleSeconds,
    cursorMin: start + cycleSeconds / 2,
    cursorMax: end - cycleSeconds / 2,
    respiratoryCycleSeconds: 60 / clamp(state.parameters.respiratoryRateBpm, 4, 45),
  }
}

function nearestSample(
  samples: readonly HemodynamicWaveformSample[],
  time: number,
): HemodynamicWaveformSample {
  let best = samples[0]
  for (const sample of samples) {
    if (Math.abs(sample.time - time) < Math.abs(best.time - time)) best = sample
  }
  return best
}

function signedSecondsFromEndExpiration(phase: number, respiratoryCycleSeconds: number): number {
  return phase <= 0.5 ? phase * respiratoryCycleSeconds : (phase - 1) * respiratoryCycleSeconds
}

/**
 * What the captured trace says at one cursor time: the sample there, and the mean of the one
 * cardiac cycle centred on it. The reducer and every surface read this one function, so the
 * visual cursor, its text equivalent and the stored value cannot resolve to different samples.
 */
export function wedgeCursorReadingAt(
  state: HemodynamicSimulationState,
  requestedTime: number,
  placement: WedgeCursorPlacement,
): WedgeCursorReading | null {
  const capture = occlusionCapture(state)
  if (!capture || capture.cursorMax < capture.cursorMin || !Number.isFinite(requestedTime)) {
    return null
  }
  const target = clamp(requestedTime, capture.cursorMin, capture.cursorMax)
  const inRange = capture.samples.filter(
    (sample) => sample.time >= capture.cursorMin - 1e-9 && sample.time <= capture.cursorMax + 1e-9,
  )
  if (inRange.length === 0) return null
  const sample = nearestSample(inRange, target)
  const half = capture.cycleSeconds / 2
  const window = capture.samples.filter(
    (candidate) => candidate.time >= sample.time - half && candidate.time <= sample.time + half,
  )
  const cycleMean =
    window.reduce((total, candidate) => total + candidate.pcwpMmHg, 0) / Math.max(1, window.length)
  const phase = respiratoryPhaseAt(sample.time, state.parameters.respiratoryRateBpm)
  return {
    placement,
    time: sample.time,
    sampleMmHg: sample.pcwpMmHg,
    cycleMeanMmHg: cycleMean,
    windowStart: window[0]?.time ?? sample.time,
    windowEnd: window[window.length - 1]?.time ?? sample.time,
    sampleCount: window.length,
    modeledRespiratoryPhase: phase,
    secondsFromModeledEndExpiration: signedSecondsFromEndExpiration(
      phase,
      capture.respiratoryCycleSeconds,
    ),
    withinModeledEndExpiratoryWindow: isEndExpiration(phase),
    occlusionEpisode: state.catheter.wedgeEpisodeCount,
  }
}

/**
 * The assisted placement: the captured sample nearest the simulation's own modeled end expiration.
 *
 * It is found from the model's breath timing, not from the pressure trough — the lowest pressure is
 * end expiration only under positive-pressure ventilation, and a spontaneous breath reverses it.
 */
export function assistedWedgeCursorTime(state: HemodynamicSimulationState): number | null {
  const capture = occlusionCapture(state)
  if (!capture || capture.cursorMax < capture.cursorMin) return null
  let best: { time: number; distance: number } | null = null
  for (const sample of capture.samples) {
    if (sample.time < capture.cursorMin - 1e-9 || sample.time > capture.cursorMax + 1e-9) continue
    const phase = respiratoryPhaseAt(sample.time, state.parameters.respiratoryRateBpm)
    const distance = Math.min(phase, 1 - phase)
    if (best === null || distance <= best.distance) best = { time: sample.time, distance }
  }
  return best?.time ?? null
}

/** The modeled respiratory reference over the capture, scaled 0–1 across its own range. */
export function modeledRespiratoryReference(
  capture: OcclusionCapture,
): readonly { readonly time: number; readonly relative: number }[] {
  const values = capture.samples.map((sample) => sample.respiration)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const span = high - low
  return capture.samples.map((sample) => ({
    time: sample.time,
    relative: span > 1e-9 ? (sample.respiration - low) / span : 0,
  }))
}

/* ------------------------------------------------------------------ *
 * Stored wedge: which conditions it belongs to
 * ------------------------------------------------------------------ */

export interface StoredWedgeProvenance {
  readonly valueMmHg: number
  /** `null` for a stored value with no record of how it was taken (a constructed state). */
  readonly record: StoredWedgeRecord | null
  /** Whether it was stored under the conditions the patient is in now; `null` when unknown. */
  readonly current: boolean | null
  readonly episode: PhysiologicalEpisode | null
}

export function storedWedgeProvenance(
  state: HemodynamicSimulationState,
): StoredWedgeProvenance | null {
  const value = state.catheter.storedWedgeMmHg
  if (value === null) return null
  const record = state.catheter.storedWedge ?? null
  if (!record) return { valueMmHg: value, record: null, current: null, episode: null }
  const current =
    record.sessionId === state.sessionId &&
    record.physiologicalEpisode === state.physiologicalEpisode.index
  return {
    valueMmHg: value,
    record,
    current,
    episode:
      state.physiologicalEpisodes.find(
        (episode) => episode.index === record.physiologicalEpisode,
      ) ?? null,
  }
}

/** The words a surface uses for when a physiological episode began and why. */
export function physiologicalEpisodeWords(episode: PhysiologicalEpisode | null): string {
  if (!episode) return 'conditions not recorded'
  switch (episode.cause.kind) {
    case 'case-opened':
      return 'as the case opened'
    case 'intervention':
      return `after ${episode.cause.label}`
    case 'effect-waning':
      return `after the modeled ${episode.cause.label} effect began to wane`
    default:
      return 'conditions not recorded'
  }
}
