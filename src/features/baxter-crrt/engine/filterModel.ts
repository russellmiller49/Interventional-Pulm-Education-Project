import type { CrrtAnticoagulationMethod, FilterProgressionParameters, FilterState } from './types'

function clamp01(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
  if (value < 0 || value > 1) throw new RangeError(`${label} must be between 0 and 1.`)
  return value
}

function nonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and nonnegative.`)
  }
  return value
}

export interface FilterProgressionInput {
  readonly filtrationFraction: number
  readonly bloodFlowInterruptionFraction: number
  readonly lowEffectiveBloodFlowFraction: number
  readonly accessDysfunctionFraction: number
  readonly hematocritFraction: number
  readonly procoagulantBurdenFraction: number
  readonly anticoagulation: CrrtAnticoagulationMethod
}

export interface FilterProgressionResult {
  readonly filter: FilterState
  readonly unprotectedRiskIndex: number
  readonly protectedRiskIndex: number
  readonly foulingDeltaFraction: number
  readonly clotDeltaFraction: number
}

function validateParameters(parameters: FilterProgressionParameters) {
  nonnegative(parameters.foulingFractionPerHourAtRiskOne, 'Fouling rate')
  nonnegative(parameters.clotFractionPerHourAtRiskOne, 'Clot rate')
  nonnegative(parameters.filtrationFractionWeight, 'Filtration-fraction weight')
  nonnegative(parameters.interruptionWeight, 'Interruption weight')
  nonnegative(parameters.lowFlowWeight, 'Low-flow weight')
  nonnegative(parameters.accessDysfunctionWeight, 'Access-dysfunction weight')
  nonnegative(parameters.hematocritWeight, 'Hematocrit weight')
  nonnegative(parameters.procoagulantWeight, 'Procoagulant weight')
  clamp01(parameters.referenceHematocritFraction, 'Reference hematocrit')
  clamp01(
    parameters.anticoagulationProtectionFraction.none,
    'No-anticoagulation protection fraction',
  )
  clamp01(
    parameters.anticoagulationProtectionFraction['systemic-concept'],
    'Systemic-anticoagulation protection fraction',
  )
}

/**
 * Advances a normalized educational burden model. Every coefficient is
 * caller-supplied and review-gated; the engine contains no clinical fouling
 * rate, anticoagulation effect, or hematocrit threshold.
 */
export function advanceFilterProgression(
  filter: FilterState,
  input: FilterProgressionInput,
  parameters: FilterProgressionParameters,
  durationSeconds: number,
): FilterProgressionResult {
  validateParameters(parameters)
  const durationHours = nonnegative(durationSeconds, 'Duration') / 3600
  const filtrationFraction = clamp01(input.filtrationFraction, 'Filtration fraction')
  const interruption = clamp01(
    input.bloodFlowInterruptionFraction,
    'Blood-flow interruption fraction',
  )
  const lowFlow = clamp01(input.lowEffectiveBloodFlowFraction, 'Low-flow fraction')
  const accessDysfunction = clamp01(input.accessDysfunctionFraction, 'Access-dysfunction fraction')
  const hematocrit = clamp01(input.hematocritFraction, 'Hematocrit fraction')
  const procoagulant = clamp01(input.procoagulantBurdenFraction, 'Procoagulant burden')
  const hematocritStress =
    parameters.referenceHematocritFraction >= 1
      ? 0
      : Math.max(0, hematocrit - parameters.referenceHematocritFraction) /
        (1 - parameters.referenceHematocritFraction)

  const unprotectedRiskIndex =
    filtrationFraction * parameters.filtrationFractionWeight +
    interruption * parameters.interruptionWeight +
    lowFlow * parameters.lowFlowWeight +
    accessDysfunction * parameters.accessDysfunctionWeight +
    hematocritStress * parameters.hematocritWeight +
    procoagulant * parameters.procoagulantWeight
  const protection = parameters.anticoagulationProtectionFraction[input.anticoagulation]
  const protectedRiskIndex = Math.max(0, unprotectedRiskIndex * (1 - protection))
  const foulingDeltaFraction =
    parameters.foulingFractionPerHourAtRiskOne * protectedRiskIndex * durationHours
  const clotDeltaFraction =
    parameters.clotFractionPerHourAtRiskOne *
    protectedRiskIndex *
    (1 + interruption * parameters.interruptionWeight) *
    durationHours

  return {
    filter: {
      ...filter,
      foulingBurdenFraction: Math.min(1, filter.foulingBurdenFraction + foulingDeltaFraction),
      clotBurdenFraction: Math.min(1, filter.clotBurdenFraction + clotDeltaFraction),
      bloodFlowInterruptionFraction: interruption,
      lowEffectiveBloodFlowFraction: lowFlow,
      procoagulantBurdenFraction: procoagulant,
    },
    unprotectedRiskIndex,
    protectedRiskIndex,
    foulingDeltaFraction,
    clotDeltaFraction,
  }
}
