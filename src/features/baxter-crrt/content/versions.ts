/**
 * Version for the authored three-case pilot content and the learner progress
 * derived from it. Change this whenever consequential case, scoring, or
 * debrief content changes so stale local results fail closed.
 */
export const BAXTER_CRRT_PILOT_CONTENT_VERSION = '0.5.0-pilot-draft.1' as const

/**
 * Version for review-gated Phase 7 curriculum candidates. These cases are
 * intentionally separate from the active three-case pilot so adding or
 * revising draft content cannot imply that pilot progress or review carries
 * forward to the expanded curriculum.
 */
export const BAXTER_CRRT_PHASE_7_CONTENT_VERSION = '0.7.0-phase7-draft.2' as const

/**
 * Version for the isolated Prismaflex and cross-device reviewer candidates.
 * This version does not identify a learner runtime: Phase 8 remains gated on
 * a stable, reviewed PrisMax v1 and an approved target Prismaflex profile.
 */
export const BAXTER_CRRT_PHASE_8_CONTENT_VERSION = '0.8.0-prismaflex-review-draft.1' as const
