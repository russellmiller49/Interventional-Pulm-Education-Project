import { mechanicalVentilationCaseById } from './runtimeCases'

/** Self-paced outlines use the authored case title, including its mechanism or diagnosis. */
export function ventilationCasePresentationTitle(caseId: string): string {
  const definition = mechanicalVentilationCaseById.get(caseId)
  if (!definition) throw new Error(`No presentation title for case ${caseId}`)
  return definition.title
}
