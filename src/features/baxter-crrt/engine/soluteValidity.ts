import {
  crrtSoluteIds,
  type BagState,
  type CrrtSoluteId,
  type PatientModelState,
  type SolutePoolState,
} from './types'

/**
 * Terms the constant-volume mass balance in `soluteModel.ts` needs before its
 * output can be presented as a patient laboratory response rather than as
 * removal-only arithmetic.
 *
 * `solution-concentration` is the term a dialysate or replacement solution
 * contributes. `BagState` carries identity, flow term, volumes and connection
 * only; no bag in the engine fixture declares what is dissolved in it, so this
 * term cannot currently be supplied by any case. Owner decision O-01 (see
 * `docs/gap-remediation/fellow-review/CRRT-FELLOW-01-handoff.md`) has to record
 * the solution identities and compositions before it can be.
 */
export type CrrtSoluteMissingInputId =
  | 'solution-concentration'
  | 'endogenous-production'
  | 'external-input'
  | 'residual-clearance'

export const crrtSoluteMissingInputLabels: Readonly<Record<CrrtSoluteMissingInputId, string>> =
  Object.freeze({
    'solution-concentration': 'the concentration in the dialysate and replacement solutions',
    'endogenous-production': 'endogenous production or tissue release',
    'external-input': 'concentration carried by other infusions',
    'residual-clearance': 'residual kidney clearance',
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
   * `removal-only` means the pool was advanced by delivered clearance alone.
   * It is a model quantity, not a measured or predicted patient value.
   * `modeled` is reachable only once every missing input below is supplied.
   */
  readonly status: 'removal-only' | 'modeled'
  readonly missingInputIds: readonly CrrtSoluteMissingInputId[]
}

export type CrrtSoluteDynamicsValidityMap = Readonly<
  Partial<Record<CrrtSoluteId, CrrtSoluteDynamicsValidity>>
>

/**
 * Whether any source bag in this fixture declares a concentration for `soluteId`.
 * No such field exists on `BagState`, so this is false for every case today.
 * It is written as a predicate over the actual bags so that adding the authored
 * composition — and only that — changes the answer.
 */
function solutionConcentrationDeclared(bags: readonly BagState[], soluteId: CrrtSoluteId): boolean {
  return bags.some((bag) => {
    if (bag.direction !== 'source' || !bag.connected) return false
    const composition = (bag as BagState & { readonly soluteConcentrationsPerLiter?: unknown })
      .soluteConcentrationsPerLiter
    if (composition === null || typeof composition !== 'object') return false
    const declared = (composition as Record<string, unknown>)[soluteId]
    return typeof declared === 'number' && Number.isFinite(declared)
  })
}

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
  const missingInputIds: CrrtSoluteMissingInputId[] = []
  if (!solutionConcentrationDeclared(bags, pool.id)) missingInputIds.push('solution-concentration')
  if (pool.productionAmountPerHour === 0) missingInputIds.push('endogenous-production')
  if (pool.inputAmountPerHour === 0) missingInputIds.push('external-input')
  if (pool.residualClearanceMlMin === 0) missingInputIds.push('residual-clearance')
  return Object.freeze({
    soluteId: pool.id,
    status: missingInputIds.length === 0 ? 'modeled' : 'removal-only',
    missingInputIds: Object.freeze(missingInputIds),
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
  return crrtSoluteIds.filter((id) => map[id]?.status === 'removal-only')
}
