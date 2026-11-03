export type DolphinBronchoscopyReleaseStage = 'unlisted-preview' | 'published'

/**
 * The module is in development: reachable by direct link, absent from every navigation surface,
 * and noindex, as the other in-development modules are.
 *
 * Flipping this to `'published'` restores the module to site navigation and search
 * (`draft-modules.ts`, `site-search.ts`). Public reachability is set separately in
 * `src/lib/site-auth/access.ts`, which holds no feature imports.
 */
export const DOLPHIN_BRONCHOSCOPY_RELEASE_STAGE: DolphinBronchoscopyReleaseStage =
  'unlisted-preview'

export const DOLPHIN_BRONCHOSCOPY_MODULE_ID = 'dolphin-bronchoscopy'
