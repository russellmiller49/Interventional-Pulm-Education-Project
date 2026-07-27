import type {
  MechanicalVentilationSettings,
  InterventionEffectId,
  MetricCondition,
  MetricKey,
  PatientModelState,
  VentilationCaseDefinition,
  VentilationSimulationState,
  VentilatorMeasurements,
  WaveformSample,
} from './types'
import { isAdaptivePressureMode, isAdaptiveSupportMode, isSimvMode, isTwoLevelMode } from './modes'

export const WAVEFORM_SAMPLE_HZ = 50
export const WAVEFORM_STEP_SECONDS = 1 / WAVEFORM_SAMPLE_HZ
export const WAVEFORM_WINDOW_SECONDS = 12
export const MAX_WAVEFORM_SAMPLES = WAVEFORM_SAMPLE_HZ * WAVEFORM_WINDOW_SECONDS
export const MAX_TREND_SAMPLES = 180

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function round(value: number, places = 1): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

export function moveTowardExp(
  value: number,
  target: number,
  deltaSeconds: number,
  timeConstantSeconds: number,
): number {
  const fraction = 1 - Math.exp(-deltaSeconds / Math.max(0.01, timeConstantSeconds))
  return value + (target - value) * fraction
}

export function equationOfMotionPressure(args: {
  peepCmH2O: number
  intrinsicPeepCmH2O: number
  resistanceCmH2OPerLps: number
  flowLps: number
  volumeL: number
  complianceLPerCmH2O: number
  inspiratoryEffortCmH2O: number
}): number {
  return (
    args.peepCmH2O +
    args.intrinsicPeepCmH2O +
    args.resistanceCmH2OPerLps * args.flowLps +
    args.volumeL / Math.max(0.005, args.complianceLPerCmH2O) -
    args.inspiratoryEffortCmH2O
  )
}

/**
 * Airway-opening pressure during **passive expiration**.
 *
 * The equation of motion above describes alveolar pressure. Applying it at the airway during
 * expiration subtracts the full resistive drop from the elastic term and drove the trace far below
 * baseline — down to −4 cmH₂O on a PEEP of 5, drawn as a spike under every breath. That is not what
 * a ventilator shows: the expiratory valve regulates the circuit to the set baseline, so proximal
 * pressure falls to PEEP and stays there, sitting only slightly above it while gas is still moving
 * through the expiratory limb (Egan's Fig. 3.3; visible on the supplied Evita and PB980 tracings).
 *
 * The alveolus is still emptying against its own elastic recoil — that pressure simply is not
 * visible at the airway until the valve closes, which is exactly what an expiratory hold is for.
 *
 * Patient effort reaches the airway only once it has overcome the recoil still stored in the lung,
 * so a trigger deflection below baseline is preserved — see `elasticRecoilCmH2O` below.
 */
export function expiratoryAirwayPressure(args: {
  baselineCmH2O: number
  circuitResistanceCmH2OPerLps: number
  flowLps: number
  inspiratoryEffortCmH2O: number
  /** Elastic recoil still stored in the lung, `volume / compliance`. */
  elasticRecoilCmH2O: number
}): number {
  /*
   * How much of an effort the airway manometer actually sees depends on what the effort is working
   * against. While recoil still exceeds it, gas is leaving and the expiratory valve holds the
   * circuit at baseline — the effort is spent inside the chest and the airway barely moves. That is
   * why an ineffective effort is a *flow* finding: it notches the expiratory limb (see
   * `passiveExpiratoryFlowLps`) while leaving the pressure trace nearly flat. Only the surplus over
   * recoil is left to pull the circuit down, which is what draws a trigger deflection.
   *
   * Subtracting the whole effort here instead put the entire sign on the pressure trace, at the
   * muscle's full amplitude, on the one waveform where it is least visible at the bedside.
   */
  const surplusEffort = Math.max(0, args.inspiratoryEffortCmH2O - args.elasticRecoilCmH2O)
  // Flow is negative during expiration; the drop across the expiratory limb raises airway pressure
  // slightly above baseline while it lasts.
  return (
    args.baselineCmH2O + args.circuitResistanceCmH2OPerLps * Math.abs(args.flowLps) - surplusEffort
  )
}

/**
 * Fractional fall of the held pressure during an occlusion — the slow stress relaxation and
 * pendelluft redistribution between lung units with different time constants that makes a real
 * plateau drift gently downward rather than sitting perfectly flat. Modeled, not measured: it is
 * here so the plateau reads like a tracing, not so a number can be taken off it.
 */
/**
 * Effort large enough that the model stops treating a plateau as interpretable.
 *
 * A detection floor for the simulated effort signal, not a clinical threshold — there is no
 * published pressure below which a patient counts as relaxed. Any appreciable effort makes a
 * plateau something other than the elastic pressure of the respiratory system.
 */
export const EFFORT_DETECTION_FLOOR_CMH2O = 1.5

/**
 * Inspiratory effort at the moment a plateau would be read, taken off the trace so the reported
 * pressures and the drawn ones cannot disagree.
 *
 * Looks for the last end-inspiration in the buffer — the final inspiratory sample before the
 * ventilator cycled — and returns the magnitude of muscle pressure there.
 */
export function endInspiratoryEffortCmH2O(waveforms: readonly WaveformSample[]): number {
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'expiration' && waveforms[index - 1].phase === 'inspiration') {
      return Math.max(0, -waveforms[index - 1].pmusCmH2O)
    }
  }
  return 0
}

/**
 * Tidal volume over the last complete inflation on the trace — what the ventilator's flow sensor
 * would have integrated, rather than what the settings predict.
 *
 * The predicted value is the volume a pressure-targeted breath reaches at **equilibrium**, and no
 * such breath is allowed to reach equilibrium: it is cycled at Ti, often well short of it. On a
 * flow-cycled breath that alone costs the ETS fraction, and a breath clamped by `tiMaxSeconds`
 * loses much more — MV-05 has a time constant of 1.92 s and 1.5 s to fill in, so it reaches about
 * 54% of the predicted volume. Seven of fifteen cases were reporting a tidal volume the trace never
 * delivered, and because the relaxed plateau is derived from that volume, four of them printed a
 * plateau above their own peak.
 *
 * Measured from the volume waveform, which is the running integral of flow and therefore carries
 * trapped gas, patient effort and stacked inflations for free: peak volume during the breath less
 * the volume it started from. Same argument as `observedPeakAirwayPressureCmH2O` — the number and
 * the drawing cannot disagree if there is only one of them.
 *
 * Bounded by the last completed **inflation** rather than the last complete breath cycle: the
 * slowest cases deliver fewer than two breaths in the 12 s buffer, so requiring two inspiration
 * onsets left exactly the cases with the worst prediction error — MV-05 at 8/min, MV-12 at 5/min —
 * falling back to the predicted value forever.
 *
 * Undefined until the buffer holds one whole inflation, so callers keep the predicted value as
 * their cold-start fallback.
 */
export function observedTidalVolumeMl(waveforms: readonly WaveformSample[]): number | undefined {
  /*
   * Walks back until an inflation that actually moved gas. Switching mode re-times the breath and
   * can leave a one-sample inspiration behind in the buffer; reporting a tidal volume of zero off
   * that transient would be worse than falling back to the predicted value.
   */
  let searchTo = waveforms.length
  while (searchTo > 1) {
    let cycledOff = -1
    for (let index = searchTo - 1; index > 0; index -= 1) {
      if (waveforms[index].phase === 'expiration' && waveforms[index - 1].phase === 'inspiration') {
        cycledOff = index
        break
      }
    }
    if (cycledOff < 1) return undefined
    let start = -1
    for (let index = cycledOff - 1; index > 0; index -= 1) {
      if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
        start = index
        break
      }
    }
    if (start < 1) return undefined
    const startedFrom = waveforms[start - 1].volumeMl
    let peak = startedFrom
    for (let index = start; index < cycledOff; index += 1) {
      peak = Math.max(peak, waveforms[index].volumeMl)
    }
    if (peak > startedFrom) return peak - startedFrom
    searchTo = start
  }
  return undefined
}

/**
 * Lung volume immediately before the last inspiration began — the gas that did not get out.
 *
 * Auto-PEEP has two representations in this engine: `intrinsicPeepCmH2O`, derived per case from the
 * time constant against the expiratory time, and this — the recoil of whatever the trace itself
 * failed to exhale. They are the same physical thing, so the equation of motion must not add both;
 * see `unmodeledIntrinsicPeepCmH2O`.
 */
export function observedEndExpiratoryVolumeMl(
  waveforms: readonly WaveformSample[],
): number | undefined {
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
      return waveforms[index - 1].volumeMl
    }
  }
  return undefined
}

/**
 * The part of a case's auto-PEEP that the volume trace is *not* already carrying.
 *
 * `volumeL` in the equation of motion is absolute lung volume, so wherever the trace fails to empty
 * it is already producing the elastic recoil of the trapped gas. Adding the full analytic
 * `intrinsicPeepCmH2O` on top of that counted the same gas twice — worst on the two air-trapping
 * cases, which are precisely the ones the term exists for. Only the shortfall is added, so the
 * authored total is preserved while the trace supplies as much of it as it actually can.
 */
export function unmodeledIntrinsicPeepCmH2O(
  intrinsicPeepCmH2O: number,
  endExpiratoryVolumeL: number,
  complianceLPerCmH2O: number,
): number {
  const carriedByTheTrace = endExpiratoryVolumeL / Math.max(0.005, complianceLPerCmH2O)
  return Math.max(0, intrinsicPeepCmH2O - carriedByTheTrace)
}

/**
 * Plateau estimated from the trace at end-inspiration, without occluding anything.
 *
 * What an instantaneous occlusion would have shown: the airway pressure at the last end-inspiratory
 * sample, less the pressure still being spent driving gas through the resistance at that moment. It
 * is an estimate, not a measurement — only a real hold measures a plateau — but it is an estimate
 * off the trace, which the predicted one was not.
 *
 * Deriving the displayed plateau from the analytic tidal volume and auto-PEEP instead let it come
 * out **above the peak the trace ever reached** on four cases: pressure-targeted breaths are capped
 * at their set pressure, so no arithmetic on the settings can be trusted to land under it.
 */
export function observedPlateauPressureCmH2O(
  waveforms: readonly WaveformSample[],
  resistanceCmH2OPerLps: number,
): number | undefined {
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'expiration' && waveforms[index - 1].phase === 'inspiration') {
      const endInspiratory = waveforms[index - 1]
      return endInspiratory.pawCmH2O - resistanceCmH2OPerLps * (endInspiratory.flowLMin / 60)
    }
  }
  return undefined
}

/**
 * How long the last complete expiration actually lasted, in seconds.
 *
 * Gas trapping is a race between the time constant and the time the lung is given to empty, and the
 * time it is given is set by the rate the ventilator is **cycling** at. Deriving it from the
 * patient's neural rate instead — `deriveEffectiveVentilationRate` returns the neural rate in
 * pressure support — invented trapping on cases where the machine cycles far more slowly than the
 * patient is trying to breathe. On MV-05 that put auto-PEEP at 22.4 cmH₂O against an authored 10,
 * over a trace whose lung empties completely: it assumed 0.64 s of expiratory time where the trace
 * had 6 s. Fourth instance of the same two-clocks defect.
 *
 * Read off the trace, which also sidesteps the circularity — auto-PEEP drives the ineffective-effort
 * fraction, which drives the machine rate, which would otherwise drive auto-PEEP.
 */
export function observedExpiratoryTimeSeconds(
  waveforms: readonly WaveformSample[],
): number | undefined {
  let onset = -1
  for (let index = waveforms.length - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'inspiration' && waveforms[index - 1].phase === 'expiration') {
      onset = index
      break
    }
  }
  if (onset < 1) return undefined
  for (let index = onset - 1; index > 0; index -= 1) {
    if (waveforms[index].phase === 'expiration' && waveforms[index - 1].phase === 'inspiration') {
      return waveforms[onset].time - waveforms[index].time
    }
  }
  return undefined
}

/** Highest airway pressure in the buffer — what the ventilator would be reporting as peak. */
export function observedPeakAirwayPressureCmH2O(
  waveforms: readonly WaveformSample[],
): number | undefined {
  if (waveforms.length === 0) return undefined
  let peak = Number.NEGATIVE_INFINITY
  for (const sample of waveforms) peak = Math.max(peak, sample.pawCmH2O)
  return Number.isFinite(peak) ? peak : undefined
}

/**
 * The retained-secretions sign, as a **flow** disturbance.
 *
 * Secretions sitting in the airway make gas passing them stutter, and the classic bedside finding
 * is a saw-tooth on the *flow* trace; the pressure trace inherits it through the resistive term,
 * which is why the ripple is larger the higher the resistance. Modeling it the other way round —
 * adding a fixed sine to pressure and leaving flow perfectly smooth — drew the one waveform that
 * cannot show the sign and left the one that does show it flat.
 *
 * Amplitude scales with how much gas is actually moving, so the disturbance disappears wherever
 * flow does: the end-inspiratory pause, the expiratory tail, and any occlusion.
 */
export function secretionFlowDisturbanceLps(timeSeconds: number, flowLps: number): number {
  const frequencyHz = 6.4
  const amplitudeLps = 0.06
  const phase = (timeSeconds * frequencyHz) % 1
  const sawtooth = phase * 2 - 1
  const moving = Math.min(1, Math.abs(flowLps) / 0.25)
  return sawtooth * amplitudeLps * moving
}

/**
 * Cardiogenic oscillations, as a **flow** disturbance at the heart rate.
 *
 * Each systole displaces gas in the lung adjacent to the heart, so the flow trace carries a small
 * ripple at the heart rate — most visible late in expiration, once the passive limb has decayed and
 * there is nothing else moving. The pressure trace inherits it through the resistive drop. This is
 * the finding that makes a flow-triggered ventilator autotrigger: the ripple crosses the trigger
 * threshold and the machine reads it as an effort.
 *
 * The amplitude is the one the autotrigger rule already assumes: `derivedMeasurements` autotriggers
 * a flow trigger set below `CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN`, so drawing the ripple at that
 * same amplitude means the trace and the rule cannot disagree — the learner can look at the flow
 * limb, look at the trigger setting, and see for themselves why the machine is cycling. The
 * previous ±0.7 L/min on an ±80 L/min axis gave no visible reason for the breaths being delivered.
 *
 * Zero-mean by construction: a heartbeat displaces gas back and forth, it does not inflate anyone.
 */
export const CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN = 1.5

export function cardiogenicFlowOscillationLps(
  timeSeconds: number,
  heartRatePerMin: number,
): number {
  const frequencyHz = Math.max(0.5, heartRatePerMin) / 60
  const amplitudeLps = CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN / 60
  return Math.sin(timeSeconds * 2 * Math.PI * frequencyHz) * amplitudeLps
}

export function holdRelaxationFraction(secondsHeld: number): number {
  const amplitude = 0.06
  const timeConstantSeconds = 1.4
  return amplitude * (1 - Math.exp(-Math.max(0, secondsHeld) / timeConstantSeconds))
}

/**
 * Most inward flow a patient can draw while the demand valve is shut, in L/s.
 *
 * An effort that fails to open the valve is not drawing from the ventilator; it can only pull on
 * the bias flow crossing the circuit. This is what stops an ineffective effort from being drawn as
 * a full inspiration on the flow trace.
 */
export const CLOSED_VALVE_BIAS_FLOW_LPS = 5 / 60

/**
 * Expiratory flow at the airway, with the patient's effort in it.
 *
 * Expiration is driven by the elastic recoil still stored in the lung, so flow is that recoil
 * pressure divided by the resistance it has to cross. An inspiratory effort during expiration works
 * *against* that recoil: it lowers alveolar pressure, the driving pressure falls, and expiratory
 * flow slows — the notch back toward zero that is the bedside sign of an ineffective effort. If the
 * effort exceeds the recoil left in the lung, flow crosses zero, bounded by what a shut demand
 * valve can supply.
 *
 * Leaving the effort out drew this sign on the pressure trace alone: an 8 cmH₂O deflection on the
 * airway pressure and a perfectly smooth exponential on the flow limb, which is the one trace the
 * finding is actually taught on. Same defect as the retained-secretions saw-tooth in §1.8 — a sign
 * put on a waveform that does not carry it.
 *
 * This is also why gas trapping makes efforts ineffective: the more recoil is still stored at
 * end-expiration, the larger the effort has to be before any flow reverses at all.
 */
export function passiveExpiratoryFlowLps(
  volumeL: number,
  resistanceCmH2OPerLps: number,
  complianceLPerCmH2O: number,
  inspiratoryEffortCmH2O = 0,
): number {
  const timeConstant = Math.max(0.08, resistanceCmH2OPerLps * complianceLPerCmH2O)
  const recoilFlow = -volumeL / timeConstant
  if (inspiratoryEffortCmH2O <= 0) return recoilFlow
  const effortFlow = inspiratoryEffortCmH2O / Math.max(2, resistanceCmH2OPerLps)
  const net = recoilFlow + effortFlow
  if (net <= 0) return net
  // Saturates smoothly rather than clipping flat, so a larger effort still draws a larger notch.
  return CLOSED_VALVE_BIAS_FLOW_LPS * Math.tanh(net / CLOSED_VALVE_BIAS_FLOW_LPS)
}

/**
 * Flow-delivery time for a volume-targeted breath, from settings alone. Split out of
 * `deriveMechanicalInspiratoryTime` so device profiles can express a pause in seconds — the unit
 * the Evita, PB980, and AVEA all print — without needing a patient model.
 */
export function deriveVolumeFlowTimeSeconds(settings: MechanicalVentilationSettings): number {
  if (settings.mode !== 'volume-ac') return 0
  const patternFactor =
    settings.flowPattern === 'square'
      ? 1
      : settings.flowPattern === 'sine'
        ? 0.64
        : settings.flowPattern === 'decelerating-100'
          ? 0.55
          : 0.72
  return clamp(settings.vtMl / Math.max(1, settings.peakFlowLMin * patternFactor * 16.67), 0.2, 3)
}

export function deriveMechanicalInspiratoryTime(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
): number {
  if (isTwoLevelMode(settings.deviceMode)) return settings.advanced.tHighSeconds
  if (settings.advanced.intelliSyncEnabled) {
    return clamp(patient.drive.neuralInspiratoryTimeSeconds, 0.2, 3)
  }
  if (settings.mode === 'volume-ac') return deriveVolumeFlowTimeSeconds(settings)
  if (settings.mode === 'pressure-ac') return settings.inspiratoryTimeSeconds
  const tau = Math.max(
    0.08,
    patient.mechanics.resistanceCmH2OPerLps * patient.mechanics.complianceLPerCmH2O,
  )
  const etsFraction = clamp(settings.etsPercent / 100, 0.05, 0.8)
  return clamp(-tau * Math.log(etsFraction) + settings.pRampMs / 2000, 0.2, settings.tiMaxSeconds)
}

function asvTargets(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg: number,
): { minuteVentilationLMin: number; ratePerMin: number; vtMl: number } {
  const timeConstant = Math.max(
    0.08,
    (patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps) *
      patient.mechanics.complianceLPerCmH2O,
  )
  let minuteVentilationLMin =
    Math.max(25, predictedBodyWeightKg) * 0.1 * (settings.advanced.minuteVolumePercent / 100)
  if (
    settings.deviceMode === 'intellivent-asv' &&
    settings.advanced.automaticVentilationController
  ) {
    minuteVentilationLMin *= clamp(
      patient.gasExchange.paCO2MmHg / Math.max(25, settings.advanced.targetPetCO2MmHg),
      0.7,
      1.4,
    )
  }
  minuteVentilationLMin = clamp(minuteVentilationLMin, 2, 25)
  const ratePerMin = clamp(60 / (1 + 6 * timeConstant), 8, 30)
  const vtMl = clamp((minuteVentilationLMin * 1000) / ratePerMin, 250, 900)
  return { minuteVentilationLMin, ratePerMin, vtMl }
}

export function deriveEffectiveVentilationRate(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg = 70,
): number {
  if (isTwoLevelMode(settings.deviceMode)) {
    const releaseRate =
      60 / Math.max(0.3, settings.advanced.tHighSeconds + settings.advanced.tLowSeconds)
    return Math.max(releaseRate, patient.drive.neuralRatePerMin)
  }
  if (isAdaptiveSupportMode(settings.deviceMode)) {
    if (
      settings.deviceMode === 'intellivent-asv' &&
      !settings.advanced.automaticVentilationController &&
      settings.mode === 'pressure-ac'
    ) {
      return Math.max(settings.ratePerMin, patient.drive.neuralRatePerMin)
    }
    return Math.max(
      asvTargets(settings, patient, predictedBodyWeightKg).ratePerMin,
      patient.drive.neuralRatePerMin,
    )
  }
  if (settings.mode === 'pressure-support') {
    if (patient.drive.neuralRatePerMin <= 0 && settings.apneaBackupEnabled) {
      return settings.apneaRatePerMin
    }
    return Math.max(1, patient.drive.neuralRatePerMin)
  }
  return Math.max(settings.ratePerMin, patient.drive.neuralRatePerMin)
}

export function effectiveBaselinePressureCmH2O(settings: MechanicalVentilationSettings): number {
  return isTwoLevelMode(settings.deviceMode) ? settings.advanced.pLowCmH2O : settings.peepCmH2O
}

export function targetTidalVolumeMl(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg = 70,
): number {
  if (settings.deviceMode === 'volume-support' || isAdaptivePressureMode(settings.deviceMode)) {
    return settings.advanced.targetVtMl
  }
  if (settings.advanced.autoFlowEnabled && settings.mode === 'volume-ac') return settings.vtMl
  if (isAdaptiveSupportMode(settings.deviceMode)) {
    return asvTargets(settings, patient, predictedBodyWeightKg).vtMl
  }
  if (settings.mode === 'volume-ac') return settings.vtMl
  const pressureAboveBaseline = effectivePressureAboveBaselineCmH2O(
    settings,
    patient,
    predictedBodyWeightKg,
  )
  return clamp(
    pressureAboveBaseline * Math.max(0.005, patient.mechanics.complianceLPerCmH2O) * 1000,
    100,
    1400,
  )
}

export function effectivePressureAboveBaselineCmH2O(
  settings: MechanicalVentilationSettings,
  patient: PatientModelState,
  predictedBodyWeightKg = 70,
): number {
  const compliance = Math.max(0.005, patient.mechanics.complianceLPerCmH2O)
  const patientContribution = patient.drive.effortAmplitudeCmH2O * 0.35
  if (isTwoLevelMode(settings.deviceMode)) {
    return Math.max(1, settings.advanced.pHighCmH2O - settings.advanced.pLowCmH2O)
  }
  if (settings.deviceMode === 'proportional-assist') {
    const supportFraction = clamp(settings.advanced.proportionalSupportPercent / 100, 0.05, 0.95)
    return clamp(
      (patient.drive.effortAmplitudeCmH2O * supportFraction) / Math.max(0.15, 1 - supportFraction),
      2,
      30,
    )
  }
  if (settings.deviceMode === 'volume-support') {
    return clamp(settings.advanced.targetVtMl / 1000 / compliance - patientContribution, 2, 35)
  }
  if (
    isAdaptivePressureMode(settings.deviceMode) ||
    (settings.advanced.autoFlowEnabled && settings.mode === 'volume-ac')
  ) {
    const target = settings.mode === 'volume-ac' ? settings.vtMl : settings.advanced.targetVtMl
    return clamp(target / 1000 / compliance, 5, 40)
  }
  if (isAdaptiveSupportMode(settings.deviceMode)) {
    const target = asvTargets(settings, patient, predictedBodyWeightKg).vtMl
    return clamp(target / 1000 / compliance - patientContribution, 5, 35)
  }
  if (settings.mode === 'pressure-ac') return settings.deltaPControlCmH2O
  if (settings.mode === 'pressure-support') return settings.pressureSupportCmH2O
  return clamp(settings.vtMl / 1000 / compliance, 5, 40)
}

export function usesPressureTargetedDelivery(settings: MechanicalVentilationSettings): boolean {
  return (
    settings.mode !== 'volume-ac' ||
    settings.advanced.autoFlowEnabled ||
    isAdaptivePressureMode(settings.deviceMode) ||
    isTwoLevelMode(settings.deviceMode) ||
    isAdaptiveSupportMode(settings.deviceMode)
  )
}

function performedEffectIds(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): Set<InterventionEffectId> {
  const interventionById = new Map(definition.interventions.map((item) => [item.id, item]))
  return new Set(
    state.interventions
      .filter((record) => record.effectiveAt <= state.simulationTime)
      .map((record) => interventionById.get(record.interventionId)?.effectId)
      .filter((effectId): effectId is InterventionEffectId => effectId !== undefined),
  )
}

export function hasPerformedEffect(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  effectId: InterventionEffectId,
): boolean {
  return performedEffectIds(state, definition).has(effectId)
}

function branchCorrected(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): boolean {
  const effects = performedEffectIds(state, definition)
  if (definition.phenotype === 'autotriggering') {
    if (state.branch === 'condensate') return effects.has('drain-condensate')
    if (state.branch === 'leak') return effects.has('correct-leak')
    return (
      state.ventilator.settings.trigger.type === 'flow' &&
      state.ventilator.settings.trigger.thresholdLMin >= 1.5
    )
  }
  if (definition.phenotype === 'high-resistance') {
    if (state.branch === 'secretions') return effects.has('suction-airway')
    if (state.branch === 'hme-or-ett') {
      return effects.has('remove-hme') || effects.has('reposition-ett')
    }
    return effects.has('bronchodilator')
  }
  return true
}

export function deriveEffectivePatient(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): PatientModelState {
  const base = definition.initialPatient
  const effects = performedEffectIds(state, definition)
  const settings = state.ventilator.settings
  const patient: PatientModelState = {
    /*
     * Mechanics are re-derived from the case each time, but `endExpiratoryVolumeL` is not a property
     * of the case — it is how much gas is in the lung right now, advanced sample by sample by
     * `advanceSimulation`. Rebuilding it from the definition threw the running volume away every
     * time an intervention was performed, which is why an expiratory hold armed through an authored
     * `expiratory-hold` intervention occluded an empty lung and reported no trapped gas at all.
     */
    mechanics: {
      ...base.mechanics,
      endExpiratoryVolumeL: state.patient.mechanics.endExpiratoryVolumeL,
    },
    drive: { ...base.drive },
    gasExchange: { ...state.patient.gasExchange },
    hemodynamics: { ...state.patient.hemodynamics },
    human: { ...state.patient.human },
    airway: { ...state.patient.airway },
  }

  if (state.branch === 'leak' && patient.airway.circuitLeak) {
    patient.mechanics.airwayLeakFraction = Math.max(patient.mechanics.airwayLeakFraction, 0.12)
  }
  if (definition.phenotype === 'high-resistance') {
    patient.mechanics.resistanceCmH2OPerLps =
      state.branch === 'bronchospasm' ? 30 : Math.max(26, patient.mechanics.resistanceCmH2OPerLps)
  }

  if (effects.has('bronchodilator')) {
    patient.mechanics.resistanceCmH2OPerLps *=
      definition.phenotype === 'high-resistance' ? 0.4 : 0.62
    patient.airway.bronchospasm = false
  }
  if (effects.has('suction-airway')) {
    patient.mechanics.resistanceCmH2OPerLps *= state.branch === 'secretions' ? 0.4 : 0.86
    patient.airway.secretions = false
  }
  if (effects.has('remove-hme') || effects.has('reposition-ett')) {
    patient.mechanics.resistanceCmH2OPerLps = Math.min(patient.mechanics.resistanceCmH2OPerLps, 12)
    patient.airway.hmeObstructed = false
    patient.airway.ettObstructed = false
  }
  if (effects.has('drain-condensate')) patient.airway.condensate = false
  if (effects.has('correct-leak')) {
    patient.airway.circuitLeak = false
    patient.mechanics.airwayLeakFraction = 0
  }
  if (effects.has('decompress-pneumothorax')) {
    patient.airway.pneumothorax = false
    patient.mechanics.complianceLPerCmH2O = Math.max(patient.mechanics.complianceLPerCmH2O, 0.028)
    patient.hemodynamics.obstructiveShock = false
  }
  if (effects.has('pleural-drainage')) {
    patient.mechanics.complianceLPerCmH2O = Math.max(patient.mechanics.complianceLPerCmH2O, 0.035)
  }
  if (effects.has('disconnect-bag')) {
    patient.mechanics.endExpiratoryVolumeL *= 0.1
    patient.mechanics.intrinsicPeepCmH2O *= 0.2
  }
  if (effects.has('treat-drive')) {
    patient.drive.neuralRatePerMin = Math.max(18, patient.drive.neuralRatePerMin - 5)
    patient.drive.effortAmplitudeCmH2O *= 0.78
  }
  if (effects.has('reduce-sedation')) {
    patient.human.sedationScore = Math.min(-1, patient.human.sedationScore + 2)
    patient.drive.variability = Math.max(0.12, patient.drive.variability)
    if (definition.phenotype === 'over-assistance') {
      patient.drive.neuralRatePerMin += 4
    }
  }
  if (effects.has('deepen-sedation')) {
    patient.human.sedationScore = -5
    patient.drive.effortAmplitudeCmH2O *= 0.2
    patient.drive.neuralRatePerMin *= 0.65
  }
  if (effects.has('neuromuscular-blockade')) {
    patient.drive.effortAmplitudeCmH2O = 0
  }
  if (effects.has('communication-board')) patient.human.canCommunicate = true
  if (effects.has('treat-pain')) patient.human.painScore = Math.max(1, patient.human.painScore - 5)
  if (effects.has('relieve-bladder'))
    patient.human.painScore = Math.max(0, patient.human.painScore - 2)
  if (effects.has('reorient'))
    patient.human.deliriumScore = Math.max(1, patient.human.deliriumScore - 3)
  if (effects.has('reduce-noise'))
    patient.human.deliriumScore = Math.max(0, patient.human.deliriumScore - 1)

  if (settings.trcEnabled) {
    patient.mechanics.tubeResistanceCmH2OPerLps *= 1 - settings.trcPercent / 125
  }

  if (definition.phenotype === 'ards-recruitment') {
    if (settings.peepCmH2O >= 8 && settings.peepCmH2O <= 12) {
      patient.mechanics.complianceLPerCmH2O = 0.032
      patient.gasExchange.shuntFraction = 0.2
    } else if (settings.peepCmH2O >= 14) {
      patient.mechanics.complianceLPerCmH2O = 0.018
      patient.gasExchange.shuntFraction = 0.24
    }
  }
  if (definition.phenotype === 'rise-time-mismatch' && settings.mode === 'pressure-support') {
    patient.human.dyspneaScore = settings.pRampMs > 120 ? 8 : settings.pRampMs < 30 ? 6 : 3
  }
  if (definition.phenotype === 'over-assistance' && settings.mode === 'pressure-support') {
    if (settings.pressureSupportCmH2O >= 18) patient.drive.neuralRatePerMin = 8
    if (settings.pressureSupportCmH2O >= 18) patient.drive.effortAmplitudeCmH2O *= 0.25
  }
  return patient
}

export function deriveMeasurements(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
  patient = deriveEffectivePatient(state, definition),
): VentilatorMeasurements {
  const settings = state.ventilator.settings
  const mechanicalTi = deriveMechanicalInspiratoryTime(settings, patient)
  const rate = deriveEffectiveVentilationRate(settings, patient, definition.predictedBodyWeightKg)
  const compliance = Math.max(0.005, patient.mechanics.complianceLPerCmH2O)
  const resistance =
    patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps
  const baselinePressure = effectiveBaselinePressureCmH2O(settings)
  const pressureAboveBaseline = effectivePressureAboveBaselineCmH2O(
    settings,
    patient,
    definition.predictedBodyWeightKg,
  )
  const pressureTargeted = usesPressureTargetedDelivery(settings)
  let vtMl: number
  let peakFlowLMin: number
  if (settings.mode === 'volume-ac' && !pressureTargeted) {
    vtMl = settings.vtMl * (1 - patient.mechanics.airwayLeakFraction)
    peakFlowLMin = settings.peakFlowLMin
  } else if (
    isAdaptivePressureMode(settings.deviceMode) ||
    settings.deviceMode === 'volume-support' ||
    isAdaptiveSupportMode(settings.deviceMode) ||
    (settings.advanced.autoFlowEnabled && settings.mode === 'volume-ac')
  ) {
    const targetVtMl = targetTidalVolumeMl(settings, patient, definition.predictedBodyWeightKg)
    const effortContribution =
      settings.deviceMode === 'volume-support' || isAdaptiveSupportMode(settings.deviceMode)
        ? patient.drive.effortAmplitudeCmH2O * 0.35
        : 0
    const achievableVtMl = (pressureAboveBaseline + effortContribution) * compliance * 1000
    vtMl = Math.min(targetVtMl, achievableVtMl) * (1 - patient.mechanics.airwayLeakFraction)
    peakFlowLMin = clamp((pressureAboveBaseline / resistance) * 60, 10, 180)
  } else if (settings.mode === 'pressure-ac') {
    vtMl = clamp(pressureAboveBaseline * compliance * 1000, 100, 1200)
    peakFlowLMin = clamp((pressureAboveBaseline / resistance) * 60, 10, 180)
  } else {
    const unloadingPressure = pressureAboveBaseline + patient.drive.effortAmplitudeCmH2O * 0.35
    vtMl = clamp(unloadingPressure * compliance * 1000, 100, 1400)
    peakFlowLMin = clamp((unloadingPressure / resistance) * 60, 10, 180)
  }

  if (isSimvMode(settings.deviceMode) && settings.mode !== 'pressure-support') {
    const spontaneousFraction = clamp((rate - settings.ratePerMin) / Math.max(1, rate), 0, 0.75)
    const spontaneousPressure =
      settings.advanced.spontaneousPressureSupportCmH2O + patient.drive.effortAmplitudeCmH2O * 0.35
    const spontaneousVtMl = clamp(spontaneousPressure * compliance * 1000, 100, 1400)
    vtMl = vtMl * (1 - spontaneousFraction) + spontaneousVtMl * spontaneousFraction
    peakFlowLMin = Math.max(peakFlowLMin, clamp((spontaneousPressure / resistance) * 60, 10, 180))
  }

  /*
   * Everything above predicts what the settings should produce. Once the buffer holds a complete
   * breath, the trace has actually produced it, so that is what the ventilator reports — leak
   * subtracted, because a flow sensor never sees the gas that escaped.
   */
  const observedVt = observedTidalVolumeMl(state.waveforms)
  if (observedVt !== undefined) {
    vtMl = observedVt * (1 - patient.mechanics.airwayLeakFraction)
  }

  // Dynamic PEEPi is recomputed from the case baseline and the current expiratory
  // time on every fixed step. Feeding the prior derived value back into this
  // calculation would falsely compound trapped pressure at 50 Hz.
  let intrinsicPeep = definition.initialPatient.mechanics.intrinsicPeepCmH2O
  if (definition.phenotype === 'copd-ineffective-efforts' && settings.mode === 'pressure-support') {
    const initialSettings = definition.initialSettings
    if (initialSettings.mode === 'pressure-support') {
      intrinsicPeep -=
        Math.max(0, initialSettings.pressureSupportCmH2O - settings.pressureSupportCmH2O) * 0.6
      intrinsicPeep -= Math.max(0, settings.etsPercent - initialSettings.etsPercent) * 0.15
      intrinsicPeep = Math.max(0, intrinsicPeep)
    }
  }
  const cycleTime = isTwoLevelMode(settings.deviceMode)
    ? settings.advanced.tHighSeconds + settings.advanced.tLowSeconds
    : 60 / Math.max(1, rate)
  /*
   * The cycle the lung is actually living in, not the one the patient is asking for. `rate` above
   * is `deriveEffectiveVentilationRate`, which in pressure support is the *neural* rate — so a
   * patient breathing at 28 against a machine cycling at 8 was credited with 0.64 s of expiratory
   * time when the trace gives it six full seconds. Preferred order: the trace, then the rate the
   * machine last reported, then the effective rate at cold start.
   */
  const cycledRate =
    state.measurements.totalRatePerMin > 0 ? state.measurements.totalRatePerMin : rate
  const expiratoryTime = isTwoLevelMode(settings.deviceMode)
    ? settings.advanced.tLowSeconds
    : Math.max(
        0.08,
        observedExpiratoryTimeSeconds(state.waveforms) ??
          60 / Math.max(1, cycledRate) - mechanicalTi,
      )
  const timeConstant = resistance * compliance
  if (timeConstant > expiratoryTime) {
    intrinsicPeep += clamp((timeConstant - expiratoryTime) * 7, 0, 24)
  }
  if (definition.phenotype === 'copd-ineffective-efforts' && settings.mode === 'pressure-support') {
    intrinsicPeep += Math.max(0, (settings.pressureSupportCmH2O - 12) * 0.45)
    intrinsicPeep += Math.max(0, (35 - settings.etsPercent) * 0.08)
  }
  if (definition.phenotype === 'asthma-obstructive-shock' && settings.mode === 'volume-ac') {
    intrinsicPeep += Math.max(0, (settings.ratePerMin - 12) * 0.8)
    intrinsicPeep += Math.max(0, (80 - settings.peakFlowLMin) * 0.05)
  }
  if (definition.phenotype === 'delayed-cycling' && settings.mode === 'pressure-support') {
    intrinsicPeep += Math.max(0, (40 - settings.etsPercent) * 0.12)
  }
  if (hasPerformedEffect(state, definition, 'disconnect-bag')) intrinsicPeep *= 0.35

  /*
   * Everything above is the case's own model of how much gas gets trapped. The trace has its own
   * answer — whatever it failed to exhale — and on some cases the trace traps where the model does
   * not: a double trigger stacks its second inflation onto an incompletely emptied lung, which is
   * auto-PEEP by any definition and the model above never predicted it. Report whichever is larger,
   * so the number covers both mechanisms, and it is the number an expiratory hold then reads.
   */
  const observedEndExpiratoryMl = observedEndExpiratoryVolumeMl(state.waveforms)
  if (observedEndExpiratoryMl !== undefined) {
    intrinsicPeep = Math.max(intrinsicPeep, observedEndExpiratoryMl / 1000 / compliance)
  }

  const relaxedPlateau = baselinePressure + intrinsicPeep + vtMl / 1000 / compliance
  const riseTimeMs =
    settings.mode === 'pressure-ac'
      ? settings.pRampMs
      : settings.mode === 'pressure-support'
        ? settings.pRampMs
        : 70
  const pressureOvershoot =
    pressureTargeted && riseTimeMs < 30 ? clamp((30 - riseTimeMs) / 5, 0, 6) : 0
  const relaxedPeak = !pressureTargeted
    ? relaxedPlateau + resistance * (peakFlowLMin / 60)
    : baselinePressure + pressureAboveBaseline + pressureOvershoot

  /*
   * What the ventilator would actually be reporting.
   *
   * The two above are the mechanics of the respiratory system: what these pressures would be if
   * the patient were relaxed. The manometer is not measuring the respiratory system, it is
   * measuring the airway — so a patient pulling against the breath lowers every displayed
   * pressure without the lung having changed. The console used to print the relaxed values over a
   * trace drawn with effort in it, so it reported a peak the trace never reached.
   *
   * Peak comes straight off the trace, so the number and the drawing cannot disagree. Plateau is
   * the relaxed value less the effort present when it would be read — and is flagged
   * uninterpretable whenever that effort exists, because then it is not an elastic pressure.
   */
  const observedPeak = observedPeakAirwayPressureCmH2O(state.waveforms)
  const peak = observedPeak ?? relaxedPeak

  /*
   * While an inspiratory hold is running the plateau is not estimated at all — it is read off the
   * occluded trace, exactly as the device reads its manometer. Outside a hold it is estimated from
   * the trace at end-inspiration, which is what an instantaneous occlusion would have shown; the
   * relaxed value less the effort is only the cold-start fallback now, because computing it from
   * the settings put the plateau above the peak on every case whose pressure trace is capped.
   */
  const holdRunning =
    state.ventilator.holdUntil !== null && state.ventilator.holdUntil > state.simulationTime
  const occluded =
    holdRunning && state.ventilator.holdType === 'inspiratory' ? state.waveforms.at(-1) : undefined
  const endInspiratoryEffort = occluded
    ? Math.max(0, -occluded.pmusCmH2O)
    : endInspiratoryEffortCmH2O(state.waveforms)
  const plateau =
    occluded?.pawCmH2O ??
    observedPlateauPressureCmH2O(state.waveforms, resistance) ??
    Math.max(baselinePressure, relaxedPlateau - endInspiratoryEffort)

  let ineffectiveFraction = 0
  let autotriggerFraction = 0
  let triggerDelayMs = 80
  if (definition.phenotype === 'weak-trigger' && settings.trigger.type === 'flow') {
    ineffectiveFraction = clamp((settings.trigger.thresholdLMin - 1.5) / 4, 0, 0.65)
    autotriggerFraction = clamp((0.7 - settings.trigger.thresholdLMin) / 0.7, 0, 0.55)
    triggerDelayMs = 80 + ineffectiveFraction * 400
  }
  if (definition.phenotype === 'copd-ineffective-efforts') {
    ineffectiveFraction = clamp(
      intrinsicPeep / 22 +
        (settings.trigger.type === 'flow' ? settings.trigger.thresholdLMin / 20 : 0),
      0,
      0.7,
    )
    triggerDelayMs = 100 + ineffectiveFraction * 450
  }
  if (definition.phenotype === 'autotriggering') {
    // The same amplitude the oscillation is drawn at, so what the trace shows and what the machine
    // does off it come from one number.
    const triggerSensitive =
      settings.trigger.type === 'flow' &&
      settings.trigger.thresholdLMin < CARDIOGENIC_OSCILLATION_AMPLITUDE_LMIN
    autotriggerFraction = branchCorrected(state, definition) || !triggerSensitive ? 0.04 : 0.68
  }
  if (settings.advanced.intelliSyncEnabled) {
    ineffectiveFraction *= 0.25
    autotriggerFraction *= 0.25
    triggerDelayMs = Math.min(triggerDelayMs, 55)
  }

  let stackedVolumeMl = 0
  if (definition.phenotype === 'double-triggering') {
    const mismatch = patient.drive.neuralInspiratoryTimeSeconds - mechanicalTi
    stackedVolumeMl = mismatch > 0.15 ? vtMl * 1.85 : vtMl
  }
  if (definition.phenotype === 'reverse-triggering') {
    const rateChanged = settings.mode === 'pressure-ac' && Math.abs(settings.ratePerMin - 18) >= 3
    const variabilityRestored = hasPerformedEffect(state, definition, 'reduce-sedation')
    stackedVolumeMl = rateChanged || variabilityRestored ? vtMl : vtMl * 1.55
  }

  const expFlowNext = -Math.max(0, (intrinsicPeep * compliance) / Math.max(0.08, timeConstant)) * 60
  const observedRate =
    definition.phenotype === 'autotriggering' && autotriggerFraction > 0.2
      ? Math.max(28, rate)
      : rate * (1 - ineffectiveFraction)
  return {
    peakPressureCmH2O: round(peak),
    plateauPressureCmH2O: round(plateau),
    meanAirwayPressureCmH2O: round(
      baselinePressure + ((peak - baselinePressure) * mechanicalTi) / Math.max(0.1, cycleTime),
    ),
    relaxedPeakPressureCmH2O: round(relaxedPeak),
    relaxedPlateauPressureCmH2O: round(relaxedPlateau),
    endInspiratoryEffortCmH2O: round(endInspiratoryEffort),
    plateauIsInterpretable: endInspiratoryEffort < EFFORT_DETECTION_FLOOR_CMH2O,
    exhaledVtMl: round(vtMl, 0),
    minuteVentilationLMin: round((vtMl / 1000) * observedRate),
    totalRatePerMin: round(observedRate, 0),
    observedPatientRatePerMin: round(patient.drive.neuralRatePerMin, 0),
    staticComplianceMlCmH2O: round(compliance * 1000, 0),
    intrinsicPeepCmH2O: round(intrinsicPeep),
    expiratoryFlowAtNextBreathLMin: round(expFlowNext),
    triggerDelayMs: round(triggerDelayMs, 0),
    mechanicalInspiratoryTimeSeconds: round(mechanicalTi, 2),
    stackedVolumeMl: round(stackedVolumeMl, 0),
    ineffectiveEffortFraction: round(ineffectiveFraction, 2),
    autotriggerFraction: round(autotriggerFraction, 2),
    pressureOvershootCmH2O: round(pressureOvershoot),
  }
}

export function isCaseResolved(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): boolean {
  const settings = state.ventilator.settings
  const m = state.measurements
  const effects = performedEffectIds(state, definition)
  // Case criteria read the relaxed pressures throughout: they are claims about the lung, and the
  // displayed plateau can be pulled down by a patient who is simply working hard.
  switch (definition.phenotype) {
    case 'ards-recruitment':
      return (
        settings.peepCmH2O >= 8 && settings.peepCmH2O <= 12 && m.relaxedPlateauPressureCmH2O <= 30
      )
    case 'flow-starvation':
      return (
        settings.mode !== 'volume-ac' ||
        settings.peakFlowLMin >= 60 ||
        settings.flowPattern !== 'square'
      )
    case 'double-triggering':
      return m.mechanicalInspiratoryTimeSeconds >= 0.7 && m.stackedVolumeMl <= m.exhaledVtMl * 1.2
    case 'reverse-triggering':
      return (
        (settings.mode === 'pressure-ac' && Math.abs(settings.ratePerMin - 18) >= 3) ||
        effects.has('reduce-sedation')
      )
    case 'copd-ineffective-efforts':
      return m.intrinsicPeepCmH2O <= 7 && m.ineffectiveEffortFraction <= 0.15
    case 'asthma-obstructive-shock':
      return (
        settings.mode === 'volume-ac' &&
        settings.ratePerMin <= 12 &&
        settings.peakFlowLMin >= 80 &&
        effects.has('disconnect-bag') &&
        effects.has('bronchodilator')
      )
    case 'weak-trigger':
      return m.ineffectiveEffortFraction <= 0.15 && m.autotriggerFraction <= 0.1
    case 'autotriggering':
      return branchCorrected(state, definition) && m.autotriggerFraction <= 0.1
    case 'premature-cycling':
      return (
        settings.mode === 'pressure-support' &&
        settings.etsPercent >= 15 &&
        settings.etsPercent <= 25
      )
    case 'delayed-cycling':
      return (
        settings.mode === 'pressure-support' &&
        settings.etsPercent >= 40 &&
        settings.etsPercent <= 60 &&
        settings.pressureSupportCmH2O <= 14
      )
    case 'rise-time-mismatch':
      return (
        settings.mode === 'pressure-support' && settings.pRampMs >= 70 && settings.pRampMs <= 120
      )
    case 'over-assistance':
      return (
        settings.mode === 'pressure-support' &&
        settings.pressureSupportCmH2O >= 10 &&
        settings.pressureSupportCmH2O <= 12
      )
    case 'high-resistance':
      return (
        branchCorrected(state, definition) &&
        m.relaxedPeakPressureCmH2O - m.relaxedPlateauPressureCmH2O <= 15
      )
    case 'tension-pneumothorax':
      return effects.has('decompress-pneumothorax') && !state.patient.airway.pneumothorax
    case 'dyspnea-human-factors':
      return (
        settings.mode === 'pressure-support' &&
        settings.pressureSupportCmH2O >= 11 &&
        settings.pressureSupportCmH2O <= 12 &&
        settings.pRampMs >= 70 &&
        settings.pRampMs <= 120 &&
        effects.has('communication-board') &&
        effects.has('treat-pain') &&
        effects.has('relieve-bladder')
      )
  }
}

export function resolveMetric(state: VentilationSimulationState, metric: MetricKey): number {
  const path = metric.split('.')
  let value: unknown = state
  for (const segment of path) {
    if (!value || typeof value !== 'object') return Number.NaN
    value = (value as Record<string, unknown>)[segment]
  }
  return typeof value === 'number' ? value : Number.NaN
}

export function conditionMatches(
  state: VentilationSimulationState,
  condition: MetricCondition,
): boolean {
  const actual = resolveMetric(state, condition.metric)
  if (!Number.isFinite(actual)) return false
  if (condition.comparator === 'between') {
    if (!Array.isArray(condition.value)) return false
    return actual >= condition.value[0] && actual <= condition.value[1]
  }
  if (typeof condition.value !== 'number') return false
  if (condition.comparator === 'lt') return actual < condition.value
  if (condition.comparator === 'lte') return actual <= condition.value
  if (condition.comparator === 'gt') return actual > condition.value
  return actual >= condition.value
}
