export type MedicalThoracoscopyReleaseStage = 'unlisted-preview' | 'published'

/**
 * The module is in development: reachable by direct link, absent from every navigation surface,
 * and noindex, the treatment `/bronchoscopy-foundations` gets. The earlier pleuroscopy module
 * keeps `/pleural-procedures/pleuroscopy` until a reviewed destination exists for its redirects.
 *
 * Flipping this to `'published'` restores the module to site navigation (`draft-modules.ts`).
 * Public reachability is set separately in `src/lib/site-auth/access.ts`, which holds no feature
 * imports, so its path lists are written out there.
 */
export const MEDICAL_THORACOSCOPY_RELEASE_STAGE: MedicalThoracoscopyReleaseStage =
  'unlisted-preview'

/** The module's id wherever the site names modules: analytics, sponsorship, access. */
export const MEDICAL_THORACOSCOPY_MODULE_ID = 'medical-thoracoscopy'
