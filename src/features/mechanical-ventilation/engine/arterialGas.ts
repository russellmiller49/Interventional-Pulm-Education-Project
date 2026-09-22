/**
 * Arterial blood gases as observations, not as a window onto the running model.
 *
 * The bedside panel used to print `state.patient.gasExchange` under the line "Baseline gas
 * shown", so the "baseline" moved with the patient: on MV-14 it read PaO2 76 mmHg at the start of
 * the run and PaO2 97 mmHg a hundred simulated seconds later, without anybody ordering anything.
 * A gas is a specimen. It is drawn once, it says what it said, and time passing afterwards does
 * not revise it.
 *
 * ## The simulation contract, stated once
 *
 * - **Order time** is the simulated second the learner performs `order-abg`.
 * - **Collection time** is the same second. This model has no separate phlebotomy delay, and
 *   inventing one would be inventing physiology; the point of naming it is that the values are
 *   frozen *here* rather than at the moment the result appears.
 * - **Availability time** is the order time plus the intervention's own authored
 *   `latencySeconds` (60 s for `order-abg`). Until then the result is pending; the specimen does
 *   not change while it is pending.
 * - The **baseline** is the case's authored `initialPatient.gasExchange`, collected before the
 *   run starts and available immediately. It is history, not a measurement this learner made.
 *
 * Nothing here chooses a pH, a PaCO2, a bicarbonate or a saturation. Whether the authored values
 * are internally consistent is C5's numerical half and belongs to batch 02; this file only fixes
 * which numbers are being shown and what they are called.
 */
import type { ArterialGasSample, PatientModelState } from './types'

export interface ArterialGasValues {
  readonly pH: number
  readonly paCO2MmHg: number
  readonly paO2MmHg: number
  readonly bicarbonateMmolL: number
}

export function arterialGasValues(
  gasExchange: PatientModelState['gasExchange'],
): ArterialGasValues {
  return {
    pH: gasExchange.pH,
    paCO2MmHg: gasExchange.paCO2MmHg,
    paO2MmHg: gasExchange.paO2MmHg,
    bicarbonateMmolL: gasExchange.bicarbonateMmolL,
  }
}

/** The case's authored presenting gas, as a specimen collected before this run began. */
export function baselineArterialGasSample(
  caseId: string,
  gasExchange: PatientModelState['gasExchange'],
): ArterialGasSample {
  return {
    id: `${caseId}:baseline`,
    kind: 'baseline',
    orderedAtSeconds: null,
    collectedAtSeconds: 0,
    availableAtSeconds: 0,
    values: arterialGasValues(gasExchange),
  }
}

/** A repeat specimen, frozen at the second it is drawn. */
export function collectRepeatArterialGasSample(args: {
  readonly caseId: string
  readonly sequence: number
  readonly collectedAtSeconds: number
  readonly latencySeconds: number
  readonly gasExchange: PatientModelState['gasExchange']
}): ArterialGasSample {
  return {
    id: `${args.caseId}:repeat-${args.sequence}`,
    kind: 'repeat',
    orderedAtSeconds: args.collectedAtSeconds,
    collectedAtSeconds: args.collectedAtSeconds,
    availableAtSeconds: args.collectedAtSeconds + Math.max(0, args.latencySeconds),
    values: arterialGasValues(args.gasExchange),
  }
}

export interface ArterialGasView {
  /** The most recent specimen whose result has come back. Never null: the baseline always has. */
  readonly current: ArterialGasSample
  /** The next specimen due to result, if any are outstanding. */
  readonly pending: ArterialGasSample | null
  /**
   * **Every** specimen still waiting for its own availability time, oldest first.
   *
   * There can be more than one: the workflow allows a second order before the first has resulted.
   * Treating "pending" as a single slot meant the second outstanding specimen was not recognised
   * as pending at all, so the history list printed its four values — and the time it *would*
   * result — while that time was still in the future.
   */
  readonly pendingAll: readonly ArterialGasSample[]
  /** Every specimen, oldest first, including those still processing. */
  readonly all: readonly ArterialGasSample[]
  /** True when the current specimen is the authored baseline rather than one drawn in this run. */
  readonly currentIsBaseline: boolean
  readonly secondsUntilPending: number
}

/** True while this specimen's own result time is still in the future, whatever else is pending. */
export function arterialGasSampleIsPending(
  sample: ArterialGasSample,
  simulationTimeSeconds: number,
): boolean {
  return simulationTimeSeconds < sample.availableAtSeconds
}

/**
 * Which specimen a surface should be showing right now.
 *
 * A result that has come back stays on screen; a later order does not blank it. Nothing is
 * recomputed from the live patient, so an available result is byte-stable from the second it
 * appears.
 */
export function arterialGasView(
  samples: readonly ArterialGasSample[],
  simulationTimeSeconds: number,
): ArterialGasView {
  const available = samples.filter(
    (sample) => !arterialGasSampleIsPending(sample, simulationTimeSeconds),
  )
  const pendingAll = samples.filter((sample) =>
    arterialGasSampleIsPending(sample, simulationTimeSeconds),
  )
  /*
   * The latest specimen that has actually resulted, by availability time rather than by position:
   * an earlier result stays on screen while a later order is still processing, which is what a
   * second order must not take away.
   */
  const current =
    [...available]
      .sort((left, right) => left.availableAtSeconds - right.availableAtSeconds)
      .at(-1) ?? samples[0]
  const pending = pendingAll[0] ?? null
  return {
    current,
    pending,
    pendingAll,
    all: samples,
    currentIsBaseline: current?.kind === 'baseline',
    secondsUntilPending: pending
      ? Math.max(0, pending.availableAtSeconds - simulationTimeSeconds)
      : 0,
  }
}

/**
 * The most recent **repeat** specimen that has resulted, or null.
 *
 * What a surface means when it asks "has a repeat gas come back yet" — the authored baseline is
 * history rather than a sample this learner drew, and post-action coaching keys a PaCO2 reading on
 * a repeat having resulted.
 */
export function latestResultedRepeat(
  samples: readonly ArterialGasSample[],
  simulationTimeSeconds: number,
): ArterialGasSample | null {
  return (
    samples
      .filter(
        (sample) =>
          sample.kind === 'repeat' && !arterialGasSampleIsPending(sample, simulationTimeSeconds),
      )
      .sort((left, right) => left.availableAtSeconds - right.availableAtSeconds)
      .at(-1) ?? null
  )
}

/**
 * How the panel names a specimen, with its own clock rather than the patient's.
 *
 * Tensed to the specimen, so a sample that has not come back is not described as having resulted
 * at a time that has not happened yet. Pass the current simulated time wherever a pending specimen
 * can appear; without it the label reads as the past, which is right for a resulted sample.
 */
export function arterialGasSampleLabel(
  sample: ArterialGasSample,
  simulationTimeSeconds?: number,
): string {
  if (sample.kind === 'baseline') return 'Baseline gas supplied with the case, before this run'
  const pending =
    simulationTimeSeconds !== undefined && arterialGasSampleIsPending(sample, simulationTimeSeconds)
  return pending
    ? `Repeat gas drawn at ${sample.collectedAtSeconds.toFixed(0)} s, result due at ${sample.availableAtSeconds.toFixed(0)} s`
    : `Repeat gas drawn at ${sample.collectedAtSeconds.toFixed(0)} s, resulted at ${sample.availableAtSeconds.toFixed(0)} s`
}
