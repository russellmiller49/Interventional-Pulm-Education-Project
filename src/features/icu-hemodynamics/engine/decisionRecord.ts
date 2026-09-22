import {
  monitorPressureReadouts,
  type DisplayedPressure,
  type DisplayedPressureSampling,
} from './monitorDisplay'
import {
  thermodilutionAcceptedAverage,
  thermodilutionTrialCountsTowardSeries,
} from './thermodilution'
import type { HemodynamicSimulationState } from './types'

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
 * earlier row. `HD-PRE-REVIEW-02` extends this with condition and series identity and matched-time
 * comparison; the fields it needs — method, trial count, acquisition time, validation state — are
 * captured here rather than flattened into the sentence.
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
}

export interface ObservedSystemState {
  readonly timeSeconds: number
  readonly arterialMean: ObservedPressure
  readonly rightAtrialMean: ObservedPressure
  /** `null` when no supported acquisition has produced a series. Missing is not zero. */
  readonly flow: AcquiredFlow | null
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

  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  const series = state.thermodilutionTrials.filter(thermodilutionTrialCountsTowardSeries)
  const newest = series.reduce<number | null>(
    (latest, trial) => (latest === null || trial.generatedAt > latest ? trial.generatedAt : latest),
    null,
  )
  const flow: AcquiredFlow | null =
    average === null || newest === null
      ? null
      : {
          method: 'thermodilution',
          cardiacOutputLMin: average,
          cardiacIndexLMinM2: average / state.parameters.bodySurfaceAreaM2,
          trialCount: series.length,
          acquiredAtSeconds: newest,
          ageSeconds: Math.max(0, state.timeSeconds - newest),
        }

  return {
    timeSeconds: state.timeSeconds,
    arterialMean: pressure(readouts.arterial.mean),
    rightAtrialMean: pressure(readouts.rightAtrial),
    flow,
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
    observed.flow === null
      ? 'cardiac index not acquired (no accepted thermodilution series)'
      : `cardiac index ${observed.flow.cardiacIndexLMinM2.toFixed(1)} L/min/m² (thermodilution, ${
          observed.flow.trialCount
        } accepted curves, newest ${observed.flow.ageSeconds.toFixed(0)} s earlier)`
  return `${pressureWords('MAP', observed.arterialMean)} · ${pressureWords(
    'right atrial mean',
    observed.rightAtrialMean,
  )} · ${flow}.`
}
