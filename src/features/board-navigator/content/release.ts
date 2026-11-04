export type BoardNavigatorReleaseStage = 'unlisted-preview' | 'published'

/**
 * The Navigator is a module in development: reachable by direct link, absent from every
 * navigation surface, search and the sitemap, and noindex — the treatment the other in-development
 * courses get. Flipping this to `'published'` restores it to site navigation (`draft-modules.ts`).
 * Public reachability is set separately in `src/lib/site-auth/access.ts`, which holds no feature
 * imports, so its path lists are written out there.
 */
export const BOARD_NAVIGATOR_RELEASE_STAGE: BoardNavigatorReleaseStage = 'unlisted-preview'

export const BOARD_NAVIGATOR_ANALYTICS_MODULE_ID = 'board-navigator'
