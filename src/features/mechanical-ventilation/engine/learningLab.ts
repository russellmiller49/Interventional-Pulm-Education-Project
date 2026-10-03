import { z } from 'zod'
import { FOUNDATION_EVIDENCE_VERSION, isFoundationUnit } from '../content/foundations'
import { completedBreath } from './teachingBreath'
import {
  measurementInputs,
  updateHoldAcquisition,
  type HoldAcquisition,
  type CapturedHold,
} from './learningMeasurements'
import { observationFor } from './learningObservation'
import {
  ventilationExperimentByUnit,
  type LabGoal,
  type LabMetric,
  type LabRound,
} from '../content/learningExperiments'
import { resolveVentilationSimulationCase } from '../content/learningPatient'
import { ventilationLessonAttempt } from '../content/lessonRuntime'
import { plateauReadingValidity } from '../content/plateauValidity'
import {
  advanceSimulation,
  createInitialSimulationState,
  reopenAlarmEpoch,
  shiftBreathClock,
} from './simulation'
import { ventilationSimulationReducer } from './reducer'
import {
  ventilatorDeviceIds,
  type PauseOrigin,
  type VentilationAction,
  type VentilationSimulationState,
  type VentilatorControlKey,
  type VentilatorDeviceId,
  type WaveformSample,
} from './types'

export const VENTILATION_LAB_STORAGE_KEY = 'mechanical-ventilation-live-learning-v1'
export const labMetricLabels: Record<LabMetric, { label: string; unit: string; digits: number }> = {
  peak: { label: 'Peak pressure', unit: 'cmH₂O', digits: 1 },
  plateau: { label: 'Plateau', unit: 'cmH₂O', digits: 1 },
  volume: { label: 'Exhaled volume', unit: 'mL', digits: 0 },
  rate: { label: 'Delivered rate', unit: '/min', digits: 0 },
  minute: { label: 'Minute ventilation', unit: 'L/min', digits: 1 },
  ti: { label: 'Inspiratory time', unit: 's', digits: 2 },
  expiratoryFlow: { label: 'Flow before next breath', unit: 'L/min', digits: 1 },
  intrinsicPeep: { label: 'Intrinsic PEEP', unit: 'cmH₂O', digits: 1 },
  spo2: { label: 'SpO₂', unit: '%', digits: 0 },
  co2: { label: 'Modeled PaCO₂', unit: 'mmHg', digits: 1 },
  map: { label: 'MAP', unit: 'mmHg', digits: 0 },
  effort: { label: 'End-inspiratory effort', unit: 'cmH₂O', digits: 1 },
  missed: { label: 'Missed efforts', unit: '%', digits: 0 },
  dyspnea: { label: 'Dyspnea', unit: '/10', digits: 1 },
  pain: { label: 'Pain', unit: '/10', digits: 1 },
  anxiety: { label: 'Anxiety', unit: '/10', digits: 1 },
}
export interface LabSnapshot {
  readonly values: Record<LabMetric, number>
  readonly plateauValid: boolean
  readonly waveforms: readonly WaveformSample[]
  readonly at: number
  readonly inputs?: Record<string, string | number>
  readonly plateauSource?: 'modeled' | 'captured' | 'historical'
  readonly hold?: CapturedHold
  readonly issues?: readonly string[]
}
export function labSnapshot(
  state: VentilationSimulationState,
  holds: readonly CapturedHold[] = [],
  revision = 0,
): LabSnapshot {
  const lastHold = holds.filter((h) => h.hold === 'inspiratory').at(-1)
  const currentHold = lastHold?.revision === revision ? lastHold : undefined
  const m = state.measurements,
    p = state.patient
  return {
    values: {
      peak: m.peakPressureCmH2O,
      plateau: lastHold?.value ?? m.plateauPressureCmH2O,
      volume: m.exhaledVtMl,
      rate: m.totalRatePerMin,
      minute: m.minuteVentilationLMin,
      ti: m.mechanicalInspiratoryTimeSeconds,
      expiratoryFlow: m.expiratoryFlowAtNextBreathLMin,
      intrinsicPeep: m.intrinsicPeepCmH2O,
      spo2: p.gasExchange.spo2Percent,
      co2: p.gasExchange.paCO2MmHg,
      map: p.hemodynamics.mapMmHg,
      effort: m.endInspiratoryEffortCmH2O,
      missed: m.ineffectiveEffortFraction * 100,
      dyspnea: p.human.dyspneaScore,
      pain: p.human.painScore,
      anxiety: p.human.anxietyScore,
    },
    plateauValid: lastHold
      ? Boolean(currentHold?.interpretable)
      : plateauReadingValidity(state).interpretable,
    plateauSource: currentHold ? 'captured' : lastHold ? 'historical' : 'modeled',
    hold: lastHold,
    inputs: measurementInputs(state),
    /*
     * Every sample the engine produced, at its own 20 ms spacing.
     *
     * This used to keep one sample in four so the record would fit a saved checkpoint. Nothing
     * saves a lab checkpoint any more — the self-paced Learn host keeps runs in memory only — and
     * the thinning is what turned the captured baseline into an 80 ms trace beside the 20 ms
     * reference: the end-inspiratory drop became a ramp, and a breath's onset-to-onset duration
     * could read 3.68 s at a set rate of 16/min because both onsets had to land on every fourth
     * sample. The record is the acquisition; a figure that needs fewer points thins at drawing
     * time, not here.
     */
    waveforms: state.waveforms,
    at: state.simulationTime,
  }
}
export function labControlValue(
  state: VentilationSimulationState,
  key: VentilatorControlKey,
): number {
  const s = state.ventilator.settings
  if (key === 'triggerThreshold')
    return s.trigger.type === 'flow' ? s.trigger.thresholdLMin : s.trigger.thresholdCmH2O
  const value = (s as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : 0
}
export function labGoalAction(goal: LabGoal): VentilationAction | null {
  if (goal.type === 'control') return { type: 'SET_CONTROL', control: goal.key, value: goal.value }
  if (goal.type === 'mechanics')
    return { type: 'SET_TEACHING_MECHANICS', overrides: { [goal.key]: goal.value } }
  if (goal.type === 'hold') return { type: 'PERFORM_HOLD', hold: goal.hold }
  if (goal.type === 'intervention') return { type: 'PERFORM_INTERVENTION', interventionId: goal.id }
  return null
}
export type LabPhase = 'explore' | 'predict' | 'experiment' | 'compare' | 'complete'
export interface LabEvidence {
  readonly prediction?: number
  readonly confidence?: 'sure' | 'unsure'
  readonly baseline?: LabSnapshot
  readonly response?: LabSnapshot
  /** Kept for saved records written before the reflection box was retired; never required. */
  readonly reflection?: string
  /** The stop chosen on the breath map, for sections that ask where the problem lives first. */
  readonly location?: string
  /** The settings sort, committed as a set: row id → the origin chosen. */
  readonly sort?: Readonly<Record<string, 'set' | 'reported'>>
  readonly observation?: { readonly choice: string; readonly correct: boolean; readonly at: string }
  readonly inspection?: {
    readonly sample: WaveformSample
    readonly previous: WaveformSample
    /** Manual Pause may select a breath after the initial baseline window. */
    readonly waveforms?: readonly WaveformSample[]
  }
  readonly completedAt?: string
}
export interface LabHistoricalRun {
  readonly evidenceVersion: number
  readonly round: 0 | 1
  readonly device: VentilatorDeviceId
  readonly evidence: readonly [LabEvidence, LabEvidence]
  readonly holds?: readonly CapturedHold[]
  readonly completedAt?: string
  readonly reason: string
}
export interface LabEvent {
  readonly at: number
  readonly action: VentilationAction
}
export interface LabCheckpoint {
  readonly version: 1
  readonly unitId: string
  readonly round: 0 | 1
  readonly phase: LabPhase
  readonly device: VentilatorDeviceId
  readonly time: number
  readonly events: readonly LabEvent[]
  readonly evidence: readonly [LabEvidence, LabEvidence]
  readonly observedHolds: readonly ('inspiratory' | 'expiratory')[]
  readonly readySince: number | null
  readonly evidenceVersion?: 2
  readonly conditionRevision?: number
  readonly holds?: readonly CapturedHold[]
  readonly acquisition?: HoldAcquisition
  readonly confounds?: readonly string[]
  readonly history?: readonly LabHistoricalRun[]
  readonly completedAt?: string
}
export interface LabSession extends LabCheckpoint {
  readonly simulation: VentilationSimulationState
  /**
   * Who asked for the pause that is in force, for as long as it is: `'learner'` for the learner's
   * own Pause, `'background'` when the page was hidden or suspended while the model was running.
   * Null while the model runs, and for a pause the program applied itself. Transient: it is never
   * part of a checkpoint and never decides whether a goal is met — the inspection record does.
   */
  readonly pauseOrigin?: PauseOrigin | null
}
export interface LabProgress {
  readonly version: 1
  readonly units: Readonly<Record<string, LabCheckpoint>>
}
export const emptyLabProgress = (): LabProgress => ({ version: 1, units: {} })
/*
 * A captured record keeps the engine's 12-second window at 50 Hz (600 samples) rather than every
 * fourth sample, and a baseline may keep up to this many when the window alone cannot verify a
 * breath (`baselineRecord`). Older records, written with at most 160, parse exactly as they did;
 * the bound only grew, so nothing that was accepted is refused.
 */
const LAB_RECORD_MAX_SAMPLES = 800
/** A breath a figure will draw: one inspiratory onset to the next, as `completedBreath` finds it. */
const holdsCompleteBreath = (samples: readonly WaveformSample[]) =>
  completedBreath(samples).length >= 4
/**
 * The record a round's baseline is drawn from.
 *
 * It is the opening 12-second window whenever that window verifies one complete breath — on every
 * authored round but one, so those records are exactly what they were. The exception is why this
 * exists. The warm-up below is a whole number of breaths, so a round opens with its next onset due
 * at time zero and its window ending on the last expiratory sample; at 10/min (Section 8, first
 * application) the 600-sample window is then exactly two 6-second cycles, from the first
 * inspiratory sample of one breath (−11.98 s) to the last expiratory sample of the next (0.00 s).
 * An onset is verified by the expiratory sample before it. The window holds that pair once, at
 * −6.00/−5.98 s; the earlier pair lost its expiratory half (−12.00 s) to the 600-sample cap by one
 * sample, and the later one's inspiratory half (+0.02 s) has not been produced, because a baseline
 * is taken before anything runs. Both breaths happened; neither could be shown to have.
 *
 * The samples the cap dropped are the same warm-up's — the same patient on the same settings,
 * a few seconds earlier — so the record keeps them, as many as a saved record may hold, when and
 * only when the window needs them to verify a breath. They are the engine's own samples at their
 * own times: nothing is synthesised, interpolated, moved or re-spaced, and the patient the round
 * opens on is untouched (`openLabRound` builds the simulation `createLabSimulation` always built).
 * A record that still cannot verify a breath is returned as the window, and the figure says it
 * holds none.
 */
function baselineRecord(
  window: readonly WaveformSample[],
  earlier: readonly WaveformSample[],
): readonly WaveformSample[] {
  if (holdsCompleteBreath(window)) return window
  const room = LAB_RECORD_MAX_SAMPLES - window.length
  if (room <= 0 || earlier.length === 0) return window
  const extended = [...earlier.slice(-room), ...window]
  return holdsCompleteBreath(extended) ? extended : window
}
/** A round's patient as it opens, and the record its baseline is taken from. */
export interface LabOpening {
  /** Model time zero: the warm-up has run, nothing else has, and nothing has been changed. */
  readonly simulation: VentilationSimulationState
  /** `simulation.waveforms`, preceded by earlier warm-up samples only when it needs them. */
  readonly baselineRecord: readonly WaveformSample[]
}
export function openLabRound(
  unitId: string,
  roundIndex: 0 | 1,
  device: VentilatorDeviceId,
): LabOpening {
  const round = ventilationExperimentByUnit.get(unitId)!.rounds[roundIndex]
  const attempt =
    round.caseId === 'MV-08'
      ? ventilationLessonAttempt(
          {
            caseId: 'MV-08',
            branch: 'condensate',
            goal: '',
            actions: [],
            requiredEvidence: [],
            responseSeconds: 0,
          },
          1,
        )
      : 1
  let simulation = createInitialSimulationState(round.caseId, 'learn', attempt, device)
  for (const command of round.setup ?? [])
    simulation = ventilationSimulationReducer(simulation, command)
  // Fill a full window with this baseline, including any authored setup changes.
  const warmup = (4 * 60) / simulation.measurements.totalRatePerMin
  // Every sample of the warm-up, including those the 12-second buffer drops (see `baselineRecord`).
  const produced: WaveformSample[] = []
  simulation = advanceSimulation({ ...simulation, paused: false }, warmup, undefined, produced)
  const rebase = (sample: WaveformSample) => ({ ...sample, time: sample.time - warmup })
  const dropped = produced.slice(0, Math.max(0, produced.length - simulation.waveforms.length))
  /*
   * The clock is set back by `warmup` — a whole number of breaths, so the breath schedule is
   * continuous across zero — and the alarm epoch with it: alarms raised during the warm-up used to
   * keep start times several seconds into a round that had not begun. The breath timer holds its
   * next onset as a time, so it moves by the same amount; left alone it would wait `warmup` seconds
   * for an onset that had already been re-based to zero.
   */
  const opened = reopenAlarmEpoch({
    ...simulation,
    simulationTime: 0,
    ventilator: {
      ...simulation.ventilator,
      breathClock: shiftBreathClock(simulation.ventilator.breathClock, -warmup),
    },
    prediction: { ...simulation.prediction, committed: false },
    waveforms: simulation.waveforms.map(rebase),
    trends: [],
    risk: {
      highPlateau: 0,
      stackedVolume: 0,
      dynamicHyperinflation: 0,
      hypoxemia: 0,
      hypotension: 0,
      excessiveSedation: 0,
    },
    criticalErrors: [],
    paused: false,
  })
  return {
    simulation: opened,
    baselineRecord: baselineRecord(opened.waveforms, dropped.map(rebase)),
  }
}
export function createLabSimulation(
  unitId: string,
  roundIndex: 0 | 1,
  device: VentilatorDeviceId,
): VentilationSimulationState {
  return openLabRound(unitId, roundIndex, device).simulation
}
/**
 * An experiment's baseline: the readings of a patient nothing has been done to, with the record
 * that verifies one of its breaths.
 *
 * It is built from an opening and from nothing else. A baseline used to be `labSnapshot` of
 * whatever patient the session held when the prediction was committed, and on the prediction step
 * that patient has live controls and a Run button: the requested change could be made and run first,
 * and the snapshot of the changed patient was then retained and labelled the baseline.
 */
function labBaselineSnapshot(opening: LabOpening): LabSnapshot {
  return { ...labSnapshot(opening.simulation), waveforms: opening.baselineRecord }
}
/** Nothing has been run and nothing has been changed since this session's patient was opened. */
function labPatientUntouched(session: LabSession): boolean {
  return session.simulation.simulationTime === 0 && session.events.length === 0
}
export function createLabSession(
  unitId: string,
  device: VentilatorDeviceId = 'hamilton-c6',
  saved?: LabCheckpoint,
): LabSession {
  if (!saved)
    return {
      version: 1,
      evidenceVersion: FOUNDATION_EVIDENCE_VERSION,
      conditionRevision: 0,
      holds: [],
      confounds: [],
      unitId,
      round: 0,
      phase: 'explore',
      device,
      time: 0,
      events: [],
      evidence: [{}, {}],
      observedHolds: [],
      readySince: null,
      simulation: createLabSimulation(unitId, 0, device),
    }
  if (isFoundationUnit(unitId) && saved.evidenceVersion !== FOUNDATION_EVIDENCE_VERSION) {
    return {
      ...createLabSession(unitId, saved.device),
      history: archiveLabRun(saved, 'Earlier lesson version; retained as historical evidence'),
    }
  }
  let simulation = createLabSimulation(unitId, saved.round, saved.device)
  for (const event of saved.events) {
    if (event.at > simulation.simulationTime)
      simulation = advanceSimulation(simulation, event.at - simulation.simulationTime)
    simulation = ventilationSimulationReducer(simulation, event.action)
  }
  if (saved.time > simulation.simulationTime)
    simulation = advanceSimulation(simulation, saved.time - simulation.simulationTime)
  return { ...saved, simulation: { ...simulation, paused: true, speed: 1 } }
}
export function labCheckpoint(session: LabSession): LabCheckpoint {
  const { simulation, pauseOrigin, ...record } = session
  void pauseOrigin // transient: who paused is never part of a checkpoint
  return { ...record, time: simulation.simulationTime }
}
export function labGoalMet(goal: LabGoal, session: LabSession): boolean {
  if (goal.type === 'control')
    return Math.abs(labControlValue(session.simulation, goal.key) - goal.value) < 0.01
  if (goal.type === 'mechanics')
    return Math.abs(session.simulation.teachingMechanics[goal.key] - goal.value) < 0.01
  if (goal.type === 'hold') {
    const acquired = session.holds
      ?.filter((h) => h.hold === goal.hold && h.revision === (session.conditionRevision ?? 0))
      .at(-1)
    return Boolean(
      acquired && (session.unitId !== 'mechanics-load-and-pressure' || acquired.interpretable),
    )
  }
  if (goal.type === 'inspect-inspiration')
    return session.evidence[session.round].inspection?.sample.phase === 'inspiration'
  /*
   * Met by the inspection record and by nothing else.
   *
   * This used to fall through to "the model is paused, four seconds have passed and the last sample
   * is expiratory", which read the learner's intent off `paused === true`. The model is also
   * paused when the page goes to the background, when one breath is stepped, at the model-time
   * limit and after a capture, and none of those is the learner reading the breath: a hidden tab
   * was recorded as an inspection and, with automatic capture on, captured (PR #290 review, R1).
   * The record is written in exactly two places below — the learner's own Pause, and Use this
   * captured interval — so the goal is theirs or it is not met.
   */
  if (goal.type === 'pause-expiration')
    return session.evidence[session.round].inspection?.sample.phase === 'expiration'
  return (
    session.events.some(
      (event) =>
        event.action.type === 'PERFORM_INTERVENTION' && event.action.interventionId === goal.id,
    ) &&
    session.simulation.interventions.some(
      (item) =>
        item.interventionId === goal.id && item.effectiveAt <= session.simulation.simulationTime,
    )
  )
}
/**
 * Whether the live record holds a breath the comparison can draw: one inspiratory onset to the next.
 *
 * The record is the engine's 12-second window, so this is not a given. After Section 11's first
 * application clears the condensate the patient breathes at 8/min — 7.5 s a breath — and the window
 * holds two onsets only part of the time: sampled every 0.1 s for 20 s after the interval had
 * elapsed, 39 % of instants had no complete breath on any of the four consoles, and a result
 * captured at one of them would have had nothing to draw.
 */
export function labRecordHoldsCompleteBreath(session: LabSession): boolean {
  return holdsCompleteBreath(session.simulation.waveforms)
}
/**
 * Whether the round's result may be captured: the one gate the Capture button, the status panel
 * and automatic capture all read.
 *
 * The last condition is the evidence a captured result is drawn from. The review of PR #290 asked
 * whether a complete breath was already guaranteed by the rest of the gate; it was not (see
 * `labRecordHoldsCompleteBreath`), so it is required here, once, rather than inferred.
 *
 * What the gate still gives transitively, and `__tests__/mv-pre-review-03-repairs.test.tsx` holds
 * against every authored round on every console:
 *
 *   - That breath is one delivered under the requested conditions. A round that changes something,
 *     performs a hold or takes a bedside action counts its interval from `readySince`, the moment
 *     everything requested was in place, and each such interval is longer than two breath periods
 *     at the rate that follows the change; `completedBreath` is the last onset-to-onset breath in
 *     the record, so whenever this is true it began after `readySince`.
 *   - Section 1's two rounds have no interval; their evidence is the inspection record, taken from
 *     a complete captured breath (Use this captured interval) or from the learner's own Pause at
 *     least four model seconds — more than one breath period — into the run.
 *
 * The baseline is captured when the experiment starts, before anything runs, so this gate cannot
 * speak for it and does not need to: a baseline is taken only from a round's opening
 * (`labBaselineSnapshot`), whose record keeps the warm-up samples that verify one of its breaths
 * (`baselineRecord`). `__tests__/mv-pre-review-03-baseline-evidence.test.tsx` holds a complete,
 * drawable baseline breath for every authored round on every console.
 */
export function labReadyToCompare(session: LabSession): boolean {
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
  return (
    session.phase === 'experiment' &&
    session.readySince !== null &&
    round.goals.every((goal) => labGoalMet(goal, session)) &&
    session.simulation.simulationTime - session.readySince >= round.seconds &&
    labRecordHoldsCompleteBreath(session)
  )
}
const transientActions = new Set([
  'TICK',
  'STEP_BREATH',
  'SET_PAUSED',
  'SET_SPEED',
  'SET_SCREEN',
  'TOGGLE_ALARM_AUDIO',
])
export type LabAction =
  | { type: 'ENGINE'; action: VentilationAction }
  | { type: 'OPEN_ROUND'; round: 0 | 1 }
  | { type: 'START_EXPERIMENT' }
  | { type: 'PREDICT' }
  | { type: 'COMMIT'; choice: number; confidence?: 'sure' | 'unsure' }
  | { type: 'COMPARE' }
  | { type: 'INSPECT'; sampleTime: number }
  | { type: 'INTERPRET'; choice: string; now: string }
  | { type: 'REFLECT'; text: string }
  /** Where on the breath the learner placed the problem, committed once per round. */
  | { type: 'LOCATE'; choiceId: string }
  /** The settings sort, committed as a set once. */
  | { type: 'SORT'; answers: Readonly<Record<string, 'set' | 'reported'>> }
  | { type: 'CONTINUE'; now: string }
  | { type: 'RESET' }
  /** Start the section again from nothing: a fresh patient and no commitments. */
  | { type: 'RESTART' }
  | { type: 'DEVICE'; device: VentilatorDeviceId }
function setEvidence(session: LabSession, value: LabEvidence): readonly [LabEvidence, LabEvidence] {
  return session.round === 0 ? [value, session.evidence[1]] : [session.evidence[0], value]
}
function archiveLabRun(session: LabCheckpoint, reason: string): readonly LabHistoricalRun[] {
  if (!session.evidence.some((e) => e.prediction !== undefined || e.response || e.sort))
    return session.history ?? []
  return [
    ...(session.history ?? []),
    {
      evidenceVersion: session.evidenceVersion ?? 1,
      round: session.round,
      device: session.device,
      evidence: session.evidence,
      holds: session.holds,
      completedAt: session.completedAt,
      reason,
    },
  ].slice(-20)
}
export function labUnitComplete(record?: LabCheckpoint): boolean {
  return Boolean(
    record?.completedAt &&
    (!isFoundationUnit(record.unitId) ||
      (record.evidenceVersion === FOUNDATION_EVIDENCE_VERSION &&
        record.evidence.every((e) => e.observation))),
  )
}
/**
 * The origin of the pause in force after an action, decided in one place for every return path.
 *
 * A pause that stops a running model takes the origin its action carries. It is kept only while
 * the same patient stays paused where it was: Run, one breath, a reset, a new round or a capture
 * all end it. It is presentation state (the panel says why the clock stopped); credit is decided
 * where the inspection record is written.
 */
function pauseOriginAfter(
  before: LabSession,
  action: LabAction,
  after: LabSession,
): PauseOrigin | null {
  if (!after.simulation.paused) return null
  if (action.type === 'ENGINE' && action.action.type === 'SET_PAUSED')
    return action.action.paused && !before.simulation.paused
      ? (action.action.origin ?? null)
      : (before.pauseOrigin ?? null)
  const samePatientWhereItWas =
    before.simulation.paused &&
    after.round === before.round &&
    after.device === before.device &&
    after.simulation.simulationTime === before.simulation.simulationTime &&
    (action.type === 'ENGINE' || after.simulation === before.simulation)
  return samePatientWhereItWas ? (before.pauseOrigin ?? null) : null
}
export function learningLabReducer(session: LabSession, action: LabAction): LabSession {
  const next = reduceLearningLab(session, action)
  const pauseOrigin = pauseOriginAfter(session, action, next)
  return (next.pauseOrigin ?? null) === pauseOrigin ? next : { ...next, pauseOrigin }
}
function reduceLearningLab(session: LabSession, action: LabAction): LabSession {
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
  const evidence = session.evidence[session.round]
  if (action.type === 'OPEN_ROUND') {
    if (action.round === session.round) return session
    const fresh = createLabSession(session.unitId, session.device)
    return {
      ...fresh,
      round: action.round,
      simulation: {
        ...createLabSimulation(session.unitId, action.round, session.device),
        paused: true,
      },
    }
  }
  if (action.type === 'START_EXPERIMENT') {
    if (session.phase === 'experiment' || session.phase === 'compare') return session
    const opening = openLabRound(session.unitId, session.round, session.device)
    const simulation = { ...opening.simulation, paused: true }
    return {
      ...session,
      phase: 'experiment',
      simulation,
      time: 0,
      events: [],
      holds: [],
      acquisition: undefined,
      observedHolds: [],
      readySince: null,
      conditionRevision: 0,
      confounds: [],
      completedAt: undefined,
      evidence: setEvidence(session, {
        prediction: evidence.prediction,
        confidence: evidence.confidence,
        location: evidence.location,
        baseline: labBaselineSnapshot(opening),
      }),
    }
  }
  if (action.type === 'DEVICE' || action.type === 'RESTART')
    return {
      ...createLabSession(
        session.unitId,
        action.type === 'DEVICE' ? action.device : session.device,
      ),
      history: archiveLabRun(
        session,
        action.type === 'DEVICE' ? 'Device changed' : 'Section restarted',
      ),
    }
  if (
    action.type === 'INSPECT' &&
    session.phase === 'experiment' &&
    round.goals.some((g) => g.type === 'pause-expiration' || g.type === 'inspect-inspiration')
  ) {
    const breath = completedBreath(evidence.baseline?.waveforms ?? [])
    const index = breath.findIndex((s) => s.time === action.sampleTime)
    if (index < 1 || index >= breath.length - 1) return session
    const next = {
      ...session,
      evidence: setEvidence(session, {
        ...evidence,
        inspection: { sample: breath[index], previous: breath[index - 1] },
      }),
    }
    return {
      ...next,
      readySince: round.goals.every((g) => labGoalMet(g, next))
        ? session.simulation.simulationTime
        : null,
    }
  }
  if (
    action.type === 'INTERPRET' &&
    session.phase === 'compare' &&
    !evidence.observation &&
    evidence.response &&
    isFoundationUnit(session.unitId)
  ) {
    const item = observationFor(session)
    if (!item.choices.some((c) => c.id === action.choice)) return session
    return {
      ...session,
      evidence: setEvidence(session, {
        ...evidence,
        observation: {
          choice: action.choice,
          correct: item.correct === action.choice,
          at: action.now,
        },
      }),
    }
  }
  if (action.type === 'LOCATE' && evidence.location === undefined && action.choiceId.length > 0)
    return {
      ...session,
      evidence: setEvidence(session, { ...evidence, location: action.choiceId.slice(0, 40) }),
    }
  // The sort belongs to the section, not to a round: it is asked between the first reveal and the
  // transfer, so it is recorded with the first round's commitments whatever round the lab is in.
  if (action.type === 'SORT' && session.evidence[0].sort === undefined) {
    const entries = Object.entries(action.answers).slice(0, 12)
    if (entries.length === 0) return session
    return {
      ...session,
      evidence: [
        { ...session.evidence[0], sort: Object.fromEntries(entries) },
        session.evidence[1],
      ],
    }
  }
  if (action.type === 'RESET') {
    const opening = openLabRound(session.unitId, session.round, session.device)
    const simulation = opening.simulation
    return {
      ...session,
      phase: evidence.prediction === undefined ? 'explore' : 'experiment',
      time: 0,
      simulation,
      events: [],
      observedHolds: [],
      holds: [],
      acquisition: undefined,
      conditionRevision: 0,
      confounds: [],
      history: archiveLabRun(session, 'Patient reset; first prediction retained'),
      readySince: null,
      completedAt: undefined,
      evidence: setEvidence(session, {
        prediction: evidence.prediction,
        confidence: evidence.confidence,
        location: evidence.location,
        sort: evidence.sort,
        ...(evidence.prediction === undefined ? {} : { baseline: labBaselineSnapshot(opening) }),
      }),
    }
  }
  if (action.type === 'PREDICT' && session.phase === 'explore') {
    // A fresh baseline makes the prediction about an unperformed experiment, even after free exploration.
    const opening = openLabRound(session.unitId, session.round, session.device)
    return {
      ...session,
      simulation: opening.simulation,
      phase: 'predict',
      ...(isFoundationUnit(session.unitId)
        ? {
            evidence: setEvidence(session, { ...evidence, baseline: labBaselineSnapshot(opening) }),
          }
        : {}),
      holds: [],
      acquisition: undefined,
      conditionRevision: 0,
      confounds: [],
      events: [],
      observedHolds: [],
      readySince: null,
      time: 0,
    }
  }
  if (
    action.type === 'COMMIT' &&
    ['explore', 'predict', 'experiment'].includes(session.phase) &&
    [0, 1, 2].includes(action.choice)
  ) {
    const committed = { ...evidence, prediction: action.choice, confidence: action.confidence }
    /*
     * The prediction opens the experiment only when its baseline is, or can still truthfully be,
     * this patient's opening: one already retained, or a patient nothing has been run on or changed
     * since it opened (then the opening is recomputed, which is the same patient). A patient that
     * has been explored has no baseline to give — the requested change may already be in it — so
     * the prediction is recorded and the experiment waits for Start the experiment, which opens a
     * fresh patient. Nothing a learner has changed is ever retained under the name baseline.
     */
    const baseline =
      evidence.baseline ??
      (labPatientUntouched(session)
        ? labBaselineSnapshot(openLabRound(session.unitId, session.round, session.device))
        : undefined)
    if (!baseline) return { ...session, evidence: setEvidence(session, committed) }
    return {
      ...session,
      phase: 'experiment',
      evidence: setEvidence(session, { ...committed, baseline }),
    }
  }
  if (action.type === 'COMPARE' && labReadyToCompare(session))
    return {
      ...session,
      phase: 'compare',
      simulation: { ...session.simulation, paused: true },
      evidence: setEvidence(session, {
        ...evidence,
        response: {
          ...labSnapshot(session.simulation, session.holds, session.conditionRevision),
          issues: session.confounds ?? [],
        },
      }),
    }
  if (action.type === 'REFLECT' && session.phase === 'compare')
    return {
      ...session,
      evidence: setEvidence(session, { ...evidence, reflection: action.text.slice(0, 1200) }),
    }
  // Every round needs its captured response. The five revised tasks also require a recorded
  // observation, regardless of correctness. The retired prose-length gate stays retired.
  if (
    action.type === 'CONTINUE' &&
    session.phase === 'compare' &&
    evidence.response &&
    (!isFoundationUnit(session.unitId) || evidence.observation)
  ) {
    const nextEvidence = setEvidence(session, { ...evidence, completedAt: action.now })
    if (session.round === 1)
      return { ...session, phase: 'complete', evidence: nextEvidence, completedAt: action.now }
    return {
      ...session,
      round: 1,
      phase: 'explore',
      holds: [],
      acquisition: undefined,
      conditionRevision: 0,
      confounds: [],
      simulation: createLabSimulation(session.unitId, 1, session.device),
      time: 0,
      events: [],
      observedHolds: [],
      readySince: null,
      evidence: nextEvidence,
    }
  }
  if (action.type !== 'ENGINE') return session
  if (
    [
      'LOAD_CASE',
      'CHANGE_DEVICE',
      'REVEAL_DEBRIEF',
      'COMMIT_PREDICTION',
      'COMMIT_REASSESSMENT',
      'TOGGLE_EDUCATOR_OVERLAY',
    ].includes(action.action.type)
  )
    return session
  if (session.events.length >= 512 && !transientActions.has(action.action.type)) return session
  // Keep the evidence observer at actual maneuver boundaries even when the caller advances
  // several seconds at once. The underlying physiology reducer and clock remain authoritative.
  if (
    action.action.type === 'TICK' &&
    (action.action.seconds ?? 0.1) > 0.1 &&
    (session.acquisition ||
      session.simulation.ventilator.pendingHold ||
      session.simulation.ventilator.holdType) &&
    !session.simulation.paused
  ) {
    let next = session
    let remaining = action.action.seconds ?? 0.1
    while (
      remaining > 0.10001 &&
      (next.acquisition ||
        next.simulation.ventilator.holdType ||
        next.simulation.ventilator.pendingHold)
    ) {
      next = learningLabReducer(next, { type: 'ENGINE', action: { type: 'TICK', seconds: 0.1 } })
      remaining -= 0.1
    }
    return learningLabReducer(next, {
      type: 'ENGINE',
      action: { type: 'TICK', seconds: remaining },
    })
  }
  const before = session.simulation
  if (action.action.type === 'TICK' && before.simulationTime >= 900)
    return { ...session, simulation: { ...before, paused: true } }
  const simulation = ventilationSimulationReducer(before, action.action)
  if (simulation === before) return session
  const events = !transientActions.has(action.action.type)
    ? [...session.events, { at: before.simulationTime, action: action.action }]
    : session.events
  const oldInputs = measurementInputs(before),
    newInputs = measurementInputs(simulation)
  const changed = [...new Set([...Object.keys(oldInputs), ...Object.keys(newInputs)])].filter(
    (key) => oldInputs[key] !== newInputs[key],
  )
  const conditionRevision = (session.conditionRevision ?? 0) + (changed.length ? 1 : 0)
  const { acquisition, captured } = updateHoldAcquisition(
    before,
    simulation,
    conditionRevision,
    session.acquisition,
  )
  const holds = captured ? [...(session.holds ?? []), captured].slice(-30) : (session.holds ?? [])
  const observedHolds = [...new Set(holds.map((h) => h.hold))]
  const allowedKeys = round.goals.flatMap((g) =>
    g.type === 'control' || g.type === 'mechanics'
      ? [g.key]
      : g.type === 'intervention'
        ? ['interventions']
        : [],
  )
  const issues =
    session.phase === 'experiment'
      ? changed.filter((k) => !allowedKeys.includes(k)).map((k) => `Additional input changed: ${k}`)
      : []
  if (
    session.phase === 'experiment' &&
    simulation.alarms.some(
      (a) => a.active && ['HIGH_PRESSURE', 'PRESSURE_LIMITATION'].includes(a.code),
    )
  )
    issues.push(
      'Pressure alarm or limitation occurred; verify delivered volume before attributing the response',
    )
  const confounds = [...new Set([...(session.confounds ?? []), ...issues])]
  const last = simulation.waveforms.at(-1),
    previous = simulation.waveforms.at(-2)
  /*
   * A pause is the learner's reading of the breath only when the learner asked for it and it is
   * what stopped a running model. The origin travels on the action; `paused` alone says nothing
   * about who paused, and a background suspension carries `'background'`.
   */
  const manualInspection =
    session.phase === 'experiment' &&
    action.action.type === 'SET_PAUSED' &&
    action.action.paused &&
    action.action.origin === 'learner' &&
    !before.paused &&
    simulation.simulationTime >= 4 &&
    round.goals.some((g) => g.type === 'pause-expiration') &&
    last?.phase === 'expiration' &&
    last.flowLMin < -0.1 &&
    previous
      ? { sample: last, previous, waveforms: labSnapshot(simulation).waveforms }
      : undefined
  const next = {
    ...session,
    ...(manualInspection
      ? { evidence: setEvidence(session, { ...evidence, inspection: manualInspection }) }
      : {}),
    simulation,
    events,
    observedHolds,
    holds,
    acquisition,
    conditionRevision,
    confounds,
    time: simulation.simulationTime,
  }
  if (session.phase !== 'experiment') return next
  const goalsMet = round.goals.every((goal) => labGoalMet(goal, next))
  return {
    ...next,
    readySince: goalsMet ? (session.readySince ?? simulation.simulationTime) : null,
  }
}

const finite = z.number().finite()
const sampleSchema = z.object({
  time: finite,
  pawCmH2O: finite,
  flowLMin: finite,
  volumeMl: finite,
  pmusCmH2O: finite,
  phase: z.enum(['inspiration', 'expiration']),
  triggered: z.boolean(),
  spontaneous: z.boolean(),
})
const holdSchema = z.object({
  hold: z.enum(['inspiratory', 'expiratory']),
  revision: z.number().int().nonnegative(),
  inputs: z.record(z.union([finite, z.string()])),
  startedAt: finite,
  endsAt: finite,
  value: finite,
  interpretable: z.boolean(),
  reason: z.string().nullable(),
  waveforms: z.array(sampleSchema).max(LAB_RECORD_MAX_SAMPLES),
})
const capturedHoldSchema = holdSchema.extend({ capturedAt: finite })
const snapshotSchema = z.object({
  values: z.object(
    Object.fromEntries(Object.keys(labMetricLabels).map((key) => [key, finite])) as Record<
      LabMetric,
      typeof finite
    >,
  ),
  plateauValid: z.boolean(),
  plateauSource: z.enum(['modeled', 'captured', 'historical']).optional(),
  inputs: z.record(z.union([finite, z.string()])).optional(),
  hold: capturedHoldSchema.optional(),
  issues: z.array(z.string()).max(100).optional(),
  waveforms: z.array(sampleSchema).max(LAB_RECORD_MAX_SAMPLES),
  at: finite.min(0).max(1000),
})
const evidenceSchema = z.object({
  prediction: z.number().int().min(0).max(2).optional(),
  confidence: z.enum(['sure', 'unsure']).optional(),
  baseline: snapshotSchema.optional(),
  response: snapshotSchema.optional(),
  observation: z
    .object({ choice: z.string().max(40), correct: z.boolean(), at: z.string().datetime() })
    .optional(),
  inspection: z
    .object({
      sample: sampleSchema,
      previous: sampleSchema,
      waveforms: z.array(sampleSchema).max(LAB_RECORD_MAX_SAMPLES).optional(),
    })
    .optional(),
  reflection: z.string().max(1200).optional(),
  location: z.string().min(1).max(40).optional(),
  sort: z.record(z.string().min(1).max(40), z.enum(['set', 'reported'])).optional(),
  completedAt: z.string().datetime().optional(),
})
const smallString = z.string().min(1).max(120)
const eventAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SET_CONTROL'),
    control: smallString,
    value: z.union([finite, smallString, z.boolean()]),
  }),
  z.object({
    type: z.literal('SET_TEACHING_MECHANICS'),
    overrides: z.object({
      complianceScale: finite.min(0.25).max(6).optional(),
      resistanceScale: finite.min(0.25).max(6).optional(),
    }),
  }),
  z.object({ type: z.literal('SELECT_MODE'), mode: smallString }),
  z.object({ type: z.literal('CONFIRM_MODE') }),
  z.object({ type: z.literal('PERFORM_HOLD'), hold: z.enum(['inspiratory', 'expiratory']) }),
  z.object({ type: z.literal('PERFORM_INTERVENTION'), interventionId: smallString }),
  ...(
    ['TOGGLE_LOCK', 'TOGGLE_FREEZE', 'OXYGEN_ENRICHMENT', 'MANUAL_BREATH', 'USE_HINT'] as const
  ).map((type) => z.object({ type: z.literal(type) })),
  z.object({ type: z.literal('ACK_ALARM'), alarmId: smallString.optional() }),
])
const checkpointSchema = z.object({
  version: z.literal(1),
  evidenceVersion: z.literal(2).optional(),
  conditionRevision: z.number().int().nonnegative().optional(),
  holds: z.array(capturedHoldSchema).max(30).optional(),
  acquisition: holdSchema.optional(),
  confounds: z.array(z.string()).max(100).optional(),
  history: z
    .array(
      z.object({
        evidenceVersion: z.number(),
        round: z.union([z.literal(0), z.literal(1)]),
        device: z.enum(ventilatorDeviceIds),
        evidence: z.tuple([evidenceSchema, evidenceSchema]),
        holds: z.array(capturedHoldSchema).max(30).optional(),
        completedAt: z.string().datetime().optional(),
        reason: z.string(),
      }),
    )
    .max(20)
    .optional(),
  unitId: smallString,
  round: z.union([z.literal(0), z.literal(1)]),
  phase: z.enum(['explore', 'predict', 'experiment', 'compare', 'complete']),
  device: z.enum(ventilatorDeviceIds),
  time: finite.min(0).max(1000),
  events: z.array(z.object({ at: finite.min(0).max(1000), action: eventAction })).max(512),
  evidence: z.tuple([evidenceSchema, evidenceSchema]),
  observedHolds: z.array(z.enum(['inspiratory', 'expiratory'])).max(2),
  readySince: finite.min(0).max(1000).nullable(),
  completedAt: z.string().datetime().optional(),
})
export function parseLabProgress(raw: string | null): LabProgress {
  if (!raw) return emptyLabProgress()
  try {
    const root = z
      .object({ version: z.literal(1), units: z.record(z.unknown()) })
      .parse(JSON.parse(raw))
    const units: Record<string, LabCheckpoint> = {}
    for (const [id, value] of Object.entries(root.units)) {
      if (!ventilationExperimentByUnit.has(id)) continue
      const parsed = checkpointSchema.safeParse(value)
      if (!parsed.success || parsed.data.unitId !== id) continue
      const p = parsed.data as LabCheckpoint
      let previous = 0
      if (
        p.events.some((event) => {
          const invalid = event.at < previous || event.at > p.time
          previous = event.at
          return invalid
        })
      )
        continue
      if (p.readySince !== null && p.readySince > p.time) continue
      const current = p.evidence[p.round]
      if (
        ['experiment', 'compare', 'complete'].includes(p.phase) &&
        (current.prediction === undefined || !current.baseline)
      )
        continue
      if (['compare', 'complete'].includes(p.phase) && !current.response) continue
      if (p.round === 1 && !p.evidence[0].completedAt) continue
      if (
        (p.phase === 'complete' || p.completedAt) &&
        !p.evidence.every(
          (e) => e.prediction !== undefined && e.baseline && e.response && e.completedAt,
        )
      )
        continue
      if (
        isFoundationUnit(id) &&
        p.evidenceVersion === 2 &&
        p.phase === 'complete' &&
        !p.evidence.every((e) => e.observation)
      )
        continue
      units[id] = p
    }
    return { version: 1, units }
  } catch {
    return emptyLabProgress()
  }
}
export function labPatientLabel(round: LabRound): string {
  return resolveVentilationSimulationCase(round.caseId).patientDescription
}
