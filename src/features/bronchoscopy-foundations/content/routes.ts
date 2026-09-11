/**
 * The module's navigation base, declared in the feature rather than in the shared
 * `moduleRoutes.ts`, whose test pins its exports to the critical-care prefixes.
 *
 * The course has its own route rather than taking over `/intro-bronchoscopy`: the earlier course
 * is the live surface of the PCCM intro course and stays as it is while this one is built and
 * reviewed. Every asset under `public/bronchoscopy-foundations/**` carries a file extension, which
 * is what the locale redirect keys on, so page routes and asset paths do not collide.
 */
export const BRONCHOSCOPY_FOUNDATIONS_NAV_BASE = '/bronchoscopy-foundations'

export const BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF = `${BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}/learn`
export const BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF = `${BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}/practice`
export const BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF = `${BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}/assess`
export const BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF = `${BRONCHOSCOPY_FOUNDATIONS_NAV_BASE}/reference`
export const BRONCHOSCOPY_FOUNDATIONS_ATLAS_HREF = `${BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}/airway-atlas`

/** Where the module's static teaching assets live. */
export const BRONCHOSCOPY_FOUNDATIONS_ASSET_BASE = '/bronchoscopy-foundations'

export function bronchCaseLinkTarget(caseId: string): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF, query: { case: caseId } }
}
