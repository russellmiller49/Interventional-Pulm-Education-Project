export type BronchoscopyFoundationsReleaseStage = 'unlisted-preview' | 'published'

/**
 * The module is in development: reachable by direct link, absent from every navigation surface,
 * and noindex — the treatment `/peripheral-imaging` gets. The earlier nine-module course keeps
 * `/intro-bronchoscopy` untouched until the owner decides on a cutover.
 *
 * Flipping this to `'published'` restores the module to site navigation (`draft-modules.ts`).
 * Public reachability is set separately in `src/lib/site-auth/access.ts`, which holds no feature
 * imports, so its path lists are written out there.
 */
export const BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE: BronchoscopyFoundationsReleaseStage =
  'unlisted-preview'

export const BRONCHOSCOPY_FOUNDATIONS_ANALYTICS_MODULE_ID = 'bronchoscopy-foundations'
