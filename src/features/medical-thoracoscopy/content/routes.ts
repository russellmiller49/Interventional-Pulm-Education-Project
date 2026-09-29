/**
 * The module's addresses, declared in the feature rather than in the shared `moduleRoutes.ts`,
 * whose test pins its exports to the critical-care prefixes.
 *
 * The fourth tab is labelled Cases and lives at `/assess`, the address the earlier module's
 * `/assessment` will redirect to once it is retired.
 */
export const MEDICAL_THORACOSCOPY_NAV_BASE = '/medical-thoracoscopy'

export const MEDICAL_THORACOSCOPY_LEARN_HREF = `${MEDICAL_THORACOSCOPY_NAV_BASE}/learn`
export const MEDICAL_THORACOSCOPY_PRACTICE_HREF = `${MEDICAL_THORACOSCOPY_NAV_BASE}/practice`
export const MEDICAL_THORACOSCOPY_CASES_HREF = `${MEDICAL_THORACOSCOPY_NAV_BASE}/assess`
export const MEDICAL_THORACOSCOPY_REFERENCE_HREF = `${MEDICAL_THORACOSCOPY_NAV_BASE}/reference`

/**
 * The engineering prototypes: the model on its own, outside the curriculum and the progress record,
 * linked from the hub only while the module is in development.
 */
export const MEDICAL_THORACOSCOPY_SPACE_PROTOTYPE_HREF = `${MEDICAL_THORACOSCOPY_NAV_BASE}/prototype/space`
export const MEDICAL_THORACOSCOPY_TOOL_CONTACT_PROTOTYPE_HREF = `${MEDICAL_THORACOSCOPY_NAV_BASE}/prototype/tool-contact`

/** Where the module's models live. Page code reads the generated manifest, never this folder. */
export const MEDICAL_THORACOSCOPY_MODEL_BASE = '/models/medical-thoracoscopy/v1'
