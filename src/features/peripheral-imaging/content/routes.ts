/**
 * The module's navigation base, declared here rather than in the shared `moduleRoutes.ts`, whose
 * test pins its exports to the critical-care prefixes.
 *
 * The course has its own route rather than taking over `/fluoroview`: the original FluoroView
 * simulator still lives there, and this module is in development (see `release.ts`). The base
 * matches the feature, asset and documentation directories, so one name means one thing.
 *
 * `/peripheral-imaging/**` is also where the course's static assets sit under `public/`. Those
 * all carry a file extension, which is what the locale redirect keys on, so the page routes and
 * the asset paths do not collide — unlike `/fluoroview`, which needs a bypass rule for exactly
 * that reason.
 */
export const PERIPHERAL_IMAGING_NAV_BASE = '/peripheral-imaging'

export const PERIPHERAL_IMAGING_LEARN_HREF = `${PERIPHERAL_IMAGING_NAV_BASE}/learn`
export const PERIPHERAL_IMAGING_PRACTICE_HREF = `${PERIPHERAL_IMAGING_NAV_BASE}/practice`
export const PERIPHERAL_IMAGING_ASSESS_HREF = `${PERIPHERAL_IMAGING_NAV_BASE}/assess`

export function imagingCaseLinkTarget(caseId: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: PERIPHERAL_IMAGING_PRACTICE_HREF, query: { case: caseId } }
}
