import { unlocalizedPathname } from '@/i18n/path'
import { stentExplorerPublicationStatus } from '@/features/airway-stent-mechanics/explorer/release'
import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'

const airwayStentDraftPathPrefixes =
  stentExplorerPublicationStatus === 'published'
    ? ([] as const)
    : (['/airway-stent-mechanics'] as const)

const cardiohelpEcmoDraftPathPrefixes =
  cardiohelpEcmoPublicationStatus === 'published' ? ([] as const) : (['/cardiohelp-ecmo'] as const)

const draftModulePathPrefixes = [
  ...airwayStentDraftPathPrefixes,
  ...cardiohelpEcmoDraftPathPrefixes,
  '/education/chest-drainage',
  '/intro-bronchoscopy',
  '/learn/anatomy/airway',
  '/pleural-procedures',
  '/rapid-onsite-cytology',
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

export function isVisibleModulePath(
  path: string,
  options: DraftModuleVisibilityOptions = {},
): boolean {
  return canViewDraftModules(options) || !isDraftModulePath(path)
}
