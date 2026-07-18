import { unlocalizedPathname } from '@/i18n/path'
import { stentExplorerPublicationStatus } from '@/features/airway-stent-mechanics/explorer/release'
import { baxterCrrtReleaseStage } from '@/features/baxter-crrt/content'
import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'
import { mechanicalVentilationPublicationStatus } from '@/features/mechanical-ventilation/content/deviceProfiles'

const airwayStentDraftPathPrefixes =
  stentExplorerPublicationStatus === 'published'
    ? ([] as const)
    : (['/airway-stent-mechanics'] as const)

const cardiohelpEcmoDraftPathPrefixes =
  cardiohelpEcmoPublicationStatus === 'published' ? ([] as const) : (['/cardiohelp-ecmo'] as const)

const baxterCrrtDraftPathPrefixes =
  baxterCrrtReleaseStage === 'published' ? ([] as const) : (['/baxter-crrt'] as const)

const baxterCrrtUnlistedPathPrefixes =
  baxterCrrtReleaseStage === 'published'
    ? (['/baxter-crrt/review'] as const)
    : (['/baxter-crrt'] as const)

const mechanicalVentilationDraftPathPrefixes =
  mechanicalVentilationPublicationStatus === 'draft'
    ? (['/mechanical-ventilation', '/hamilton-c6-ventilation'] as const)
    : ([] as const)

const draftModulePathPrefixes = [
  ...airwayStentDraftPathPrefixes,
  ...baxterCrrtDraftPathPrefixes,
  ...cardiohelpEcmoDraftPathPrefixes,
  ...mechanicalVentilationDraftPathPrefixes,
  '/education/chest-drainage',
  '/intro-bronchoscopy',
  '/learn/anatomy/airway',
  '/pleural-procedures',
  '/rapid-onsite-cytology',
] as const

const unlistedModulePathPrefixes = [
  ...baxterCrrtUnlistedPathPrefixes,
  '/cardiohelp-ecmo',
  '/mechanical-ventilation',
  '/hamilton-c6-ventilation',
] as const

interface DraftModuleVisibilityOptions {
  isAdmin?: boolean
}

export const areDraftModulesEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DRAFT_MODULES === 'true'

export function isDraftModulePath(path: string): boolean {
  const normalizedPath = unlocalizedPathname(path)

  return draftModulePathPrefixes.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  )
}

export function canViewDraftModules(options: DraftModuleVisibilityOptions = {}): boolean {
  return areDraftModulesEnabled || options.isAdmin === true
}

export function isUnlistedModulePath(path: string): boolean {
  const normalizedPath = unlocalizedPathname(path)

  return unlistedModulePathPrefixes.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  )
}

export function isVisibleModulePath(
  path: string,
  options: DraftModuleVisibilityOptions = {},
): boolean {
  if (isUnlistedModulePath(path)) {
    return false
  }

  return canViewDraftModules(options) || !isDraftModulePath(path)
}
