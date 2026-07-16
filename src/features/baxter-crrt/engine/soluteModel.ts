import type { CrrtSoluteId, SolutePoolState } from './types'

function nonnegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and nonnegative.`)
  }
  return value
}

function fraction(value: number, label: string): number {
  nonnegative(value, label)
  if (value > 1) throw new RangeError(`${label} must not exceed 1.`)
  return value
}

export function calculateDeliveredSoluteClearanceMlMin(
  actualEffluentFlowMlHour: number,
  filterPermeabilityFraction: number,
  filterInletConcentrationFraction: number,
): number {
  return (
    (nonnegative(actualEffluentFlowMlHour, 'Actual effluent flow') *
      fraction(filterPermeabilityFraction, 'Filter permeability') *
      fraction(filterInletConcentrationFraction, 'Filter-inlet concentration fraction')) /
    60
  )
}

export interface SoluteAdvanceResult {
  readonly pool: SolutePoolState
  readonly startingAmount: number
  readonly endingAmount: number
  readonly producedOrInfusedAmount: number
  readonly removedAmount: number
}

/**
 * Advances one transparent, constant-volume mass-balance pool analytically.
 * Concentration units remain paired with the pool's declared amount unit.
 */
export function advanceSolutePool(
  pool: SolutePoolState,
  deliveredCrrtClearanceMlMin: number,
  durationSeconds: number,
): SoluteAdvanceResult {
  nonnegative(pool.concentrationPerLiter, `${pool.id} concentration`)
  const distributionVolumeLiters = nonnegative(
    pool.distributionVolumeLiters,
    `${pool.id} distribution volume`,
  )
  if (distributionVolumeLiters === 0) {
    throw new RangeError(`${pool.id} distribution volume must be positive.`)
  }
  const durationHours = nonnegative(durationSeconds, 'Duration') / 3600
  const sourceAmountPerHour =
    nonnegative(pool.productionAmountPerHour, `${pool.id} production`) +
    nonnegative(pool.inputAmountPerHour, `${pool.id} input`)
  const totalClearanceLitersPerHour =
    (nonnegative(pool.residualClearanceMlMin, `${pool.id} residual clearance`) +
      nonnegative(deliveredCrrtClearanceMlMin, `${pool.id} CRRT clearance`)) *
    0.06
  const startingAmount = pool.concentrationPerLiter * distributionVolumeLiters
  const eliminationPerHour = totalClearanceLitersPerHour / distributionVolumeLiters

  let endingAmount: number
  if (durationHours === 0) {
    endingAmount = startingAmount
  } else if (eliminationPerHour === 0) {
    endingAmount = startingAmount + sourceAmountPerHour * durationHours
  } else {
    const decay = Math.exp(-eliminationPerHour * durationHours)
    endingAmount = startingAmount * decay + (sourceAmountPerHour / eliminationPerHour) * (1 - decay)
  }
  endingAmount = Math.max(0, endingAmount)
  const producedOrInfusedAmount = sourceAmountPerHour * durationHours
  const removedAmount = Math.max(0, startingAmount + producedOrInfusedAmount - endingAmount)

  return {
    pool: {
      ...pool,
      concentrationPerLiter: endingAmount / distributionVolumeLiters,
    },
    startingAmount,
    endingAmount,
    producedOrInfusedAmount,
    removedAmount,
  }
}

export function advanceSolutePools(
  pools: Readonly<Partial<Record<CrrtSoluteId, SolutePoolState>>>,
  actualEffluentFlowMlHour: number,
  filterInletConcentrationFraction: number,
  durationSeconds: number,
): Readonly<Partial<Record<CrrtSoluteId, SolutePoolState>>> {
  const next: Partial<Record<CrrtSoluteId, SolutePoolState>> = {}
  for (const [id, pool] of Object.entries(pools) as [CrrtSoluteId, SolutePoolState][]) {
    const clearance = calculateDeliveredSoluteClearanceMlMin(
      actualEffluentFlowMlHour,
      pool.filterPermeabilityFraction,
      filterInletConcentrationFraction,
    )
    next[id] = advanceSolutePool(pool, clearance, durationSeconds).pool
  }
  return next
}
