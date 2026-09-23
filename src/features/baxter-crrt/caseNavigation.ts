import {
  baxterCrrtAdditionalCaseIds,
  baxterCrrtCoreCaseIds,
  getBaxterCrrtCaseCatalogEntry,
} from './content/curriculum'
import type { CrrtCaseId } from './content/schema'

/**
 * Where the open Practice case sits, for navigation only.
 *
 * The address bar stays the single case identity (CRRT-FELLOW-01); this reads a
 * case ID and returns its place in one of the two authored lists — the ten-case
 * core path or the optional additional cases — plus its neighbours in that list.
 * It stores nothing and is not progress: "Case 3 of 10" says where a case sits,
 * never how far a learner has got or how well they did.
 */
export interface CrrtCaseNavigationPosition {
  readonly caseId: CrrtCaseId
  readonly group: 'core' | 'additional'
  /** One-based position within the group. */
  readonly position: number
  readonly total: number
  readonly previousCaseId: CrrtCaseId | null
  readonly nextCaseId: CrrtCaseId | null
  readonly station: number
}

export function selectCrrtCaseNavigation(caseId: CrrtCaseId): CrrtCaseNavigationPosition {
  const core = baxterCrrtCoreCaseIds.indexOf(caseId)
  const group = core >= 0 ? 'core' : 'additional'
  const list = group === 'core' ? baxterCrrtCoreCaseIds : baxterCrrtAdditionalCaseIds
  const index = group === 'core' ? core : list.indexOf(caseId)
  if (index < 0) throw new Error(`${caseId} is not a CRRT practice case.`)
  return {
    caseId,
    group,
    position: index + 1,
    total: list.length,
    previousCaseId: list[index - 1] ?? null,
    nextCaseId: list[index + 1] ?? null,
    station: getBaxterCrrtCaseCatalogEntry(caseId).station,
  }
}

/** "Core case 3 of 10" / "Additional case 2 of 7 · optional". */
export function formatCrrtCasePosition(position: CrrtCaseNavigationPosition): string {
  return position.group === 'core'
    ? `Core case ${position.position} of ${position.total}`
    : `Additional case ${position.position} of ${position.total} · optional`
}
