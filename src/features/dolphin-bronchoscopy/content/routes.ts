/**
 * The module's addresses. The base matches the feature, asset and documentation directories.
 *
 * `/dolphin-bronchoscopy/**` is also where the module's rendered frames sit under `public/`; those
 * carry a file extension, which is what the locale redirect keys on, so pages and assets do not
 * collide.
 *
 * The two dolphin pages that existed before the module stay where they are, as sandboxes the
 * module links to: the synchronized bronchoscopy and the whole-body 3D model. Link, never redirect.
 */
export const DOLPHIN_BRONCHOSCOPY_NAV_BASE = '/dolphin-bronchoscopy'

export const DOLPHIN_LEARN_HREF = `${DOLPHIN_BRONCHOSCOPY_NAV_BASE}/learn`
export const DOLPHIN_PRACTICE_HREF = `${DOLPHIN_BRONCHOSCOPY_NAV_BASE}/practice`
export const DOLPHIN_ASSESS_HREF = `${DOLPHIN_BRONCHOSCOPY_NAV_BASE}/assess`
export const DOLPHIN_REFERENCE_HREF = `${DOLPHIN_BRONCHOSCOPY_NAV_BASE}/reference`

export const DOLPHIN_SIMULATOR_HREF = '/learn/anatomy/dolphin-airway'
export const DOLPHIN_ANATOMY_HREF = '/learn/anatomy/dolphin'

export interface DolphinLinkTarget {
  readonly pathname: string
  readonly query: Record<string, string>
}

export function dolphinSectionLinkTarget(sectionId: string): DolphinLinkTarget {
  return { pathname: DOLPHIN_LEARN_HREF, query: { section: sectionId } }
}

export function dolphinSectionHref(sectionId: string): string {
  return `${DOLPHIN_LEARN_HREF}?section=${sectionId}`
}

export function dolphinPracticeCaseLinkTarget(caseId: string): DolphinLinkTarget {
  return { pathname: DOLPHIN_PRACTICE_HREF, query: { case: caseId } }
}

export function dolphinFrameDrillLinkTarget(drillId: string): DolphinLinkTarget {
  return { pathname: DOLPHIN_PRACTICE_HREF, query: { drill: drillId } }
}

export function dolphinBranchDrillLinkTarget(setId: string): DolphinLinkTarget {
  return { pathname: DOLPHIN_PRACTICE_HREF, query: { branches: setId } }
}

export function dolphinIntegratedCaseLinkTarget(caseId: string): DolphinLinkTarget {
  return { pathname: DOLPHIN_ASSESS_HREF, query: { case: caseId } }
}
