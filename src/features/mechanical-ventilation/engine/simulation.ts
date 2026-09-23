import { SHARED_CRITICAL_CARE_THRESHOLDS } from '@/features/critical-care/content/sharedClinicalThresholds'

import { resolveVentilationSimulationCase } from '../content/learningPatient'
import {
  adaptInitialSettingsForDevice,
  createDefaultMechanicalVentilationSettings,
  defaultVentilatorDeviceId,
} from '../content/deviceProfiles'
import { cloneMechanicalVentilationSettings, isSimvMode, isTwoLevelMode } from './modes'
import { baselineArterialGasSample, collectRepeatArterialGasSample } from './arterialGas'
import {
  latchOpenHoldConditionChange,
  measurementConditionsFingerprint,
} from './measurementConditions'
import {
  ardsLungStateForPeep,
  cardiogenicFlowOscillationLps,
  clamp,
  effectiveBaselinePressureCmH2O,
  EFFORT_DETECTION_FLOOR_CMH2O,
  effectivePressureAboveBaselineCmH2O,
  deriveEffectivePatient,
  deriveMeasurements,
  deriveVolumeFlowTimeSeconds,
  equationOfMotionPressure,
  expiratoryAirwayPressure,
  hasPerformedEffect,
  holdRelaxationFraction,
  isCaseResolved,
  MAX_TREND_SAMPLES,
  MAX_WAVEFORM_SAMPLES,
  moveTowardExp,
  observedEndExpiratoryVolumeMl,
  passiveExpiratoryFlowLps,
  phFromBicarbonateAndPaCO2,
  positiveModulo,
  round,
  secretionFlowDisturbanceLps,
  spo2FromPaO2,
  targetTidalVolumeMl,
  unmodeledIntrinsicPeepCmH2O,
  usesPressureTargetedDelivery,
  WAVEFORM_SAMPLE_HZ,
  WAVEFORM_STEP_SECONDS,
} from './physics'
import type {
  AlarmEvent,
  BreathClock,
  CaseOutcome,
  MechanicalVentilationSettings,
  InterventionDefinition,
  LearningExperience,
  PatientModelState,
  PerformedHoldRecord,
  PhysiologyReference,
  RiskState,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorDeviceId,
  VentilatorMeasurements,
  WaveformSample,
} from './types'

export const SIMULATION_VERSION = 1 as const
export const DEFAULT_CASE_ID = 'MV-01'

/**
 * How long the valves stay shut once a hold is armed. Long enough for the plateau to be read off
 * the trace and for the relaxation drift to be visible, which is what the maneuver is being taught
 * for; real devices offer a range and this is not a recommendation for one.
 */
export const HOLD_SECONDS = 4

const emptyMeasurements: VentilatorMeasurements = {
  peakPressureCmH2O: 0,
  plateauPressureCmH2O: 0,
  relaxedPeakPressureCmH2O: 0,
  relaxedPlateauPressureCmH2O: 0,
  endInspiratoryEffortCmH2O: 0,
  plateauIsInterpretable: true,
  meanAirwayPressureCmH2O: 0,
  exhaledVtMl: 0,
  exhaledVtSource: 'predicted',
  minuteVentilationLMin: 0,
  totalRatePerMin: 0,
  observedPatientRatePerMin: 0,
  staticComplianceMlCmH2O: 0,
  intrinsicPeepCmH2O: 0,
  expiratoryFlowAtNextBreathLMin: 0,
  triggerDelayMs: 0,
  mechanicalInspiratoryTimeSeconds: 0,
  stackedVolumeMl: 0,
  ineffectiveEffortFraction: 0,
  autotriggerFraction: 0,
  pressureOvershootCmH2O: 0,
}

const emptyRisk: RiskState = {
  highPlateau: 0,
  stackedVolume: 0,
  dynamicHyperinflation: 0,
  hypoxemia: 0,
  hypotension: 0,
  excessiveSedation: 0,
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function clonePatient(patient: PatientModelState): PatientModelState {
  return {
    mechanics: { ...patient.mechanics },
    drive: { ...patient.drive },
    gasExchange: { ...patient.gasExchange },
    hemodynamics: { ...patient.hemodynamics },
    human: { ...patient.human },
    airway: { ...patient.airway },
  }
}

function configureBranch(
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  branch: string,
): PatientModelState {
  const next = clonePatient(patient)
  if (definition.phenotype === 'autotriggering') {
    next.airway.condensate = branch === 'condensate'
    next.airway.circuitLeak = branch === 'leak'
    next.mechanics.airwayLeakFraction = branch === 'leak' ? 0.12 : 0
  }
  if (definition.phenotype === 'high-resistance') {
    next.airway.secretions = branch === 'secretions'
    next.airway.hmeObstructed = branch === 'hme-or-ett'
    next.airway.ettObstructed = branch === 'hme-or-ett'
    next.airway.bronchospasm = branch === 'bronchospasm'
    next.mechanics.resistanceCmH2OPerLps = branch === 'bronchospasm' ? 30 : 26
  }
  if (definition.phenotype === 'tension-pneumothorax' && branch === 'stable') {
    next.hemodynamics.systolicMmHg = 92
    next.hemodynamics.diastolicMmHg = 54
    next.hemodynamics.mapMmHg = 67
  }
  return next
}

function baseState(
  definition: VentilationCaseDefinition,
  experience: LearningExperience,
  attempt: number,
  deviceId: VentilatorDeviceId,
): VentilationSimulationState {
  const seed = hashSeed(`${definition.id}:${experience}:${attempt}`)
  const branch = definition.branchOptions[seed % definition.branchOptions.length]
  const patient = configureBranch(definition, definition.initialPatient, branch)
  const state: VentilationSimulationState = {
    version: SIMULATION_VERSION,
    deviceId,
    caseId: definition.id,
    experience,
    challengeMode: 'untimed',
    phase: experience === 'learn' ? 'act' : 'observe',
    simulationTime: 0,
    speed: 1,
    paused: true,
    seed,
    branch,
    showEducatorOverlay: experience === 'learn',
    ventilator: {
      screen: 'main',
      settings: cloneMechanicalVentilationSettings(
        adaptInitialSettingsForDevice(definition.initialSettings, deviceId),
      ),
      pendingMode: null,
      locked: false,
      frozen: false,
      alarmAudioEnabled: false,
      audioPausedUntil: null,
      oxygenEnrichmentUntil: null,
      pendingHold: null,
      holdType: null,
      holdUntil: null,
      manualBreathUntil: null,
      breathClock: { periodSeconds: null, anchorSeconds: 0, nextOnsetSeconds: null },
    },
    patient,
    measurements: emptyMeasurements,
    waveforms: [],
    trends: [],
    alarms: [],
    alarmHistory: [],
    interventions: [],
    prediction: {
      committed: experience === 'learn',
      mechanismId: null,
      priorityId: null,
      responseId: null,
    },
    reassessment: { committed: false, actionIds: [] },
    hintsUsed: 0,
    risk: { ...emptyRisk },
    criticalErrors: [],
    lastResponse: null,
    lastAbgAt: null,
    holdRecords: [],
    arterialGasSamples: [
      baselineArterialGasSample(
        definition.id,
        patient.gasExchange,
        definition.initialGasProvenance,
      ),
    ],
    // Provisional: replaced with the case-open values once the mechanical history is prepared.
    physiologyReference: undefined as unknown as PhysiologyReference,
    teachingMechanics: { complianceScale: 1, resistanceScale: 1 },
  }
  const measurements = deriveMeasurements(state, definition, patient)
  const provisional = { ...state, measurements }
  return {
    ...provisional,
    physiologyReference: capturePhysiologyReference(provisional, definition),
  }
}

/**
 * How much mechanical history a case opens with.
 *
 * The buffer keeps the last `WAVEFORM_WINDOW_SECONDS` of it — one display window — which is long
 * enough that every live case has a completed inflation, with its onset, on screen before the
 * learner sees anything (the slowest, MV-05 and MV-12, cycle every 7.5 s). Four seconds was not:
 * those two opened on the analytic prediction — "VTE 1400" and "VTE 1021" — rather than on a
 * breath. The second half of the minute is used to average the delivered minute ventilation the
 * CO₂ anchor divides by, because some cases' breaths vary on a longer cycle than one window
 * (MV-07's efforts and machine breaths beat on a cycle of about half a minute).
 */
export const PREPARED_HISTORY_SECONDS = 60

/**
 * A sample from the mechanical history prepared before the case opened.
 *
 * These are the patient's own breaths on the case's own settings — the ventilator was running
 * before the learner arrived — but nobody in this run observed them, and no action of the learner's
 * is in them. They sit at negative time so every consumer can tell.
 */
export function isPreparedHistorySample(sample: WaveformSample): boolean {
  return sample.time <= 0
}

/**
 * A case, opened.
 *
 * Three distinct things happen here, and only the first one is allowed to run the model:
 *
 * 1. **Prepared mechanical history.** The ventilator runs the case's own settings on the case's own
 *    lung for `PREPARED_HISTORY_SECONDS`, *ending* at time zero, so the waveform buffer, the trapped
 *    volume and every trace-derived measurement describe a patient who was already being ventilated.
 *    It runs at negative time and is never rewound: the breath clock, the neural effort and the
 *    circuit ripples are one continuous schedule through the moment the case opens. It used to
 *    run four seconds from zero and then shift the samples back, and because every periodic signal
 *    is a function of absolute time, the breath schedule restarted at zero — cutting the prepared
 *    expiration short in thirteen of fourteen live cases (MV-10's to 0.02 s, MV-13's to 0.54 of
 *    2.55 s) and starting the first breath of the case on a lung that had not finished emptying.
 * 2. **The presentation.** Everything slow — gas, saturation, circulation, comfort — is the case's
 *    authored presentation, restored after the history is prepared. Nothing the model computed
 *    during those seconds is kept: no drift, no risk, no trend, no alarm history, no action.
 * 3. **The case-open epoch.** Alarms are evaluated on the patient the learner is shown, at time
 *    zero. They used to be the ones the priming run had raised at its own end, stamped four seconds
 *    into a case that had not started.
 *
 * Changing the display device re-opens the case the same way (`CHANGE_DEVICE`), and restarting
 * opens a new epoch; neither carries a measurement, hold, specimen or trend across.
 */
export function createInitialSimulationState(
  caseId = DEFAULT_CASE_ID,
  experience: LearningExperience = 'learn',
  attempt = 1,
  deviceId: VentilatorDeviceId = defaultVentilatorDeviceId,
): VentilationSimulationState {
  const definition = resolveVentilationSimulationCase(caseId)
  const initial = baseState(definition, experience, attempt, deviceId)
  /*
   * Stepped the way 1× playback steps (0.1 s per call), so the delivered minute ventilation can be
   * read after every call. The reported value is the last completed breath times the rate, and it
   * varies breath to breath wherever breaths differ — MV-07 between 1.7 and 2.4 L/min, MV-09
   * between 3.2 and 3.7 — so a single instant is the wrong anchor: whichever breath happened to be
   * last would set the CO₂ equilibrium. The anchor is the harmonic mean across the prepared history,
   * which is the minute ventilation at which `PaCO₂ ∝ 1/VE` averages back to the authored PaCO₂.
   * The last 12 s of it survive in the waveform buffer; the rest is only used for this mean.
   */
  const chunk = 0.1
  const chunks = Math.round(PREPARED_HISTORY_SECONDS / chunk)
  let prepared: VentilationSimulationState = {
    ...initial,
    simulationTime: -PREPARED_HISTORY_SECONDS,
    paused: false,
  }
  let inverseMinuteVentilationSum = 0
  let tracedChunks = 0
  for (let index = 0; index < chunks; index += 1) {
    prepared = advanceSimulation(prepared, chunk, definition)
    // Only once a breath has actually been completed — before that the reported value is the
    // analytic prediction (11.8 L/min on MV-05, against 2 L/min delivered) — and only over the
    // second half, after trapped volume has built to where the case will hold it.
    if (index >= chunks / 2 && prepared.measurements.exhaledVtSource === 'trace') {
      inverseMinuteVentilationSum += 1 / Math.max(0.8, prepared.measurements.minuteVentilationLMin)
      tracedChunks += 1
    }
  }
  const preparedMinuteVentilationLMin =
    tracedChunks > 0
      ? tracedChunks / inverseMinuteVentilationSum
      : Math.max(0.8, prepared.measurements.minuteVentilationLMin)
  const presented: VentilationSimulationState = {
    ...prepared,
    simulationTime: 0,
    // On the 50 Hz grid: sixty seconds of accumulated steps can land the last sample a rounding
    // error either side of zero, and every prepared sample must read as negative-time history.
    waveforms: prepared.waveforms.map((sample) => ({
      ...sample,
      time: Math.round(sample.time * WAVEFORM_SAMPLE_HZ) / WAVEFORM_SAMPLE_HZ,
    })),
    paused: true,
    patient: { ...initial.patient, mechanics: { ...prepared.patient.mechanics } },
    trends: [],
    risk: { ...emptyRisk },
    criticalErrors: [],
    alarms: [],
    alarmHistory: [],
    holdRecords: [],
    interventions: [],
    lastResponse: null,
    // The breath timer runs straight through the moment the case opens; nothing else does.
    ventilator: { ...initial.ventilator, breathClock: prepared.ventilator.breathClock },
  }
  const opened = {
    ...presented,
    measurements: deriveMeasurements(presented, definition),
  }
  const withReference = {
    ...opened,
    physiologyReference: {
      ...capturePhysiologyReference(opened, definition),
      minuteVentilationLMin: preparedMinuteVentilationLMin,
    },
  }
  return { ...withReference, ...reconcileAlarms(withReference, definition) }
}

/**
 * Re-open the alarm epoch on a state whose clock has just been set back to zero by a caller that
 * prepares its own history (the Learn lab's warm-up). The alarms themselves are re-evaluated on the
 * patient being shown; nothing about the patient changes.
 */
export function reopenAlarmEpoch(
  state: VentilationSimulationState,
  suppliedDefinition?: VentilationCaseDefinition,
): VentilationSimulationState {
  const definition = suppliedDefinition ?? resolveVentilationSimulationCase(state.caseId)
  const cleared = { ...state, alarms: [], alarmHistory: [] }
  return { ...cleared, ...reconcileAlarms(cleared, definition) }
}

function flowProfile(
  settings: Extract<MechanicalVentilationSettings, { mode: 'volume-ac' }>,
  phase: number,
  ti: number,
) {
  const normalized = clamp(phase / Math.max(0.01, ti), 0, 1)
  const peak = settings.peakFlowLMin / 60
  if (settings.flowPattern === 'sine') return peak * Math.sin(Math.PI * normalized)
  if (settings.flowPattern === 'decelerating-100') return peak * (1 - normalized)
  if (settings.flowPattern === 'decelerating-50') return peak * (1 - normalized * 0.5)
  return peak
}

function effortAt(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  time: number,
  machine: { readonly phase: number; readonly period: number },
): number {
  const neuralPeriod = 60 / Math.max(1, patient.drive.neuralRatePerMin)
  let phase = positiveModulo(time, neuralPeriod)
  /*
   * Entrainment is the whole phenotype, and breaking it is the whole treatment — so it has to be
   * conditional on the case still being unresolved. It used to break by accident: `effortAt` and
   * `machineTiming` ran on different rates, so changing the set rate made the effort drift out of
   * step, which read as entrainment breaking. Locking the two together (§1.9) fixed the defect and
   * removed the therapy with it, leaving the effort entrained forever, still stacking volume onto
   * every breath after the learner had done the right thing.
   */
  if (definition.phenotype === 'reverse-triggering' && !isCaseResolved(state, definition)) {
    /*
     * Entrainment means the effort is locked to the breath the ventilator is actually delivering,
     * so this has to be the rate `machineTiming` runs on. Deriving it from `settings.ratePerMin`
     * instead silently unlocked the effort whenever the two disagreed — which is precisely what
     * happens when the learner lowers the set rate, the one action this case asks for, because the
     * patient's own rate then keeps the machine running faster than the setting. Third instance of
     * the same two-clocks defect (§1.3 item 9, §1.6).
     */
    // The machine's own timer (`BreathClock`), so a rate change moves the effort with the breath
    // rather than letting the two jump to different phases.
    phase = positiveModulo(
      machine.phase - (patient.drive.reverseTriggerDelaySeconds ?? 0.35),
      machine.period,
    )
  }
  if (definition.phenotype === 'autotriggering' && state.measurements.autotriggerFraction > 0.2) {
    return 0
  }
  if (phase > patient.drive.neuralInspiratoryTimeSeconds) return 0
  const normalized = phase / Math.max(0.1, patient.drive.neuralInspiratoryTimeSeconds)
  return patient.drive.effortAmplitudeCmH2O * Math.sin(Math.PI * normalized)
}

/** How long the machine inspires within a cycle — the part a period change must not cut into. */
function machineInspiratorySeconds(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  measurements: VentilatorMeasurements,
): number {
  if (isTwoLevelMode(state.ventilator.settings.deviceMode)) {
    return state.ventilator.settings.advanced.tHighSeconds
  }
  const ti = measurements.mechanicalInspiratoryTimeSeconds
  // The double-trigger phenotype delivers a second inflation after a 0.12 s gap in the same cycle.
  return definition.phenotype === 'double-triggering' ? 2 * ti + 0.12 : ti
}

/** The length of one machine cycle at this instant — what the breath timer counts. */
function machineCyclePeriodSeconds(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
): number {
  const settings = state.ventilator.settings
  if (isTwoLevelMode(settings.deviceMode)) {
    return Math.max(0.3, settings.advanced.tHighSeconds + settings.advanced.tLowSeconds)
  }
  const rate =
    definition.phenotype === 'double-triggering'
      ? patient.drive.neuralRatePerMin
      : Math.max(1, measurements.totalRatePerMin)
  return 60 / rate
}

/**
 * Float slack on "has the clock reached the onset it is holding". Sixty seconds of 0.02 s steps
 * accumulate rounding of order 1e-12 s; this is that, not a physiological interval.
 */
const BREATH_ONSET_TOLERANCE_SECONDS = 1e-9

/** Whether two cycle lengths are the same schedule (both are `60 / rate` or `tHigh + tLow`). */
function sameCycleLength(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

/**
 * The neural effort's own cycle, when there is an effort for a breath to stay with.
 *
 * `effortAt` draws the effort on the absolute grid `time mod (60 / neural rate)`. When the machine
 * is asked to cycle at exactly that period — pressure support with every effort captured, or an
 * assist-control patient breathing above the set rate — the breaths are the patient's own, and the
 * schedule has to sit on that grid or every later breath would begin away from the effort that is
 * supposed to be starting it (MV-07 after its trigger is corrected).
 */
function effortCycleSeconds(patient: PatientModelState): number | null {
  if (patient.drive.effortAmplitudeCmH2O <= 0 || patient.drive.neuralRatePerMin <= 0) return null
  return 60 / Math.max(1, patient.drive.neuralRatePerMin)
}

/**
 * The cycle that begins at the onset the clock was holding, and the onset that will end it.
 *
 * - **Same length as the cycle just finished:** continue that schedule. Its next onset is read off
 *   the schedule's own grid (`anchor + (k + 1)·period`), not accumulated, so a constant rate is the
 *   absolute grid the case opened on, sample for sample.
 * - **The patient's own rhythm:** rejoin the effort grid (see `effortCycleSeconds`). If this onset
 *   is already on it, continue on it. Otherwise the next breath is the first effort that begins
 *   after the breath starting here has finished inspiring (and one sample of expiration), and the
 *   schedule is on the effort grid from then on. That one transition cycle is therefore longer than
 *   this breath's inspiration and no longer than that inspiration plus one effort cycle. No effort
 *   is moved and none that could be captured is skipped: a first version waited for the effort
 *   nearest one full cycle away, which on MV-08 passed over the patient's effort 2.1 s after the
 *   boundary and left a 9.7 s gap after the trigger was corrected.
 * - **Any other new length:** a new schedule anchored at this onset. Its first cycle is exactly the
 *   requested length, so the interval between the last breath at the old rate and the first at the
 *   new one is one of the two periods, never more.
 */
function breathClockAtOnset(
  clock: BreathClock,
  requested: number,
  effortCycle: number | null,
  inspiratorySeconds: number,
): BreathClock {
  const onset = clock.nextOnsetSeconds as number
  const period = clock.periodSeconds as number
  if (sameCycleLength(requested, period)) {
    const index = Math.round((onset - clock.anchorSeconds) / period)
    return { ...clock, nextOnsetSeconds: clock.anchorSeconds + (index + 1) * period }
  }
  if (effortCycle !== null && sameCycleLength(requested, effortCycle)) {
    const effortPhase = positiveModulo(onset, effortCycle)
    if (effortPhase < 1e-6 || effortCycle - effortPhase < 1e-6) {
      const index = Math.round(onset / effortCycle)
      return {
        periodSeconds: effortCycle,
        anchorSeconds: 0,
        nextOnsetSeconds: (index + 1) * effortCycle,
      }
    }
    const readyAt = onset + inspiratorySeconds + WAVEFORM_STEP_SECONDS
    const next = Math.ceil((readyAt - 1e-9) / effortCycle) * effortCycle
    return { periodSeconds: next - onset, anchorSeconds: onset, nextOnsetSeconds: next }
  }
  return { periodSeconds: requested, anchorSeconds: onset, nextOnsetSeconds: onset + requested }
}

/**
 * Advance the breath timer to `time`. See `BreathClock`.
 *
 * The contract, whatever the settings do in between:
 *
 * - **The cycle in progress is never shortened or lengthened.** Its next onset is fixed at the
 *   moment it began. A rate change during its inspiration, its expiration or in its last sample
 *   neither cuts it short nor pushes that onset later, and a change made several times before the
 *   onset is read once, at the onset.
 * - **A new rate is authoritative from the next onset** (`breathClockAtOnset`). That onset is the
 *   one breath boundary it can take effect at without truncating a breath or deferring one.
 * - **Exactly one onset per cycle.** The boundary is processed on the first step past the onset
 *   the clock was holding, and the cycle that follows is at least the length of the inspiration it
 *   contains, so there is no one-sample breath, no duplicated onset and no skipped one.
 *
 * Nothing here decides whether a breath is triggered by the patient; that is still the grid
 * coincidence described in the MV-PRE-REVIEW-02 handoff (§8, owner decision D5).
 */
function advanceBreathClock(
  ventilator: VentilationSimulationState['ventilator'],
  requested: number,
  effortCycle: number | null,
  inspiratorySeconds: number,
  time: number,
): VentilationSimulationState['ventilator'] {
  const clock = ventilator.breathClock
  if (clock.periodSeconds === null || clock.nextOnsetSeconds === null) {
    // The first step of a case: the absolute grid of the case's own cycle.
    const index = Math.floor(time / requested)
    return {
      ...ventilator,
      breathClock: {
        periodSeconds: requested,
        anchorSeconds: 0,
        nextOnsetSeconds: (index + 1) * requested,
      },
    }
  }
  let next = clock
  // One step is far shorter than any cycle, so this runs at most once; the bound guards a time jump.
  for (let guard = 0; guard < 8; guard += 1) {
    if (time <= (next.nextOnsetSeconds as number) + BREATH_ONSET_TOLERANCE_SECONDS) break
    next = breathClockAtOnset(next, requested, effortCycle, inspiratorySeconds)
  }
  return next === clock ? ventilator : { ...ventilator, breathClock: next }
}

/**
 * The same clock with its time origin moved by `offsetSeconds`, for a caller that re-bases
 * simulated time (the Learn lab's warm-up). The schedule is unchanged; only the numbers move.
 */
export function shiftBreathClock(clock: BreathClock, offsetSeconds: number): BreathClock {
  return {
    periodSeconds: clock.periodSeconds,
    anchorSeconds: clock.anchorSeconds + offsetSeconds,
    nextOnsetSeconds:
      clock.nextOnsetSeconds === null ? null : clock.nextOnsetSeconds + offsetSeconds,
  }
}

function machineTiming(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  time: number,
): {
  inspiration: boolean
  phase: number
  period: number
  triggered: boolean
  spontaneous: boolean
} {
  const clock = state.ventilator.breathClock
  const period =
    clock.periodSeconds ?? machineCyclePeriodSeconds(state, definition, patient, measurements)
  const phase = positiveModulo(time - clock.anchorSeconds, period)
  if (isTwoLevelMode(state.ventilator.settings.deviceMode)) {
    const settings = state.ventilator.settings
    return {
      inspiration: phase < settings.advanced.tHighSeconds,
      phase,
      period,
      triggered: phase < WAVEFORM_STEP_SECONDS * 1.5,
      spontaneous: false,
    }
  }
  const rate = 60 / period
  const settings = state.ventilator.settings
  let spontaneous = false
  if (
    isSimvMode(settings.deviceMode) &&
    settings.mode !== 'pressure-support' &&
    rate > settings.ratePerMin + 0.5
  ) {
    const breathIndex = Math.floor((time - clock.anchorSeconds) / period)
    const mandatoryFraction = clamp(settings.ratePerMin / rate, 0, 1)
    const mandatoryBefore = Math.floor((breathIndex + 1) * mandatoryFraction)
    const mandatoryAfter = Math.floor((breathIndex + 2) * mandatoryFraction)
    spontaneous = mandatoryAfter === mandatoryBefore
  }
  const spontaneousTi = spontaneous
    ? clamp(
        -Math.max(
          0.08,
          (patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps) *
            patient.mechanics.complianceLPerCmH2O,
        ) *
          Math.log(clamp(settings.advanced.spontaneousCyclePercent / 100, 0.05, 0.8)) +
          settings.advanced.spontaneousRampMs / 2000,
        0.2,
        3,
      )
    : measurements.mechanicalInspiratoryTimeSeconds
  let inspiration = phase < spontaneousTi
  if (definition.phenotype === 'double-triggering') {
    const gap = 0.12
    const secondStart = measurements.mechanicalInspiratoryTimeSeconds + gap
    const mismatch =
      patient.drive.neuralInspiratoryTimeSeconds - measurements.mechanicalInspiratoryTimeSeconds
    inspiration =
      phase < measurements.mechanicalInspiratoryTimeSeconds ||
      (mismatch > 0.15 &&
        phase >= secondStart &&
        phase < secondStart + measurements.mechanicalInspiratoryTimeSeconds)
  }
  if (state.ventilator.manualBreathUntil && state.ventilator.manualBreathUntil > time) {
    inspiration = true
    spontaneous = false
  }
  return {
    inspiration,
    phase,
    period,
    triggered: phase < WAVEFORM_STEP_SECONDS * 1.5,
    spontaneous,
  }
}

/**
 * When the inspiration in progress began, and how much gas was in the lung at that moment.
 *
 * A ventilator delivers its set tidal volume by integrating flow from the start of *this* breath,
 * so what it delivers does not depend on what is still left over from the last one. Measuring the
 * target against absolute lung volume instead made breath stacking impossible to draw: the second
 * inflation of a double trigger only topped the lung back up to one tidal volume, so the trace
 * showed two inflations with no volume or pressure consequence while the console reported 1.85×VT.
 * Stacking is the entire danger of the phenotype.
 *
 * Read back off the waveform buffer rather than held as extra state, so it survives the tick
 * boundary and cannot drift out of step with the trace it describes.
 */
function inspirationAnchor(
  waveforms: readonly WaveformSample[],
  time: number,
  volumeL: number,
): { time: number; volumeL: number } {
  const last = waveforms.at(-1)
  // Nothing inspiring in the buffer: this sample is the onset.
  if (!last || last.phase === 'expiration') return { time, volumeL }
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase !== 'inspiration') break
    if (waveforms[index - 1].phase === 'expiration') {
      return { time: waveforms[index].time, volumeL: waveforms[index - 1].volumeMl / 1000 }
    }
  }
  return { time, volumeL }
}

function nextWaveformSample(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  time: number,
  volumeL: number,
): { sample: WaveformSample; volumeL: number } {
  const settings = state.ventilator.settings
  const timing = machineTiming(state, definition, patient, measurements, time)
  const effort = effortAt(state, definition, patient, measurements, time, timing)
  const holdActive = state.ventilator.holdUntil !== null && state.ventilator.holdUntil > time
  const pressureTargeted = usesPressureTargetedDelivery(settings)
  const baselinePressure = effectiveBaselinePressureCmH2O(settings)
  const pressureAboveBaseline = effectivePressureAboveBaselineCmH2O(
    settings,
    patient,
    definition.predictedBodyWeightKg,
  )
  const breathPressureAboveBaseline = timing.spontaneous
    ? settings.advanced.spontaneousPressureSupportCmH2O
    : pressureAboveBaseline
  const pressureTargetedBreath = pressureTargeted || timing.spontaneous
  /*
   * Only the auto-PEEP the trace is not already producing. `volumeL` is absolute lung volume, so a
   * lung that did not finish emptying is generating that recoil through the elastic term already;
   * adding the case's full analytic value on top counted the same trapped gas twice. Both the flow
   * a breath delivers and the pressure the manometer reads have to use this same number.
   */
  const residualIntrinsicPeep = unmodeledIntrinsicPeepCmH2O(
    measurements.intrinsicPeepCmH2O,
    (observedEndExpiratoryVolumeMl(state.waveforms) ?? 0) / 1000,
    patient.mechanics.complianceLPerCmH2O,
  )
  let flowLps = 0
  if (!holdActive && timing.inspiration) {
    if (settings.mode === 'volume-ac' && !pressureTargetedBreath) {
      // Both the flow profile and the volume target run off this breath's own onset. Using the
      // breath-cycle phase instead ran a stacked inflation past the end of its own profile, where a
      // decelerating pattern evaluates to zero flow.
      const anchor = inspirationAnchor(state.waveforms, time, volumeL)
      /*
       * Normalized over the *flow* time, not `mechanicalInspiratoryTimeSeconds`, which now includes
       * the end-inspiratory pause. Spreading the profile across the pause as well would deliver the
       * breath more slowly instead of holding it, which is the opposite of what the setting does —
       * a decelerating ramp would simply take longer rather than plateau.
       */
      flowLps = flowProfile(settings, time - anchor.time, deriveVolumeFlowTimeSeconds(settings))
      const targetVolume =
        targetTidalVolumeMl(settings, patient, definition.predictedBodyWeightKg) / 1000
      if (volumeL - anchor.volumeL >= targetVolume) flowLps = 0
    } else {
      const pRampMs = Math.max(
        10,
        isTwoLevelMode(settings.deviceMode)
          ? 50
          : timing.spontaneous
            ? settings.advanced.spontaneousRampMs
            : settings.mode === 'volume-ac'
              ? 70
              : settings.pRampMs,
      )
      const targetPressure =
        baselinePressure +
        breathPressureAboveBaseline * (1 - Math.exp(-timing.phase / (pRampMs / 1000)))
      const resistance =
        patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps
      /*
       * Auto-PEEP is part of the back-pressure this breath has to push against, and it was missing
       * here while `equationOfMotionPressure` below included it — so the flow the breath delivered
       * and the pressure the manometer showed came from two different equations, and the mismatch
       * was hidden by the ceiling clamp. Including it makes the trapped gas a threshold load, which
       * is what it is at the bedside: the same support pressure delivers a smaller breath.
       */
      flowLps =
        (targetPressure +
          effort -
          baselinePressure -
          residualIntrinsicPeep -
          volumeL / Math.max(0.005, patient.mechanics.complianceLPerCmH2O)) /
        Math.max(2, resistance)
      flowLps = clamp(flowLps, 0, 3)
    }
  } else if (!holdActive) {
    flowLps = passiveExpiratoryFlowLps(
      volumeL,
      patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps,
      patient.mechanics.complianceLPerCmH2O,
      effort,
    )
  }

  if (
    definition.phenotype === 'autotriggering' &&
    state.branch === 'cardiogenic-oscillation' &&
    !timing.inspiration &&
    !holdActive
  ) {
    flowLps += cardiogenicFlowOscillationLps(time, patient.hemodynamics.heartRatePerMin)
  }
  if (
    definition.phenotype === 'high-resistance' &&
    state.branch === 'secretions' &&
    patient.airway.secretions &&
    !holdActive
  ) {
    flowLps += secretionFlowDisturbanceLps(time, flowLps)
  }
  /*
   * An occlusion stops gas moving, in both directions. The volume trace therefore holds wherever it
   * was — it used to be clamped to ~0 for an expiratory hold, which threw away the trapped gas the
   * maneuver exists to measure, dropped the volume waveform to the floor mid-limb, and left the
   * held pressure to come entirely from the analytic `intrinsicPeepCmH2O` rather than from the gas
   * the trace says is still in the lung.
   */
  const nextVolume = holdActive ? volumeL : clamp(volumeL + flowLps * WAVEFORM_STEP_SECONDS, 0, 2)

  const totalResistance =
    patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps

  /*
   * Which pressure the airway is showing depends on what the valves are doing.
   *
   * - Occluded (a hold): the airway equilibrates with the alveolus, so the equation of motion at
   *   zero flow is what the manometer reads. This is the only time the elastic term — plateau on
   *   an inspiratory hold, total PEEP on an expiratory one — is visible at all.
   * - Inspiring: the ventilator is driving flow in, so the full equation of motion applies.
   * - Passively expiring: the expiratory valve regulates the circuit to the baseline. Alveolar
   *   pressure is still falling behind it, but the airway sits at baseline plus the drop across
   *   the expiratory limb. Applying the alveolar equation here drove the trace below zero.
   */
  let paw: number
  if (holdActive) {
    const secondsHeld = Math.max(0, HOLD_SECONDS - ((state.ventilator.holdUntil ?? time) - time))
    paw = equationOfMotionPressure({
      peepCmH2O: baselinePressure,
      intrinsicPeepCmH2O: residualIntrinsicPeep,
      resistanceCmH2OPerLps: totalResistance,
      flowLps: 0,
      volumeL: nextVolume * (1 - holdRelaxationFraction(secondsHeld)),
      complianceLPerCmH2O: patient.mechanics.complianceLPerCmH2O,
      inspiratoryEffortCmH2O: effort,
    })
  } else if (timing.inspiration) {
    paw = equationOfMotionPressure({
      peepCmH2O: baselinePressure,
      intrinsicPeepCmH2O: residualIntrinsicPeep,
      resistanceCmH2OPerLps: totalResistance,
      flowLps,
      volumeL: nextVolume,
      complianceLPerCmH2O: patient.mechanics.complianceLPerCmH2O,
      inspiratoryEffortCmH2O: effort,
    })
  } else {
    paw = expiratoryAirwayPressure({
      baselineCmH2O: baselinePressure,
      circuitResistanceCmH2OPerLps: patient.mechanics.tubeResistanceCmH2OPerLps,
      flowLps,
      inspiratoryEffortCmH2O: effort,
      elasticRecoilCmH2O:
        measurements.intrinsicPeepCmH2O +
        nextVolume / Math.max(0.005, patient.mechanics.complianceLPerCmH2O),
    })
  }
  if (pressureTargetedBreath && timing.inspiration && !holdActive) {
    paw = Math.min(
      paw,
      baselinePressure + breathPressureAboveBaseline + measurements.pressureOvershootCmH2O,
    )
  }
  return {
    sample: {
      time,
      pawCmH2O: round(clamp(paw, -5, 80), 2),
      flowLMin: round(flowLps * 60, 2),
      volumeMl: round(nextVolume * 1000, 1),
      pmusCmH2O: round(-effort, 2),
      /*
       * While the valves are shut the ventilator is not cycling, so the phase is the limb the
       * occlusion is holding — not whatever the free-running breath clock would have said. Letting
       * the clock keep flipping the phase through a four-second hold invented breath onsets on a
       * trace where no gas was moving.
       */
      phase: holdActive
        ? state.ventilator.holdType === 'expiratory'
          ? 'expiration'
          : 'inspiration'
        : timing.inspiration
          ? 'inspiration'
          : 'expiration',
      triggered: holdActive ? false : timing.triggered,
      spontaneous: holdActive ? false : timing.spontaneous || settings.mode === 'pressure-support',
    },
    volumeL: nextVolume,
  }
}

/*
 * The slow relationships, each written once and used twice: at case open, to record what the
 * relationship said about the authored presentation (`capturePhysiologyReference`), and on every
 * step, where only the change since then moves the patient (`updateSlowPhysiology`). None of the
 * coefficients below is new; they are the ones this function has always used.
 */

/** FiO₂ and PEEP as the oxygenation relationship sees them, including IntelliVent's controller. */
function oxygenationInputs(
  state: VentilationSimulationState,
  spo2Percent: number,
): { oxygenPercent: number; effectivePeepCmH2O: number } {
  const settings = state.ventilator.settings
  let oxygenPercent =
    state.ventilator.oxygenEnrichmentUntil &&
    state.ventilator.oxygenEnrichmentUntil > state.simulationTime
      ? 100
      : settings.oxygenPercent
  let effectivePeepCmH2O = settings.peepCmH2O
  if (
    settings.deviceMode === 'intellivent-asv' &&
    settings.advanced.automaticOxygenationController &&
    oxygenPercent < 100
  ) {
    const lowTarget = settings.advanced.targetSpO2LowPercent
    const oxygenationGap =
      spo2Percent < lowTarget ? lowTarget - spo2Percent : Math.min(0, lowTarget + 3 - spo2Percent)
    oxygenPercent = clamp(oxygenPercent + oxygenationGap * 3, 21, 100)
    effectivePeepCmH2O = clamp(settings.peepCmH2O + oxygenationGap * 0.5, 0, 18)
  }
  return { oxygenPercent, effectivePeepCmH2O }
}

/** The generic FiO₂/PEEP/shunt oxygenation relationship, in mmHg. */
function oxygenationTermMmHg(
  oxygenPercent: number,
  effectivePeepCmH2O: number,
  shuntFraction: number,
): number {
  const recruitmentBonus = effectivePeepCmH2O <= 12 ? effectivePeepCmH2O * 2 : 20
  return 35 + (oxygenPercent - 21) * 2.2 + recruitmentBonus - shuntFraction * 180
}

/** What trapped gas, mean airway pressure and ARDS overdistension take off the MAP. */
function circulatoryLoadMmHg(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  measurements: VentilatorMeasurements,
): number {
  let load =
    Math.max(0, measurements.intrinsicPeepCmH2O - 5) *
    (definition.phenotype === 'asthma-obstructive-shock' ? 2.4 : 1.1)
  load += Math.max(0, measurements.meanAirwayPressureCmH2O - 18) * 0.8
  if (
    definition.phenotype === 'ards-recruitment' &&
    ardsLungStateForPeep(state.ventilator.settings.peepCmH2O) === 'overdistended'
  ) {
    load += 15
  }
  return load
}

/** The comfort burdens, and the relief that resolving the case's mechanism brings. */
function dyspneaLoad(
  state: VentilationSimulationState,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  resolved: boolean,
): number {
  const settings = state.ventilator.settings
  const triggerBurden =
    measurements.ineffectiveEffortFraction * 4 + measurements.autotriggerFraction * 2
  const cyclingBurden = Math.min(
    4,
    Math.abs(
      measurements.mechanicalInspiratoryTimeSeconds - patient.drive.neuralInspiratoryTimeSeconds,
    ) * 4,
  )
  const assistBurden =
    settings.mode === 'pressure-support' ? Math.abs(settings.pressureSupportCmH2O - 11) * 0.22 : 0
  return (
    clamp(
      patient.human.painScore * 0.35 +
        patient.human.anxietyScore * 0.25 +
        triggerBurden +
        cyclingBurden +
        assistBurden,
      0,
      10,
    ) - (resolved ? 2 : 0)
  )
}

/** What hypotension and dyspnea add to the heart rate. */
function heartRateLoadPerMin(mapMmHg: number, dyspneaScore: number): number {
  return Math.max(0, 65 - mapMmHg) * 0.8 + dyspneaScore
}

/**
 * RASS at or below which the model bounds the dyspnea index. An existing engine rule (it also
 * drives the excessive-sedation risk), named here, not a new threshold.
 */
const DEEP_SEDATION_RASS = -4

/**
 * The case-open values of every slow relationship — see `PhysiologyReference`.
 *
 * Read from the patient the learner is shown (the authored presentation, with the case's branch
 * applied) and from the measurements of the prepared mechanical history, so the delivered minute
 * ventilation the CO₂ anchor divides by is the one the model will later compare it with.
 */
export function capturePhysiologyReference(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): PhysiologyReference {
  const presented = state.patient
  const effective = deriveEffectivePatient(state, definition)
  const measurements = state.measurements
  const resolved = isCaseResolved(state, definition)
  const oxygenation = oxygenationInputs(state, presented.gasExchange.spo2Percent)
  return {
    minuteVentilationLMin: Math.max(0.8, measurements.minuteVentilationLMin),
    paCO2MmHg: presented.gasExchange.paCO2MmHg,
    paO2MmHg: presented.gasExchange.paO2MmHg,
    spo2Percent: presented.gasExchange.spo2Percent,
    oxygenationTermMmHg: oxygenationTermMmHg(
      oxygenation.oxygenPercent,
      oxygenation.effectivePeepCmH2O,
      effective.gasExchange.shuntFraction,
    ),
    saturationCurvePercent: spo2FromPaO2(presented.gasExchange.paO2MmHg),
    mapMmHg: presented.hemodynamics.mapMmHg,
    systolicMmHg: presented.hemodynamics.systolicMmHg,
    diastolicMmHg: presented.hemodynamics.diastolicMmHg,
    mapLoadMmHg: circulatoryLoadMmHg(state, definition, measurements),
    heartRatePerMin: presented.hemodynamics.heartRatePerMin,
    heartRateLoadPerMin: heartRateLoadPerMin(
      presented.hemodynamics.mapMmHg,
      presented.human.dyspneaScore,
    ),
    dyspneaScore: presented.human.dyspneaScore,
    dyspneaLoad: dyspneaLoad(state, effective, measurements, resolved),
  }
}

/**
 * The slow patient: gas exchange, circulation, heart rate and comfort.
 *
 * Every target is the case's authored value plus what its relationship has changed by since the
 * case opened (`PhysiologyReference`). At the case's own inputs nothing moves; a change of
 * setting, a treatment taking effect, or a trace-derived quantity moving (delivered minute
 * ventilation, trapped gas, missed efforts) moves the patient by exactly as much as the
 * relationship has always said. The time constants and coefficients are unchanged.
 */
function updateSlowPhysiology(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient: PatientModelState,
  measurements: VentilatorMeasurements,
  deltaSeconds: number,
): PatientModelState {
  const next = clonePatient(patient)
  const reference = state.physiologyReference
  /*
   * CO₂: the authored PaCO₂ scaled by how delivered minute ventilation has changed. The anchor
   * used to be computed from the *initial settings* — tidal volume at pressure equilibrium times
   * the patient's neural rate — and compared with the minute ventilation the trace actually
   * delivers, which is a different quantity. On MV-05 those were 46.6 and 1.9 L/min, so the target
   * sat at the 110 mmHg ceiling from the first step and an untouched COPD patient climbed from 62
   * to 92 mmHg in three minutes; MV-12's pointed the other way and "normalised" an alkalemia the
   * case exists to show. Both terms are now the same measurement.
   */
  const targetPaCO2 = clamp(
    (reference.paCO2MmHg * reference.minuteVentilationLMin) /
      Math.max(0.8, measurements.minuteVentilationLMin),
    20,
    110,
  )
  next.gasExchange.paCO2MmHg = moveTowardExp(
    state.patient.gasExchange.paCO2MmHg,
    targetPaCO2,
    deltaSeconds,
    180,
  )
  next.gasExchange.pH = clamp(
    phFromBicarbonateAndPaCO2(next.gasExchange.bicarbonateMmolL, next.gasExchange.paCO2MmHg),
    6.7,
    7.75,
  )

  const oxygenation = oxygenationInputs(state, next.gasExchange.spo2Percent)
  const targetPaO2 = clamp(
    reference.paO2MmHg +
      oxygenationTermMmHg(
        oxygenation.oxygenPercent,
        oxygenation.effectivePeepCmH2O,
        next.gasExchange.shuntFraction,
      ) -
      reference.oxygenationTermMmHg,
    35,
    500,
  )
  next.gasExchange.paO2MmHg = moveTowardExp(
    state.patient.gasExchange.paO2MmHg,
    targetPaO2,
    deltaSeconds,
    45,
  )
  /*
   * Saturation moves along the engine's curve from the authored pairing. Where a case prints both a
   * PaO₂ and an SpO₂ they sit up to three points off this curve (MV-01: 54 mmHg and 84 %, where the
   * curve says 87 %) — the curve has no pH or temperature shift, and none is inferred here — so the
   * authored pair is kept as the starting point and the curve supplies only the change.
   */
  next.gasExchange.spo2Percent = moveTowardExp(
    state.patient.gasExchange.spo2Percent,
    clamp(
      reference.spo2Percent +
        spo2FromPaO2(next.gasExchange.paO2MmHg) -
        reference.saturationCurvePercent,
      50,
      100,
    ),
    deltaSeconds,
    15,
  )

  const resolved = isCaseResolved({ ...state, patient: next, measurements }, definition)
  let targetMap =
    reference.mapMmHg -
    (circulatoryLoadMmHg(state, definition, measurements) - reference.mapLoadMmHg)
  if (
    definition.phenotype === 'asthma-obstructive-shock' &&
    hasPerformedEffect(state, definition, 'disconnect-bag')
  ) {
    targetMap = Math.max(targetMap, 72)
  }
  if (next.hemodynamics.obstructiveShock) targetMap = Math.min(targetMap, 42)
  if (resolved) targetMap = Math.max(targetMap, 68)
  next.hemodynamics.mapMmHg = moveTowardExp(
    state.patient.hemodynamics.mapMmHg,
    clamp(targetMap, 25, 110),
    deltaSeconds,
    18,
  )
  /*
   * Systolic and diastolic keep the case's own pulse-pressure shape and scale with MAP. They were
   * rebuilt as MAP × 1.5 and MAP × 0.75 on the first step, so MV-01's authored 108/62 became 116/58
   * a fiftieth of a second into the case with nothing having changed.
   */
  const mapRatio = next.hemodynamics.mapMmHg / Math.max(1, reference.mapMmHg)
  next.hemodynamics.systolicMmHg = round(reference.systolicMmHg * mapRatio, 0)
  next.hemodynamics.diastolicMmHg = round(reference.diastolicMmHg * mapRatio, 0)

  let targetDyspnea =
    reference.dyspneaScore +
    dyspneaLoad(state, next, measurements, resolved) -
    reference.dyspneaLoad
  if (next.human.sedationScore <= DEEP_SEDATION_RASS) targetDyspnea = Math.min(targetDyspnea, 2)
  next.human.dyspneaScore = moveTowardExp(
    state.patient.human.dyspneaScore,
    clamp(targetDyspnea, 0, 10),
    deltaSeconds,
    30,
  )
  next.hemodynamics.heartRatePerMin = moveTowardExp(
    state.patient.hemodynamics.heartRatePerMin,
    reference.heartRatePerMin +
      heartRateLoadPerMin(next.hemodynamics.mapMmHg, next.human.dyspneaScore) -
      reference.heartRateLoadPerMin,
    deltaSeconds,
    45,
  )
  next.mechanics.intrinsicPeepCmH2O = measurements.intrinsicPeepCmH2O
  return next
}

function updateRisk(
  risk: RiskState,
  state: VentilationSimulationState,
  measurements: VentilatorMeasurements,
  deltaSeconds: number,
): RiskState {
  return {
    // Lung stress is the relaxed plateau. A patient working hard lowers the displayed number
    // without lowering what the alveoli are being distended to.
    highPlateau:
      risk.highPlateau +
      (measurements.relaxedPlateauPressureCmH2O > 30 ? deltaSeconds : -deltaSeconds * 0.25),
    stackedVolume:
      risk.stackedVolume +
      (measurements.stackedVolumeMl > measurements.exhaledVtMl * 1.4
        ? deltaSeconds
        : -deltaSeconds * 0.25),
    dynamicHyperinflation:
      risk.dynamicHyperinflation +
      (measurements.intrinsicPeepCmH2O > 10 ? deltaSeconds : -deltaSeconds * 0.25),
    hypoxemia:
      risk.hypoxemia +
      (state.patient.gasExchange.spo2Percent <
      SHARED_CRITICAL_CARE_THRESHOLDS.oxygenSaturation.criticalLowPercent
        ? deltaSeconds
        : -deltaSeconds * 0.25),
    hypotension:
      risk.hypotension +
      (state.patient.hemodynamics.mapMmHg <
      SHARED_CRITICAL_CARE_THRESHOLDS.meanArterialPressure.criticalLowMmHg
        ? deltaSeconds
        : -deltaSeconds * 0.25),
    excessiveSedation:
      risk.excessiveSedation +
      (state.patient.human.sedationScore <= DEEP_SEDATION_RASS
        ? deltaSeconds
        : -deltaSeconds * 0.25),
  }
}

function boundedRisk(risk: RiskState): RiskState {
  return Object.fromEntries(
    Object.entries(risk).map(([key, value]) => [key, clamp(value, 0, 999)]),
  ) as unknown as RiskState
}

interface AlarmDescriptor {
  code: string
  message: string
  priority: AlarmEvent['priority']
}

function alarmDescriptors(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): AlarmDescriptor[] {
  const descriptors: AlarmDescriptor[] = []
  const m = state.measurements
  if (m.peakPressureCmH2O >= state.ventilator.settings.highPressureLimitCmH2O) {
    descriptors.push({ code: 'HIGH_PRESSURE', message: 'High pressure', priority: 'high' })
  } else if (m.peakPressureCmH2O >= state.ventilator.settings.highPressureLimitCmH2O - 3) {
    descriptors.push({
      code: 'PRESSURE_LIMITATION',
      message: 'Pressure limitation',
      priority: 'medium',
    })
  }
  if (
    state.patient.gasExchange.spo2Percent <
    SHARED_CRITICAL_CARE_THRESHOLDS.oxygenSaturation.criticalLowPercent
  ) {
    descriptors.push({ code: 'SPO2_LOW', message: 'SpO₂ low', priority: 'high' })
  }
  if (
    state.patient.hemodynamics.mapMmHg <
    SHARED_CRITICAL_CARE_THRESHOLDS.meanArterialPressure.criticalLowMmHg
  ) {
    descriptors.push({ code: 'MAP_LOW', message: 'Patient blood pressure low', priority: 'high' })
  }
  // Evaluated on an exhaled breath, never on the analytic prediction a cold buffer falls back to.
  if (m.exhaledVtSource === 'trace' && m.exhaledVtMl < 250 && m.totalRatePerMin > 0) {
    descriptors.push({ code: 'VT_LOW', message: 'Vt low', priority: 'medium' })
  }
  if (m.totalRatePerMin < 2) {
    descriptors.push({ code: 'APNEA', message: 'Apnea', priority: 'high' })
  }
  if (state.patient.mechanics.airwayLeakFraction > 0.35) {
    descriptors.push({ code: 'DISCONNECTION', message: 'Disconnection', priority: 'high' })
  }
  if (
    definition.phenotype === 'autotriggering' &&
    state.branch === 'condensate' &&
    state.patient.airway.condensate
  ) {
    descriptors.push({
      code: 'FLOW_SENSOR_WATER',
      message: 'Check flow sensor for water',
      priority: 'high',
    })
  }
  return descriptors
}

/**
 * The alarm record after one evaluation of the alarm conditions on `state`, at its
 * `simulationTime`.
 *
 * `advanceSimulation` calls this once per fixed model step, so a transition is dated at the step
 * it happened on and an alarm that rises and clears within one outer call is still recorded; the
 * case-open epoch and `reopenAlarmEpoch` call it once at time zero. The record keeps **one entry
 * per alarm code**, not one per episode:
 *
 * - a code not in the history gets an entry stamped with this step's time, its id from that second;
 * - a code that stays active keeps its entry — id, `startedAt` and `acknowledgedAt` — every step;
 * - a code that stops is kept in the history marked inactive, and leaves `alarms`;
 * - a code that returns reuses its entry, first start and acknowledgement included.
 *
 * The history lists the active codes in evaluation order, then the inactive ones in the order the
 * previous record held them; `alarms` is the active set ordered by priority.
 */
function reconcileAlarms(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): Pick<VentilationSimulationState, 'alarms' | 'alarmHistory'> {
  const descriptors = alarmDescriptors(state, definition)
  const existingByCode = new Map(state.alarmHistory.map((alarm) => [alarm.code, alarm]))
  const active = descriptors.map((descriptor) => {
    const existing = existingByCode.get(descriptor.code)
    return {
      id: existing?.id ?? `${descriptor.code}-${Math.floor(state.simulationTime)}`,
      ...descriptor,
      startedAt: existing?.startedAt ?? state.simulationTime,
      acknowledgedAt: existing?.acknowledgedAt,
      active: true,
    }
  })
  const activeCodes = new Set(active.map((alarm) => alarm.code))
  const inactive = state.alarmHistory
    .filter((alarm) => !activeCodes.has(alarm.code))
    .map((alarm) => ({ ...alarm, active: false }))
  const rank = { high: 3, medium: 2, low: 1 }
  return {
    alarms: active.sort((a, b) => rank[b.priority] - rank[a.priority]),
    alarmHistory: [...active, ...inactive].slice(0, 20),
  }
}

function withCriticalErrors(state: VentilationSimulationState): VentilationSimulationState {
  const errors = new Set(state.criticalErrors)
  const timelyHemodynamicRescue = state.interventions.some(
    (record) =>
      (record.interventionId === 'disconnect-bag' ||
        record.interventionId === 'decompress-pneumothorax') &&
      record.time <= 15,
  )
  if (state.risk.highPlateau >= 15) errors.add('Sustained excessive plateau pressure')
  if (state.risk.dynamicHyperinflation >= 15) errors.add('Sustained severe dynamic hyperinflation')
  if (state.risk.hypotension >= 45 && !timelyHemodynamicRescue) {
    errors.add('Prolonged severe hypotension')
  }
  if (state.risk.stackedVolume >= 20) errors.add('Repeated stacked inflation')
  return { ...state, criticalErrors: [...errors] }
}

export function advanceSimulation(
  state: VentilationSimulationState,
  seconds: number,
  suppliedDefinition?: VentilationCaseDefinition,
): VentilationSimulationState {
  const definition = suppliedDefinition ?? resolveVentilationSimulationCase(state.caseId)
  const steps = Math.max(1, Math.ceil(seconds / WAVEFORM_STEP_SECONDS))
  const actualStep = seconds / steps
  let time = state.simulationTime
  let volumeL = state.patient.mechanics.endExpiratoryVolumeL
  let waveforms = [...state.waveforms]
  let trends = [...state.trends]
  /*
   * The step starts from the state the last step published, not from a fresh derivation of it.
   *
   * Each fixed step runs in one order: the state entering the step → the effective patient → the
   * breath clock, which reads the measurements the previous step published → the waveform sample →
   * the updated lung volume → the measurements this step publishes → slow physiology. This used to
   * re-derive the patient and the measurements once more at the top of every *call*, which is an
   * extra iteration of anything the measurements feed back into — and the number of calls is the
   * caller's batching, not the model's. On MV-05's combined PS 12 + ETS 40 correction that extra
   * iteration flipped the reported rate between 16 and 19 per call, the clock read whichever it
   * got at an onset, and 1×, 5× and 30× produced different patients (VTE 438 / 397 / 318 mL at
   * 30 s with the hold). Every action that changes an input already re-derives through the reducer
   * (`refreshMeasurements`, `applyIntervention`), at the model time it happens, so nothing is lost
   * by trusting the published state here (MV-PRE-REVIEW-02 sanity repair R1).
   */
  let patient = state.patient
  let measurements = state.measurements
  let risk = { ...state.risk }
  let working = state
  let lastTrendSecond = Math.floor(state.simulationTime)
  let ventilator = state.ventilator
  let previousPhase = state.waveforms.at(-1)?.phase ?? 'expiration'
  /*
   * The record of occlusions that actually happened, maintained as the valves close and open.
   *
   * An occlusion is opened (`completedAtSeconds: null`) at the boundary the hold is armed on,
   * updated at every occluded step so the recorded value is read from the last occluded sample
   * rather than from the released breath after it, and closed when the release time is reached.
   * `interpretable` only ever falls: the patient pulling at any instant during the occlusion is
   * what makes a plateau report them rather than the lung.
   */
  let holdRecords: PerformedHoldRecord[] = [...state.holdRecords]
  const openHoldIndex = () => holdRecords.findIndex((record) => record.completedAtSeconds === null)
  /*
   * The alarm record is carried step to step like the rest of the model, not observed once when the
   * call returns. It used to be reconciled only on the state this function published, so an alarm
   * that rose and cleared inside one call was never recorded, and whether it was depended on how
   * the caller batched time: MV-01 with PEEP 5 → 16 at 12 s raises pressure limitation for three
   * steps (12.86–12.90 s) before high pressure replaces it — kept in the history at 1× (0.1 s calls),
   * missing at 5× and 30× (MV-PRE-REVIEW-02 alarm-history repair).
   */
  let alarmRecord: Pick<VentilationSimulationState, 'alarms' | 'alarmHistory'> = {
    alarms: state.alarms,
    alarmHistory: state.alarmHistory,
  }

  for (let index = 0; index < steps; index += 1) {
    time += actualStep
    // `waveforms` too: the reported peak pressure and the end-inspiratory effort are read off the
    // trace, so a long advance must not derive them from the buffer as it was before the call.
    working = { ...working, ventilator, simulationTime: time, patient, measurements, waveforms }
    patient = deriveEffectivePatient(working, definition)
    ventilator = advanceBreathClock(
      ventilator,
      machineCyclePeriodSeconds(working, definition, patient, measurements),
      effortCycleSeconds(patient),
      machineInspiratorySeconds(working, definition, measurements),
      time,
    )
    working = { ...working, ventilator }
    let frame = nextWaveformSample(working, definition, patient, measurements, time, volumeL)

    /*
     * Arm a requested hold at the boundary the simulation actually reached.
     *
     * This used to be done in the reducer by jumping `simulationTime` forward by a boundary
     * computed from `simulationTime % cycle`. That arithmetic used a different rate from the one
     * `machineTiming` runs on, so it landed in the wrong limb: an inspiratory hold froze the model
     * at zero volume and baseline pressure — a flat line at PEEP, no plateau, which is the exact
     * opposite of what the maneuver is meant to show.
     */
    if (ventilator.pendingHold) {
      const reachedBoundary =
        ventilator.pendingHold === 'inspiratory'
          ? previousPhase === 'inspiration' && frame.sample.phase === 'expiration'
          : previousPhase === 'expiration' && frame.sample.phase === 'inspiration'
      if (reachedBoundary) {
        ventilator = {
          ...ventilator,
          holdType: ventilator.pendingHold,
          holdUntil: time + HOLD_SECONDS,
          pendingHold: null,
        }
        working = { ...working, ventilator }
        // Recompute this step with the valves shut, from the volume *before* it: an inspiratory
        // hold has to occlude on the full delivered breath, not after a step of expiratory flow.
        frame = nextWaveformSample(working, definition, patient, measurements, time, volumeL)
        holdRecords = [
          ...holdRecords.filter((record) => record.completedAtSeconds !== null).slice(-9),
          {
            hold: ventilator.holdType as 'inspiratory' | 'expiratory',
            startedAtSeconds: time,
            completedAtSeconds: null,
            valueCmH2O: 0,
            sampleCount: 0,
            interpretable: true,
            invalidReason: null,
            conditions: measurementConditionsFingerprint(working),
            conditionsChangedDuringHold: false,
          },
        ]
      }
    }
    previousPhase = frame.sample.phase
    volumeL = frame.volumeL
    if (!state.ventilator.frozen) {
      waveforms.push(frame.sample)
      if (waveforms.length > MAX_WAVEFORM_SAMPLES)
        waveforms = waveforms.slice(-MAX_WAVEFORM_SAMPLES)
    }
    patient = { ...patient, mechanics: { ...patient.mechanics, endExpiratoryVolumeL: volumeL } }
    measurements = deriveMeasurements({ ...working, patient }, definition, patient)
    const open = openHoldIndex()
    if (open >= 0) {
      const record = holdRecords[open]
      const releaseAt = ventilator.holdUntil ?? record.startedAtSeconds
      const occluded = ventilator.holdUntil !== null && ventilator.holdUntil > time
      /*
       * Everything here comes from the occluded sample the model just computed, not from
       * `measurements`, which reads the displayed buffer: the airway pressure with the valves
       * shut, and the patient's own effort at that instant. Both are the maneuver's evidence and
       * neither changes when the display is frozen. The conditions are re-read every occluded
       * step so a change that is reverted before release is still recorded as having happened.
       */
      const effortNow = Math.max(0, -frame.sample.pmusCmH2O)
      const quietNow = effortNow < EFFORT_DETECTION_FLOOR_CMH2O
      const conditionsNow = occluded
        ? measurementConditionsFingerprint({ ...working, patient })
        : record.conditions
      const changed =
        record.conditionsChangedDuringHold || (occluded && conditionsNow !== record.conditions)
      const interpretable = record.interpretable && (!occluded || quietNow) && !changed
      holdRecords = [...holdRecords]
      holdRecords[open] = {
        ...record,
        valueCmH2O: occluded ? round(frame.sample.pawCmH2O) : record.valueCmH2O,
        sampleCount: occluded ? record.sampleCount + 1 : record.sampleCount,
        interpretable,
        invalidReason: interpretable
          ? null
          : changed
            ? 'conditions-changed'
            : (record.invalidReason ?? 'effort'),
        conditionsChangedDuringHold: changed,
        completedAtSeconds: occluded ? null : releaseAt,
      }
    }
    patient = updateSlowPhysiology(
      { ...working, patient, measurements },
      definition,
      patient,
      measurements,
      actualStep,
    )
    risk = boundedRisk(updateRisk(risk, { ...working, patient }, measurements, actualStep))
    // On the state this step would publish, so the last step's evaluation is the one the call's
    // published alarms have always come from.
    alarmRecord = reconcileAlarms({ ...working, patient, measurements, ...alarmRecord }, definition)
    const currentSecond = Math.floor(time)
    if (currentSecond > lastTrendSecond) {
      trends.push({
        time,
        spo2Percent: round(patient.gasExchange.spo2Percent),
        paCO2MmHg: round(patient.gasExchange.paCO2MmHg),
        mapMmHg: round(patient.hemodynamics.mapMmHg),
        peakPressureCmH2O: measurements.peakPressureCmH2O,
        plateauPressureCmH2O: measurements.plateauPressureCmH2O,
        intrinsicPeepCmH2O: measurements.intrinsicPeepCmH2O,
        dyspneaScore: round(patient.human.dyspneaScore),
      })
      if (trends.length > MAX_TREND_SAMPLES) trends = trends.slice(-MAX_TREND_SAMPLES)
      lastTrendSecond = currentSecond
    }
  }

  const next: VentilationSimulationState = {
    ...state,
    simulationTime: time,
    patient,
    measurements,
    waveforms,
    trends,
    risk,
    holdRecords,
    alarms: alarmRecord.alarms,
    alarmHistory: alarmRecord.alarmHistory,
    // `ventilator`, not `state.ventilator`: a hold armed inside the loop lives on the local copy.
    ventilator: {
      ...ventilator,
      holdType:
        ventilator.holdUntil !== null && ventilator.holdUntil <= time ? null : ventilator.holdType,
      holdUntil:
        ventilator.holdUntil !== null && ventilator.holdUntil <= time ? null : ventilator.holdUntil,
      manualBreathUntil:
        ventilator.manualBreathUntil !== null && ventilator.manualBreathUntil <= time
          ? null
          : ventilator.manualBreathUntil,
    },
  }
  return withCriticalErrors(next)
}

function interventionDefinition(
  definition: VentilationCaseDefinition,
  interventionId: string,
): InterventionDefinition | undefined {
  return definition.interventions.find((item) => item.id === interventionId)
}

export function applyIntervention(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  interventionId: string,
): VentilationSimulationState {
  const intervention = interventionDefinition(definition, interventionId)
  if (!intervention) return { ...state, lastResponse: 'That action is not available in this case.' }
  const performedIds = new Set(state.interventions.map((record) => record.interventionId))
  if (!intervention.repeatable && performedIds.has(intervention.id)) return state
  if (intervention.prerequisites?.some((id) => !performedIds.has(id))) {
    return {
      ...state,
      lastResponse: `Complete ${intervention.prerequisites.join(', ')} before this action.`,
    }
  }
  const record = {
    id: `${intervention.id}-${state.simulationTime}-${state.interventions.length}`,
    interventionId: intervention.id,
    label: intervention.label,
    response: intervention.response,
    time: state.simulationTime,
    effectiveAt:
      intervention.category === 'assessment' || intervention.category === 'ventilator'
        ? state.simulationTime
        : state.simulationTime + intervention.latencySeconds,
  }
  let ventilator = { ...state.ventilator }
  let lastAbgAt = state.lastAbgAt
  const errors = new Set(state.criticalErrors)
  if (intervention.effectId === 'inspiratory-hold' || intervention.effectId === 'expiratory-hold') {
    // Requested, not started: the occlusion is armed at the next real breath boundary, same as a
    // hold performed from the console.
    ventilator = {
      ...ventilator,
      pendingHold: intervention.effectId === 'inspiratory-hold' ? 'inspiratory' : 'expiratory',
    }
  }
  /*
   * A drawn specimen, frozen here. `lastAbgAt` stays as the availability stamp the existing
   * surfaces read; the numbers now live on the sample so that waiting for the result, and time
   * passing after it, cannot resample the patient. The latency is the intervention's own
   * authored `latencySeconds`, not a second constant.
   */
  let arterialGasSamples = state.arterialGasSamples
  if (intervention.effectId === 'order-abg') {
    lastAbgAt = state.simulationTime + intervention.latencySeconds
    arterialGasSamples = [
      ...arterialGasSamples,
      collectRepeatArterialGasSample({
        caseId: state.caseId,
        sequence: arterialGasSamples.filter((sample) => sample.kind === 'repeat').length + 1,
        collectedAtSeconds: state.simulationTime,
        latencySeconds: intervention.latencySeconds,
        gasExchange: state.patient.gasExchange,
      }),
    ]
  }
  if (intervention.effectId === 'deepen-sedation') {
    if (definition.id === 'MV-15')
      errors.add('Deep sedation before assessing pain, dyspnea, and delirium')
  }
  if (intervention.unsafe && intervention.critical) errors.add(intervention.label)
  const next: VentilationSimulationState = {
    ...state,
    ventilator,
    interventions: [...state.interventions, record],
    phase: 'reassess',
    lastResponse: intervention.response,
    lastAbgAt,
    arterialGasSamples,
    criticalErrors: [...errors],
  }
  const effectivePatient = deriveEffectivePatient(next, definition)
  /*
   * The same latch the reducer applies at its exit. An intervention is part of the measurement
   * fingerprint, and `applyIntervention` is reachable directly as well as through the reducer, so
   * it asks the one contract rather than carrying a second copy of which changes count.
   */
  return latchOpenHoldConditionChange({
    ...next,
    patient: effectivePatient,
    measurements: deriveMeasurements(next, definition, effectivePatient),
  })
}

export function selectCaseOutcome(
  state: VentilationSimulationState,
  suppliedDefinition?: VentilationCaseDefinition,
): CaseOutcome {
  const definition = suppliedDefinition ?? resolveVentilationSimulationCase(state.caseId)
  const performed = new Set(state.interventions.map((record) => record.interventionId))
  const resolved = isCaseResolved(state, definition)
  const requiredActionsComplete = definition.requiredInterventionIds.every((id) =>
    performed.has(id),
  )
  const requiredReassessmentComplete = definition.requiredReassessmentIds.every((id) =>
    performed.has(id),
  )
  const safety =
    state.criticalErrors.length === 0 &&
    (definition.requiredInterventionIds.length === 0 ||
      performed.has(definition.requiredInterventionIds[0]))
      ? 20
      : 0
  const mechanism =
    state.prediction.committed &&
    state.prediction.mechanismId === definition.correctMechanismId &&
    state.prediction.priorityId === definition.correctPriorityId &&
    state.prediction.responseId === definition.correctResponseId
      ? 20
      : state.prediction.mechanismId === definition.correctMechanismId
        ? 10
        : 0
  const correctiveActions = resolved ? 30 : requiredActionsComplete ? 15 : 0
  const reassessment = state.reassessment.committed && requiredReassessmentComplete ? 20 : 0
  const communicationComfort = performed.has('communicate-plan') ? 10 : 0
  const raw = safety + mechanism + correctiveActions + reassessment + communicationComfort
  const hintPenalty = state.experience === 'practice' ? state.hintsUsed * 5 : 0
  const score = clamp(raw - hintPenalty, 0, 100)
  return {
    score,
    mastery: score >= 80 && state.criticalErrors.length === 0,
    domains: { safety, mechanism, correctiveActions, reassessment, communicationComfort },
    criticalErrors: state.criticalErrors,
    resolved,
  }
}

export function defaultSettingsForMode(mode: MechanicalVentilationSettings['mode']) {
  return createDefaultMechanicalVentilationSettings(mode)
}
