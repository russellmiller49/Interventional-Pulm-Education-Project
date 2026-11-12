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
 * Which case is not decided here. It is the pairing the module already had: a section's
 * `practicePairing` of kind `mechanism-match`. Three cases are paired by two sections each
 * (MV-01 by Sections 6 and 9, MV-05 by 7 and 10, MV-13 by 4 and 14). A case is run once, in the
 * first section that pairs it, which is the section Practice already says the case "builds on".
 * The later section keeps its line and link to the case. A section whose pairing is only
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

/** The first section that pairs this case as a mechanism match: where the case is the last task. */
export function ventilationCaseHomeUnitId(caseId: string): string | null {
  if (!isVentilationCaseLive(caseId)) return null
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
