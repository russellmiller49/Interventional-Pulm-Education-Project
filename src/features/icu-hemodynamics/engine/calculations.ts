import type {
  DerivedHemodynamics,
  DerivedHemodynamicsInput,
  FluidResponsivenessContext,
  HemodynamicMeasurements,
  InterpretationValue,
  ValidityResult,
} from './types'

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
  if (context.tidalVolumeMlKg < 8)
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

export function calculateDerivedHemodynamics(input: DerivedHemodynamicsInput): DerivedHemodynamics {
  const measurements = input.measurements
  const staleReason = input.inputsStale ? 'One or more source measurements are stale.' : null
  const hr = measurements.heartRateBpm
  const co = measurements.cardiacOutputLMin
  const map = measurements.mapMmHg
  const rap = measurements.rapMmHg
  const meanPap = measurements.meanPapMmHg
  const pawp = measurements.pawpMmHg
  const pasp = measurements.papSystolicMmHg
  const padp = measurements.papDiastolicMmHg
  const bsa = input.bodySurfaceAreaM2

  const flowReason = staleReason ?? 'A current positive cardiac output and heart rate are required.'
  const sv = finitePositive(co) && finitePositive(hr) ? (co * 1000) / hr : null
  const strokeVolumeMl = sv === null ? unavailable('mL', flowReason) : available(sv, 'mL', 0)
  const strokeVolumeIndexMlM2 =
    sv === null || !finitePositive(bsa)
      ? unavailable(
          'mL/m²',
          staleReason ?? 'Stroke volume and a valid body-surface area are required.',
        )
      : available(sv / bsa, 'mL/m²', 0)

  const svr =
    finitePositive(co) && finite(map) && finite(rap) && map > rap ? (80 * (map - rap)) / co : null
  const systemicVascularResistance =
    svr === null
      ? unavailable(
          'dyn·s·cm⁻⁵',
          staleReason ?? 'Current MAP, RAP, and positive cardiac output are required.',
        )
      : available(svr, 'dyn·s·cm⁻⁵', 0)
  const systemicVascularResistanceIndex =
    svr === null || !finitePositive(bsa)
      ? unavailable(
          'dyn·s·cm⁻⁵·m²',
          staleReason ?? 'SVR and a valid body-surface area are required.',
        )
      : available(svr * bsa, 'dyn·s·cm⁻⁵·m²', 0)

  const pvr =
    finitePositive(co) && finite(meanPap) && finite(pawp) && meanPap > pawp
      ? (meanPap - pawp) / co
      : null
  const pulmonaryVascularResistance =
    pvr === null
      ? unavailable(
          'WU',
          staleReason ?? 'A valid PAWP, mean PAP, and positive cardiac output are required.',
        )
      : available(pvr, 'WU', 1)
  const pulmonaryVascularResistanceIndex =
    pvr === null || !finitePositive(bsa)
      ? unavailable('WU·m²', staleReason ?? 'PVR and a valid body-surface area are required.')
      : available(pvr * bsa, 'WU·m²', 1)

  const cardiacPowerOutputW =
    finitePositive(co) && finitePositive(map)
      ? available((map * co) / 451, 'W', 2)
      : unavailable('W', staleReason ?? 'Current MAP and positive cardiac output are required.')

  const papPulse = finite(pasp) && finite(padp) ? pasp - padp : null
  const pulmonaryArteryPulsatilityIndex =
    papPulse !== null && papPulse > 0 && finitePositive(rap)
      ? available(papPulse / rap, '', 2)
      : unavailable(
          '',
          staleReason ?? 'Valid systolic/diastolic PAP and positive RAP are required.',
        )
  const pulmonaryArteryCompliance =
    sv !== null && papPulse !== null && papPulse > 0
      ? available(sv / papPulse, 'mL/mmHg', 1)
      : unavailable(
          'mL/mmHg',
          staleReason ?? 'Stroke volume and a valid PA pulse pressure are required.',
        )

  const ppvValidity = checkPpvValidity(input.ppvContext)
  const ppMax = measurements.pulsePressureMaxMmHg
  const ppMin = measurements.pulsePressureMinMmHg
  const meanPulse = finite(ppMax) && finite(ppMin) ? (ppMax + ppMin) / 2 : null
  const pulsePressureVariationPercent =
    staleReason ||
    !ppvValidity.valid ||
    !finitePositive(meanPulse) ||
    !finite(ppMax) ||
    !finite(ppMin)
      ? unavailable(
          '%',
          staleReason ??
            (ppvValidity.reasons.length > 0
              ? ppvValidity.reasons.join(' ')
              : 'Valid maximum and minimum pulse pressures are required.'),
        )
      : available((100 * (ppMax - ppMin)) / meanPulse, '%', 0)

  return {
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
  }
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
