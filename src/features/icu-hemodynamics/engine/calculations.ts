import type {
  DerivedHemodynamics,
  DerivedHemodynamicsInput,
  DerivedSignalFault,
  FluidResponsivenessContext,
  HemodynamicMeasurements,
  InterpretationValue,
  MeasurementSystemState,
  PressureArtifact,
  ValidityResult,
} from './types'
import { arterialMeasurementSystem } from './measurementLines'
import { isOverdamped, isUnderdamped } from './waveformArtifacts'
import { HEMODYNAMIC_CLINICAL_THRESHOLDS } from '../content/clinicalThresholds'
import {
  requireDerivedInputDefinition,
  requireDerivedMetric,
  type DerivedMetricId,
} from '../content/derivedMetrics'
import { artifactDefinitions } from '../content/troubleshootingAtlas'

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function unavailable(unit: string, reason: string): InterpretationValue {
  return { value: null, unit, status: 'not-interpretable', reason }
}

function available(value: number, unit: string, digits = 1): InterpretationValue {
  return { value: roundTo(value, digits), unit, status: 'interpretable' }
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function checkPpvValidity(context?: FluidResponsivenessContext): ValidityResult {
  if (!context) {
    return { valid: false, reasons: ['Ventilation and rhythm context are required.'] }
  }

  const reasons: string[] = []
  if (!context.controlledMechanicalVentilation)
    reasons.push('Patient is not fully mechanically ventilated.')
  if (!context.regularRhythm) reasons.push('Irregular rhythm changes beat-to-beat pulse pressure.')
  if (!context.noSpontaneousEffort) reasons.push('Spontaneous respiratory effort is present.')
  if (
    context.tidalVolumeMlKg <
    HEMODYNAMIC_CLINICAL_THRESHOLDS.pulsePressureVariation.traditionalTidalVolumeMlKg
  )
    reasons.push('Tidal volume is below the traditional validation range.')
  if (!context.closedChest) reasons.push('Open-chest physiology invalidates the usual threshold.')
  if (!context.validArterialWaveform)
    reasons.push('The arterial waveform is not technically valid.')
  if (context.rightVentricularFailure)
    reasons.push('Right-ventricular failure can create a false-positive variation.')
  if (context.intraAbdominalPressureElevated)
    reasons.push('Elevated intra-abdominal pressure alters test performance.')
  return { valid: reasons.length === 0, reasons }
}

export function checkPassiveLegRaiseValidity(options: {
  canChangePosition: boolean
  abdominalCompartmentSyndrome: boolean
  intracranialPressureConcern: boolean
  realTimeStrokeVolumeAvailable: boolean
}): ValidityResult {
  const reasons: string[] = []
  if (!options.canChangePosition) reasons.push('Position cannot be changed safely or reproducibly.')
  if (options.abdominalCompartmentSyndrome)
    reasons.push('Abdominal hypertension can blunt venous transfer.')
  if (options.intracranialPressureConcern)
    reasons.push('Position change may be inappropriate with intracranial pressure concern.')
  if (!options.realTimeStrokeVolumeAvailable)
    reasons.push('A real-time flow or stroke-volume endpoint is required.')
  return { valid: reasons.length === 0, reasons }
}

export function checkFluidResponsivenessValidity(
  method: 'ppv' | 'passive-leg-raise',
  context: FluidResponsivenessContext,
): ValidityResult {
  if (method === 'ppv') return checkPpvValidity(context)
  return checkPassiveLegRaiseValidity({
    canChangePosition: true,
    abdominalCompartmentSyndrome: context.intraAbdominalPressureElevated,
    intracranialPressureConcern: false,
    realTimeStrokeVolumeAvailable: true,
  })
}

/** The canonical calculation for one metric, applied to already-validated inputs. */
function calc(metricId: DerivedMetricId, inputs: Readonly<Record<string, number>>): number {
  return requireDerivedMetric(metricId).calculate(inputs)
}

/* ------------------------------------------------------------------ *
 * Signal faults: which fault reaches which measurement
 * ------------------------------------------------------------------ */

const PAWP_INPUT_ID = 'pawpMeanMmHg'
const PA_SYSTOLIC_DIASTOLIC_INPUT_IDS = ['papSystolicMmHg', 'papDiastolicMmHg']
const ARTERIAL_PULSE_INPUT_IDS = ['pulsePressureMaxMmHg', 'pulsePressureMinMmHg']
const CATHETER_TIP_INPUT_IDS = ['meanPapMmHg', ...PA_SYSTOLIC_DIASTOLIC_INPUT_IDS, PAWP_INPUT_ID]
/** Everything read against the zero. A pulse pressure is a difference on one line, so it is not. */
const ABSOLUTE_PRESSURE_INPUT_IDS = ['mapMmHg', 'rapMmHg', ...CATHETER_TIP_INPUT_IDS]

function dynamicResponseFault(
  line: 'PA' | 'arterial',
  system: MeasurementSystemState,
  inputIds: readonly string[],
): DerivedSignalFault | null {
  const response = isOverdamped(system)
    ? 'overdamped'
    : isUnderdamped(system)
      ? 'underdamped'
      : null
  if (response === null) return null
  return {
    id: `${line.toLowerCase()}-${response}`,
    label: `${line} line ${response}`,
    reason: `The ${line} line is ${response}. ${artifactDefinitions[response].numbersTeaching}`,
    inputIds,
  }
}

function catheterArtifactFault(artifact: PressureArtifact): DerivedSignalFault | null {
  switch (artifact) {
    case 'catheter-whip':
      return {
        id: artifact,
        label: 'catheter whip',
        reason: `Catheter whip is on the PA tracing. ${artifactDefinitions[artifact].numbersTeaching}`,
        inputIds: CATHETER_TIP_INPUT_IDS,
      }
    case 'wall-contact':
      return {
        id: artifact,
        label: 'catheter tip against the wall',
        reason: `The catheter tip is against the wall. ${artifactDefinitions[artifact].numbersTeaching}`,
        inputIds: CATHETER_TIP_INPUT_IDS,
      }
    case 'false-wedge':
      return {
        id: artifact,
        label: 'false wedge',
        reason: `The wedge tracing is a false wedge. ${artifactDefinitions[artifact].numbersTeaching}`,
        inputIds: [PAWP_INPUT_ID],
      }
    default:
      return null
  }
}

/**
 * What is wrong with the pressure signal now, and which measurements each fault reaches.
 *
 * Each fault is mapped to the channels the simulator actually distorts, so a fault takes down only
 * the results built on those channels. A zero or level error moves every absolute pressure and
 * leaves pulse pressure unchanged. A poor dynamic response distorts systolic, diastolic and pulse
 * pressure on its own line, and the mean is the least affected, so results built on means survive
 * it. Whip and wall contact belong to the catheter tip: they never reach the arterial line or the
 * right atrial port. A false wedge is a bad PAWP and nothing else.
 */
export function pressureSignalFaults(
  system: MeasurementSystemState,
): readonly DerivedSignalFault[] {
  const levelCm = system.transducerLevelCm
  const offLevel =
    Math.abs(levelCm) > HEMODYNAMIC_CLINICAL_THRESHOLDS.signalValidation.transducerLevelToleranceCm
  const faults: readonly (DerivedSignalFault | null)[] = [
    system.zeroed
      ? null
      : {
          id: 'not-zeroed',
          label: 'transducer not zeroed',
          reason:
            'The transducer has not been zeroed, so every absolute pressure sits on an unverified baseline. Pulse pressure is unchanged.',
          inputIds: ABSOLUTE_PRESSURE_INPUT_IDS,
        },
    offLevel
      ? {
          id: 'off-level',
          label: 'transducer off level',
          reason: `The transducer is ${Math.abs(levelCm).toFixed(0)} cm ${levelCm > 0 ? 'above' : 'below'} the phlebostatic axis, so every absolute pressure carries a hydrostatic error. Pulse pressure is unchanged.`,
          inputIds: ABSOLUTE_PRESSURE_INPUT_IDS,
        }
      : null,
    dynamicResponseFault('PA', system, PA_SYSTOLIC_DIASTOLIC_INPUT_IDS),
    dynamicResponseFault('arterial', arterialMeasurementSystem(system), ARTERIAL_PULSE_INPUT_IDS),
    catheterArtifactFault(system.artifact),
  ]
  return faults.filter((fault): fault is DerivedSignalFault => fault !== null)
}

/** The faults a wedge read off this system now would carry for as long as it stays stored. */
export function wedgeReadingFaults(system: MeasurementSystemState): readonly DerivedSignalFault[] {
  return pressureSignalFaults(system).filter((fault) => fault.inputIds.includes(PAWP_INPUT_ID))
}

/**
 * The faults that apply when the wedge in use is a stored value rather than the live trace.
 *
 * A stored wedge answers to the signal it was read from. Repairing the line afterwards does not
 * change the number, and a fault that appears afterwards does not reach it.
 */
export function faultsWithStoredWedge(
  liveFaults: readonly DerivedSignalFault[],
  storedFaults: readonly DerivedSignalFault[],
): readonly DerivedSignalFault[] {
  const live = liveFaults
    .map((fault) => ({
      ...fault,
      inputIds: fault.inputIds.filter((inputId) => inputId !== PAWP_INPUT_ID),
    }))
    .filter((fault) => fault.inputIds.length > 0)
  const stored = storedFaults.map((fault) => ({
    id: `stored-${fault.id}`,
    label: `wedge stored with ${fault.label}`,
    reason: `The stored wedge was read with ${fault.label}. Repairing the line afterwards does not change a stored value, so read a new wedge.`,
    inputIds: [PAWP_INPUT_ID],
  }))
  return [...live, ...stored]
}

/** Every measurement a metric needs, reached through any calculated input it is built on. */
function requiredInputIds(metricId: DerivedMetricId): readonly string[] {
  return requireDerivedMetric(metricId).dependencies.flatMap(({ inputId }) =>
    inputId === 'strokeVolumeMl' ? requiredInputIds(inputId) : [inputId],
  )
}

/**
 * The one gate between a calculation and the word "interpretable".
 *
 * Each result answers to its own dependency list and no other, so there is no global switch to
 * forget and no metric that can skip the check. Reasons are collected: a result with an unreliable
 * input and a missing one says both.
 */
function withholdFaultedResults(
  results: DerivedHemodynamics,
  faults: readonly DerivedSignalFault[],
): DerivedHemodynamics {
  const gated = { ...results }
  for (const metricId of Object.keys(results) as DerivedMetricId[]) {
    const required = requiredInputIds(metricId)
    const reasons = faults.flatMap((fault) => {
      const reached = fault.inputIds.filter((inputId) => required.includes(inputId))
      if (reached.length === 0) return []
      const labels = reached.map((inputId) => requireDerivedInputDefinition(inputId).label)
      return [`Unreliable input: ${labels.join(', ')} (${fault.label}).`]
    })
    if (reasons.length === 0) continue
    const result = results[metricId]
    gated[metricId] = unavailable(
      result.unit,
      [...reasons, ...(result.reason ? [result.reason] : [])].join(' '),
    )
  }
  return gated
}

export function calculateDerivedHemodynamics(input: DerivedHemodynamicsInput): DerivedHemodynamics {
  const measurements = input.measurements
  const hr = measurements.heartRateBpm
  const co = measurements.cardiacOutputLMin
  const map = measurements.mapMmHg
  const rap = measurements.rapMmHg
  const meanPap = measurements.meanPapMmHg
  const pawp = measurements.pawpMmHg
  const pasp = measurements.papSystolicMmHg
  const padp = measurements.papDiastolicMmHg
  const bsa = input.bodySurfaceAreaM2

  const cardiacIndexLMinM2 =
    finitePositive(co) && finitePositive(bsa)
      ? available(
          calc('cardiacIndexLMinM2', { cardiacOutputLMin: co, bodySurfaceAreaM2: bsa }),
          'L/min/m²',
          1,
        )
      : unavailable(
          'L/min/m²',
          'A current positive cardiac output and valid body-surface area are required.',
        )
  const flowReason = 'A current positive cardiac output and heart rate are required.'
  const sv =
    finitePositive(co) && finitePositive(hr)
      ? calc('strokeVolumeMl', { cardiacOutputLMin: co, heartRateBpm: hr })
      : null
  const strokeVolumeMl = sv === null ? unavailable('mL', flowReason) : available(sv, 'mL', 0)
  const strokeVolumeIndexMlM2 =
    sv === null || !finitePositive(bsa)
      ? unavailable('mL/m²', 'Stroke volume and a valid body-surface area are required.')
      : available(
          calc('strokeVolumeIndexMlM2', { strokeVolumeMl: sv, bodySurfaceAreaM2: bsa }),
          'mL/m²',
          0,
        )

  /**
   * A gradient at or below zero is not treated as a missing input: the two pressures disagree, and
   * the reason says so instead of implying a value was absent. Nothing is clamped.
   */
  const svrDiscordant = finitePositive(co) && finite(map) && finite(rap) && map <= rap
  const svr =
    finitePositive(co) && finite(map) && finite(rap) && map > rap
      ? calc('systemicVascularResistance', { mapMmHg: map, rapMmHg: rap, cardiacOutputLMin: co })
      : null
  const systemicVascularResistance =
    svr === null
      ? unavailable(
          'dyn·s·cm⁻⁵',
          svrDiscordant
            ? `MAP (${map} mmHg) does not exceed RAP (${rap} mmHg). The gradient is zero or negative — a measurement conflict to reconcile, not a resistance to report.`
            : 'Current MAP, RAP, and positive cardiac output are required.',
        )
      : available(svr, 'dyn·s·cm⁻⁵', 0)
  const systemicVascularResistanceIndex =
    svr === null || !finitePositive(bsa)
      ? unavailable(
          'dyn·s·cm⁻⁵·m²',
          svrDiscordant
            ? 'SVR is withheld for a discordant MAP − RAP gradient, so its index is withheld with it.'
            : 'SVR and a valid body-surface area are required.',
        )
      : available(svr * bsa, 'dyn·s·cm⁻⁵·m²', 0)

  const pvrDiscordant = finitePositive(co) && finite(meanPap) && finite(pawp) && meanPap <= pawp
  const pvr =
    finitePositive(co) && finite(meanPap) && finite(pawp) && meanPap > pawp
      ? calc('pulmonaryVascularResistance', {
          meanPapMmHg: meanPap,
          pawpMeanMmHg: pawp,
          cardiacOutputLMin: co,
        })
      : null
  const pulmonaryVascularResistance =
    pvr === null
      ? unavailable(
          'WU',
          pvrDiscordant
            ? `Mean PAP (${meanPap} mmHg) does not exceed PAWP (${pawp} mmHg). The transpulmonary gradient is zero or negative — evidence the two measurements disagree, preserved rather than clamped.`
            : 'A valid PAWP, mean PAP, and positive cardiac output are required.',
        )
      : available(pvr, 'WU', 1)
  const pulmonaryVascularResistanceIndex =
    pvr === null || !finitePositive(bsa)
      ? unavailable(
          'WU·m²',
          pvrDiscordant
            ? 'PVR is withheld for a discordant mPAP − PAWP gradient, so its index is withheld with it.'
            : 'PVR and a valid body-surface area are required.',
        )
      : available(pvr * bsa, 'WU·m²', 1)

  const cardiacPowerOutputW =
    finitePositive(co) && finitePositive(map)
      ? available(calc('cardiacPowerOutputW', { mapMmHg: map, cardiacOutputLMin: co }), 'W', 2)
      : unavailable('W', 'Current MAP and positive cardiac output are required.')

  const papPulse = finite(pasp) && finite(padp) ? pasp - padp : null
  const papiDenominatorProblem = papPulse !== null && papPulse > 0 && finite(rap) && rap <= 0
  const pulmonaryArteryPulsatilityIndex =
    papPulse !== null && papPulse > 0 && finitePositive(rap)
      ? available(
          calc('pulmonaryArteryPulsatilityIndex', {
            papSystolicMmHg: pasp as number,
            papDiastolicMmHg: padp as number,
            rapMmHg: rap,
          }),
          '',
          2,
        )
      : unavailable(
          '',
          papiDenominatorProblem
            ? `RAP is ${rap} mmHg. The PAPi denominator is zero or negative, so the ratio is undefined rather than extreme — no number is shown.`
            : 'Valid systolic/diastolic PAP and positive RAP are required.',
        )
  const pulmonaryArteryCompliance =
    sv !== null && papPulse !== null && papPulse > 0
      ? available(
          calc('pulmonaryArteryCompliance', {
            strokeVolumeMl: sv,
            papSystolicMmHg: pasp as number,
            papDiastolicMmHg: padp as number,
          }),
          'mL/mmHg',
          1,
        )
      : unavailable('mL/mmHg', 'Stroke volume and a valid PA pulse pressure are required.')

  const ppvValidity = checkPpvValidity(input.ppvContext)
  const ppMax = measurements.pulsePressureMaxMmHg
  const ppMin = measurements.pulsePressureMinMmHg
  const pulsePressureVariationPercent =
    !ppvValidity.valid || !finitePositive(ppMax) || !finitePositive(ppMin)
      ? unavailable(
          '%',
          ppvValidity.reasons.length > 0
            ? ppvValidity.reasons.join(' ')
            : 'Valid maximum and minimum pulse pressures are required.',
        )
      : available(
          calc('pulsePressureVariationPercent', {
            pulsePressureMaxMmHg: ppMax,
            pulsePressureMinMmHg: ppMin,
          }),
          '%',
          0,
        )

  return withholdFaultedResults(
    {
      cardiacIndexLMinM2,
      strokeVolumeMl,
      strokeVolumeIndexMlM2,
      systemicVascularResistance,
      systemicVascularResistanceIndex,
      pulmonaryVascularResistance,
      pulmonaryVascularResistanceIndex,
      cardiacPowerOutputW,
      pulmonaryArteryPulsatilityIndex,
      pulmonaryArteryCompliance,
      pulsePressureVariationPercent,
    },
    input.signalFaults ?? [],
  )
}

export function measurementMeetsCriterion(
  measurements: HemodynamicMeasurements,
  criterion: {
    metric: keyof HemodynamicMeasurements
    operator: 'at-least' | 'at-most'
    value: number
  },
): boolean {
  const current = measurements[criterion.metric]
  if (typeof current !== 'number' || !Number.isFinite(current)) return false
  return criterion.operator === 'at-least' ? current >= criterion.value : current <= criterion.value
}
