/**
 * The module's navigation base, declared here rather than in the shared `moduleRoutes.ts`, whose
 * test pins its exports to the critical-care prefixes. The route keeps the draft's `/fluoroview`
 * so every existing link, nav entry and search result still lands on the course.
 */
export const PERIPHERAL_IMAGING_NAV_BASE = '/fluoroview'

export const PERIPHERAL_IMAGING_LEARN_HREF = `${PERIPHERAL_IMAGING_NAV_BASE}/learn`
export const PERIPHERAL_IMAGING_PRACTICE_HREF = `${PERIPHERAL_IMAGING_NAV_BASE}/practice`
export const PERIPHERAL_IMAGING_ASSESS_HREF = `${PERIPHERAL_IMAGING_NAV_BASE}/assess`

export function imagingCaseLinkTarget(caseId: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: PERIPHERAL_IMAGING_PRACTICE_HREF, query: { case: caseId } }
}
