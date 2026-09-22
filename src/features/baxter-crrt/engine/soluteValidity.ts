import {
  crrtSoluteIds,
  type BagState,
  type CrrtSoluteId,
  type PatientModelState,
  type SolutePoolState,
} from './types'

/** Missing reviewed specifications, not a classification of numeric source terms. */
export type CrrtSoluteMissingInputId =
  | 'solution-concentration'
  | 'reviewed-source-term-specification'

export const crrtSoluteMissingInputLabels: Readonly<Record<CrrtSoluteMissingInputId, string>> =
  Object.freeze({
    'solution-concentration': 'dialysate and replacement solution concentrations',
    'reviewed-source-term-specification':
      'endogenous production, external input, and residual kidney clearance (including explicit zero assumptions)',
  })

export const crrtSoluteDisplayLabels: Readonly<Record<CrrtSoluteId, string>> = Object.freeze({
  sodium: 'Sodium',
  potassium: 'Potassium',
  bicarbonate: 'Bicarbonate',
  'urea-marker': 'Small-solute (urea) marker',
  'creatinine-marker': 'Creatinine marker',
  phosphate: 'Phosphate',
  magnesium: 'Magnesium',
})

export interface CrrtSoluteDynamicsValidity {
  readonly soluteId: CrrtSoluteId
  /**
   * Clinical dynamics remain unsupported until a reviewed model specification
   * and its implementation exist. This is independent of whether a numeric
   * source term is zero, nonzero, or the concentration is unchanged while paused.
   */
  readonly status: 'unsupported'
  readonly missingInputIds: readonly CrrtSoluteMissingInputId[]
}

export type CrrtSoluteDynamicsValidityMap = Readonly<
  Partial<Record<CrrtSoluteId, CrrtSoluteDynamicsValidity>>
>

/**
 * Solute-concentration metric paths. Named once so the content validator and
 * the engine metric reader refuse exactly the same set. A removal-only pool
 * must not become a scored success condition.
 */
export function isCrrtSoluteConcentrationMetric(metric: string): boolean {
  const prefix = 'patient.solutes.'
  const suffix = '.concentrationPerLiter'
  if (!metric.startsWith(prefix) || !metric.endsWith(suffix)) return false
  const id = metric.slice(prefix.length, -suffix.length)
  return (crrtSoluteIds as readonly string[]).includes(id)
}

export function selectCrrtSoluteDynamicsValidity(
  pool: SolutePoolState,
  bags: readonly BagState[],
): CrrtSoluteDynamicsValidity {
  // BagState has no composition field, and SolutePoolState / the strict fixture
  // schema have no per-term suppliedness or reviewed zero-assumption contract.
  // Generic pool sourceIds/reviewStatus cannot distinguish placeholder zero from
  // an explicitly specified zero. Do not inspect numbers or duck-type future bag
  // fields to authorize laboratory predictions. A future reviewed implementation
  // must deliberately replace this containment boundary and add its own tests.
  void bags
  return Object.freeze({
    soluteId: pool.id,
    status: 'unsupported',
    missingInputIds: Object.freeze([
      'solution-concentration',
      'reviewed-source-term-specification',
    ] as const),
  })
}

export function selectCrrtSoluteDynamicsValidityMap(
  patient: PatientModelState,
  bags: readonly BagState[],
): CrrtSoluteDynamicsValidityMap {
  if (patient.status !== 'configured') return Object.freeze({})
  const map: Partial<Record<CrrtSoluteId, CrrtSoluteDynamicsValidity>> = {}
  for (const id of crrtSoluteIds) {
    const pool = patient.solutes[id]
    if (!pool) continue
    map[id] = selectCrrtSoluteDynamicsValidity(pool, bags)
  }
  return Object.freeze(map)
}

/** Solute IDs whose evolving concentration must not be shown as a patient trend. */
export function selectCrrtUnsupportedSoluteIds(
  patient: PatientModelState,
  bags: readonly BagState[],
): readonly CrrtSoluteId[] {
  const map = selectCrrtSoluteDynamicsValidityMap(patient, bags)
  return crrtSoluteIds.filter((id) => map[id]?.status === 'unsupported')
}
