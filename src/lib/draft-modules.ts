const draftModulePathPrefixes = [
  '/education/chest-drainage',
  '/intro-bronchoscopy',
  '/rapid-onsite-cytology',
] as const

export const areDraftModulesEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DRAFT_MODULES === 'true'

export function isDraftModulePath(path: string): boolean {
  return draftModulePathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function isVisibleModulePath(path: string): boolean {
  return areDraftModulesEnabled || !isDraftModulePath(path)
}
