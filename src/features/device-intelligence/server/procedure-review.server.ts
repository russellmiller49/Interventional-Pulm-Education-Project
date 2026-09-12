import 'server-only'
import type { ProcedureWorkspace } from './procedures.server'

/** Editorial review findings; no change to composition, selection or readiness. */
export function getProcedureReviewSummary(workspace: ProcedureWorkspace) {
  return {
    clinicalOwnerMissing: !workspace.clinicalOwner,
    requiredWithoutSelectableOption: workspace.requirements.filter(
      (row) =>
        row.requiredness === 'required' &&
        !row.authoredOptions.some((option) => option.selectable) &&
        row.withheldSelectableOptionCount === 0,
    ).length,
    currentIfuRequired: workspace.requirements.filter((row) => row.requiresCurrentIfu).length,
    responsibleRoleMissing: workspace.requirements.filter((row) => !row.responsibleRole).length,
    optionsMissingCatalogNumber: workspace.requirements
      .flatMap((row) => row.authoredOptions)
      .filter((option) => !option.catalogNumber).length,
    laserCoverageGap: workspace.laserPathwayDisclosureRequired,
    rescueAuthoringGap: workspace.noRescueModuleReachable,
  }
}
