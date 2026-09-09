export type PeripheralImagingReleaseStage = 'unlisted-preview' | 'published'

/**
 * The module is in development: reachable by direct link, absent from every navigation surface,
 * and noindex — the treatment the other in-development modules get. The original FluoroView
 * simulator keeps `/fluoroview`; this course does not replace it until the owner says so.
 *
 * Flipping this to `'published'` is the single switch: it restores the module to site navigation
 * and search (`draft-modules.ts`, `site-search.ts`). Public reachability is set separately in
 * `src/lib/site-auth/access.ts`, which holds no feature imports.
 */
export const PERIPHERAL_IMAGING_RELEASE_STAGE: PeripheralImagingReleaseStage = 'unlisted-preview'

export const PERIPHERAL_IMAGING_ANALYTICS_MODULE_ID = 'peripheral-imaging'
