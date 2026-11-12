import { ventilationCasePresentationTitle } from './casePresentation'
import { isVentilationCaseLive, ventilationSectionNumber } from './learnerMap'
import { ventilationLearningUnits } from './learningCurriculum'
import { ventilationSectionSpec } from './sectionSpecs'

/**
 * The case a Learn section ends on.
 *
 * Until November 2026 a section ended with "A case on this mechanism:" and a link to Practice: the
 * case ran on its own page, and there was no way back to the section. The case is now the
 * section's last task, run inside it (as ICU hemodynamics and mechanical circulatory support do).
 *
 * Which case comes from the section's `practicePairing` of kind `mechanism-match`. Nine sections
 * end on a case: 4 and 7 to 14. Sections 10 and 14 used to pair the case an earlier section already
 * ends on (MV-05, MV-13); on 2026-11-12 the owner gave each the module's own follow-on case
 * instead (MV-06, MV-14), which each section already listed.
 *
 * One case is still paired by two sections: MV-01, by Sections 6 and 9. It is run in Section 9
 * (`CASE_HOME`, owner ruling 2026-11-12): stepping PEEP against its cost in pressure and blood
 * pressure is what Section 9 teaches, and Section 9 has Section 6 as a prerequisite. Section 6
 * keeps its line and link to the case, and says where it is run. A section whose pairing is only
 * "next in this part of the pathway" (Sections 1, 2, 3 and 5) is unchanged, and so is a case held
 * as a worked explanation.
 */
export interface VentilationSectionCase {
  readonly unitId: string
  readonly sectionNumber: number
  readonly caseId: string
  /** The case's title. It names the mechanism, so it is shown on the case, never in a task list. */
  readonly title: string
}

/** What the case is called in "Tasks in this section", where every title is visible from task 1. */
export const VENTILATION_SECTION_CASE_TASK_TITLE = 'Apply it in a patient case'

function mechanismCaseId(unitId: string): string | null {
  const pairing = ventilationSectionSpec(unitId).practicePairing
  return pairing?.kind === 'mechanism-match' ? pairing.caseId : null
}

/**
 * Where a case paired by more than one section is run. Without an entry it is the first section
 * that pairs it. Each entry must name a section that pairs the case as a mechanism match.
 */
export const VENTILATION_CASE_HOME: Readonly<Record<string, string>> = {
  'MV-01': 'oxygenation-response',
}

/** The section that ends on this case: the one Practice says the case "builds on". */
export function ventilationCaseHomeUnitId(caseId: string): string | null {
  if (!isVentilationCaseLive(caseId)) return null
  const named = VENTILATION_CASE_HOME[caseId]
  if (named && mechanismCaseId(named) === caseId) return named
  return ventilationLearningUnits.find((unit) => mechanismCaseId(unit.id) === caseId)?.id ?? null
}

export function ventilationSectionCase(unitId: string): VentilationSectionCase | null {
  const caseId = mechanismCaseId(unitId)
  if (!caseId || ventilationCaseHomeUnitId(caseId) !== unitId) return null
  return {
    unitId,
    sectionNumber: ventilationSectionNumber(unitId),
    caseId,
    title: ventilationCasePresentationTitle(caseId),
  }
}

export function ventilationSectionCases(): readonly VentilationSectionCase[] {
  return ventilationLearningUnits.flatMap((unit) => ventilationSectionCase(unit.id) ?? [])
}
