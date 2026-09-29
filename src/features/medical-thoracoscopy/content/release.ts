export type MedicalThoracoscopyReleaseStage = 'admin-preview' | 'unlisted-preview' | 'published'

/**
 * The module is in development and opens only for a site admin (owner decision OD-15,
 * 2026-09-29): its clinical statements await review and its rights are unresolved, so a direct
 * link that needs no account is not enough. It is absent from every navigation surface, search
 * and the sitemap, and noindex. The earlier pleuroscopy module keeps
 * `/pleural-procedures/pleuroscopy` until a reviewed destination exists for its redirects.
 *
 * Flipping this to `'published'` restores the module to site navigation (`draft-modules.ts`).
 * Who may open it is set separately in `src/lib/site-auth/access.ts`, which holds no feature
 * imports, so its path lists are written out there.
 */
export const MEDICAL_THORACOSCOPY_RELEASE_STAGE: MedicalThoracoscopyReleaseStage = 'admin-preview'

/** The module's id wherever the site names modules: analytics, sponsorship, access. */
export const MEDICAL_THORACOSCOPY_MODULE_ID = 'medical-thoracoscopy'
