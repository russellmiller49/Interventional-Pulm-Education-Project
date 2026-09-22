import {
  monitorPressureReadouts,
  type DisplayedPressure,
  type DisplayedPressureSampling,
} from './monitorDisplay'
import { physiologicalEpisodeWords, thermodilutionSeriesView } from './measurementProvenance'
import type { ThermodilutionSeriesSummary } from './thermodilution'
import type { HemodynamicSimulationState, PhysiologicalEpisode } from './types'

/**
 * What a learner could actually see or had actually acquired, at the moment of one decision.
 *
 * The case debrief's decision trace was built from `state.measurements`, which is the model's
 * internal derivation of the patient: it always holds a cardiac index whether or not a cardiac
 * output has ever been measured, and it holds pressures whose displayed form depends on a
 * transducer the learner may not have levelled or zeroed. So a run of HD-02 in which no
 * thermodilution was ever performed still listed "cardiac index 3.4 L/min/m²" at every step, and
 * the trace's MAP could differ from the MAP on the screen (report P-10, Figure 44).
 *
 * This projects the state into the things that have an observer and a provenance:
 *
 *  - a *displayed* pressure, which exists because the monitor is drawing it, carrying whether the
 *    measurement system was validated when it was read;
 *  - an *acquired* flow, which exists only when an accepted thermodilution series exists, carrying
 *    the method, the number of curves and how old the newest of them was at that moment;
 *  - and, for everything else, nothing. Missing is not zero, and the model's own value is not the
 *    learner's measurement.
 *
 * Each record is built at the event and kept, so a measurement taken later never appears in an
 * earlier row.
 *
 * `HD-PRE-REVIEW-02` adds condition and series identity. `flow` is now the series acquired under
 * the conditions the patient is in at that moment — never an earlier episode's series, however
 * recently it was acquired. A series from before an intervention stays visible as `earlierFlow`,
 * labelled with the conditions it belongs to, so a later comparison can say what changed between
 * them instead of silently treating one as the other.
 */
export interface ObservedPressure {
  /** The integer the monitor printed at that moment, from `monitorPressureReadouts`. */
  readonly displayedMmHg: number
  /** Which sample of the drawn trace that number is, in the monitor's own terms. */
  readonly sampling: DisplayedPressureSampling
  /** Whether the pressure chain had been levelled and zeroed when this was read. */
  readonly validated: boolean
  readonly transducerLevelCm: number
  readonly zeroed: boolean
}

export interface AcquiredFlow {
  readonly method: 'thermodilution'
  readonly cardiacOutputLMin: number
  readonly cardiacIndexLMinM2: number
  readonly trialCount: number
  /** Model time of the newest curve in the accepted series. */
  readonly acquiredAtSeconds: number
  /** How old that curve was when this record was taken. */
  readonly ageSeconds: number
  /** Which series this is (`ThermodilutionSeriesIdentity.key`). */
  readonly seriesKey: string
  /** The physiological episode the series was acquired in; `null` when not recorded. */
  readonly episode: PhysiologicalEpisode | null
  /** The unrounded series mean, so a comparison is not made between rounded labels. */
  readonly cardiacOutputUnroundedLMin: number
}

export interface ObservedSystemState {
  readonly timeSeconds: number
  readonly arterialMean: ObservedPressure
  readonly rightAtrialMean: ObservedPressure
  /**
   * The accepted series for the conditions at this moment. `null` when none has been acquired under
   * them — including when an older series exists. Missing is not zero, and old is not current.
   */
  readonly flow: AcquiredFlow | null
  /**
   * When `flow` is `null` but a series was accepted under earlier conditions: that series, still
   * labelled with its own episode. Never used as the current value.
   */
  readonly earlierFlow: AcquiredFlow | null
  /** The physiological conditions at the moment of the record. */
  readonly physiologicalEpisode: PhysiologicalEpisode
  readonly sessionId: string
  readonly zeroed: boolean
  readonly transducerLevelCm: number
  readonly catheterPosition: HemodynamicSimulationState['catheter']['position']
  readonly balloonInflated: boolean
}

const LEVEL_TOLERANCE_CM = 1

export function observedSystemState(state: HemodynamicSimulationState): ObservedSystemState {
  const zeroed = state.measurementSystem.zeroed
  const transducerLevelCm = state.measurementSystem.transducerLevelCm
  const validated = zeroed && Math.abs(transducerLevelCm) <= LEVEL_TOLERANCE_CM
  // The one selector the bedside monitor's rail is drawn from. A record that says "displayed"
  // has to mean the number that was on the screen, not the model's own estimate of it.
  const readouts = monitorPressureReadouts(state)
  const pressure = (shown: DisplayedPressure): ObservedPressure => ({
    displayedMmHg: shown.displayedMmHg,
    sampling: shown.sampling,
    validated,
    transducerLevelCm,
    zeroed,
  })

  const view = thermodilutionSeriesView(state)
  const flowFrom = (summary: ThermodilutionSeriesSummary | null): AcquiredFlow | null => {
    if (!summary || summary.averageLMin === null || summary.averageUnroundedLMin === null) {
      return null
    }
    const included = state.thermodilutionTrials.filter((trial) =>
      summary.includedTrialIds.includes(trial.id),
    )
    const newest = included.reduce<number | null>((latest, trial) => {
      const at = trial.acquisition?.acquiredAtSeconds ?? trial.generatedAt
      return latest === null || at > latest ? at : latest
    }, null)
    if (newest === null) return null
    return {
      method: 'thermodilution',
      cardiacOutputLMin: summary.averageLMin,
      cardiacIndexLMinM2: summary.averageLMin / state.parameters.bodySurfaceAreaM2,
      trialCount: included.length,
      acquiredAtSeconds: newest,
      ageSeconds: Math.max(0, state.timeSeconds - newest),
      seriesKey: summary.identity.key,
      episode: summary.identity.episode,
      cardiacOutputUnroundedLMin: summary.averageUnroundedLMin,
    }
  }
  const flow = view.currentEstablished ? flowFrom(view.current) : null

  return {
    timeSeconds: state.timeSeconds,
    arterialMean: pressure(readouts.arterial.mean),
    rightAtrialMean: pressure(readouts.rightAtrial),
    flow,
    earlierFlow: flow === null ? flowFrom(view.latestEarlierEstablished) : null,
    physiologicalEpisode: state.physiologicalEpisode,
    sessionId: state.sessionId,
    zeroed,
    transducerLevelCm,
    catheterPosition: state.catheter.position,
    balloonInflated: state.catheter.balloonInflated,
  }
}

const SAMPLING_WORDS: Readonly<Record<DisplayedPressureSampling, string>> = {
  'recent-cardiac-cycle': 'monitor, last cardiac cycle',
  'end-expiratory-c-wave-base': 'monitor, end-expiratory c-wave base',
  'model-estimate': 'model estimate, before the trace had a cycle to read',
}

function pressureWords(label: string, observed: ObservedPressure): string {
  const chain = observed.validated
    ? 'levelled and zeroed'
    : observed.zeroed
      ? `transducer ${observed.transducerLevelCm.toFixed(0)} cm off the reference`
      : 'line not yet zeroed'
  return `${label} ${observed.displayedMmHg} mmHg (${SAMPLING_WORDS[observed.sampling]}; ${chain})`
}

/** One sentence for a decision-trace row: only what was on the screen or had been acquired. */
export function describeObservedSystemState(observed: ObservedSystemState): string {
  const flow =
    observed.flow !== null
      ? `cardiac index ${observed.flow.cardiacIndexLMinM2.toFixed(1)} L/min/m² (thermodilution, ${
          observed.flow.trialCount
        } accepted curves, newest ${observed.flow.ageSeconds.toFixed(0)} s earlier)`
      : observed.earlierFlow !== null
        ? `cardiac index not acquired under the current conditions (the last accepted series, ${observed.earlierFlow.cardiacIndexLMinM2.toFixed(1)} L/min/m², was acquired ${physiologicalEpisodeWords(observed.earlierFlow.episode)} and is not carried forward)`
        : 'cardiac index not acquired (no accepted thermodilution series)'
  return `${pressureWords('MAP', observed.arterialMean)} · ${pressureWords(
    'right atrial mean',
    observed.rightAtrialMean,
  )} · ${flow}.`
}

/**
 * Flow before and after, compared only as what each record actually holds (HD-PRE-REVIEW-02).
 *
 * A series acquired under one set of conditions and a series acquired under another are two
 * measurements of two states, and are compared as such — never averaged, and never read as one
 * series that "moved". When either side holds no series for its conditions, that is said rather
 * than filled in.
 */
export type ObservedFlowComparison =
  | { readonly kind: 'none-acquired' }
  | { readonly kind: 'only-before'; readonly before: AcquiredFlow }
  | { readonly kind: 'only-after'; readonly after: AcquiredFlow }
  | { readonly kind: 'same-series'; readonly flow: AcquiredFlow }
  | {
      readonly kind: 'across-conditions'
      readonly before: AcquiredFlow
      readonly after: AcquiredFlow
      /** From the unrounded series means, then divided by the same body surface area. */
      readonly cardiacIndexChange: number
    }

export function compareObservedFlow(
  before: ObservedSystemState,
  after: ObservedSystemState,
  bodySurfaceAreaM2: number,
): ObservedFlowComparison {
  const earlier = before.flow
  const later = after.flow
  if (earlier === null && later === null) return { kind: 'none-acquired' }
  if (earlier !== null && later === null) return { kind: 'only-before', before: earlier }
  if (earlier === null && later !== null) return { kind: 'only-after', after: later }
  if (earlier!.seriesKey === later!.seriesKey) return { kind: 'same-series', flow: later! }
  return {
    kind: 'across-conditions',
    before: earlier!,
    after: later!,
    cardiacIndexChange:
      (later!.cardiacOutputUnroundedLMin - earlier!.cardiacOutputUnroundedLMin) / bodySurfaceAreaM2,
  }
}
