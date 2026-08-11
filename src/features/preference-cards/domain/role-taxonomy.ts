/**
 * The closed browse vocabulary for catalog roles, and the permanent role-code alias table.
 *
 * `Roles.category` renders as the section headings on `/preference-cards/catalog/uses`. It
 * arrived as free text and drifted into synonyms — `Medical thoracoscopy` vs
 * `Thoracoscopy platform` vs `Pleurodesis` vs `Pleural procedures`; `Airway stent` vs
 * `Airway stenting` vs `Airway stent accessory`; `Sampling` vs `Bronchoscopy sampling` vs
 * `Sampling accessory`; four separate `* platform` headings. Thirty-three headings for a
 * catalog a clinician reads in one sitting is not a taxonomy, it is an accident.
 *
 * This module is the single reviewed source for both halves of the fix: which headings exist,
 * and what every historical heading and role code maps onto. The import pipeline canonicalizes
 * against it and fails closed on anything unmapped, so free text can never reappear.
 */

/**
 * The reviewed heading set. Order is the display order on the browse page — clinical
 * workflow order rather than alphabetical, so related sections sit together.
 */
export const ROLE_CATEGORIES = [
  'Flexible bronchoscopy',
  'Endoscopy platform',
  'Rigid bronchoscopy',
  'Peripheral & robotic bronchoscopy',
  'EBUS',
  'Tissue sampling',
  'Therapeutic bronchoscopy',
  'Energy platforms',
  'Laser',
  'Photodynamic therapy',
  'Airway stents',
  'Airway isolation & tracheostomy',
  'Bronchoscopic lung volume reduction',
  'Medical thoracoscopy',
  'Pleural drainage',
  'Whole lung lavage',
  'Procedural imaging',
  'Reprocessing',
  'Room & generic supply',
] as const

export type RoleCategory = (typeof ROLE_CATEGORIES)[number]

export const ROLE_CATEGORY_SET: ReadonlySet<string> = new Set(ROLE_CATEGORIES)

export function isRoleCategory(value: unknown): value is RoleCategory {
  return typeof value === 'string' && ROLE_CATEGORY_SET.has(value)
}

/** Display rank for a heading, so the browse page can order by workflow rather than A–Z. */
export function roleCategoryOrder(category: string): number {
  const index = (ROLE_CATEGORIES as readonly string[]).indexOf(category)
  return index === -1 ? ROLE_CATEGORIES.length : index
}

/**
 * Every heading the workbook and its overlays have ever used, mapped onto the reviewed set.
 *
 * Kept exhaustive rather than trimmed to what is currently in use: a workbook refresh can
 * reintroduce a retired heading, and an unmapped heading must fail the import loudly instead
 * of appearing as a thirty-fourth section nobody chose.
 */
export const LEGACY_ROLE_CATEGORY_MAP: Readonly<Record<string, RoleCategory>> = {
  'Airway dilation': 'Therapeutic bronchoscopy',
  'Airway isolation': 'Airway isolation & tracheostomy',
  'Airway stent': 'Airway stents',
  'Airway stent accessory': 'Airway stents',
  'Airway stenting': 'Airway stents',
  'Bronchoscopy accessory': 'Flexible bronchoscopy',
  'Bronchoscopy platform': 'Flexible bronchoscopy',
  'Bronchoscopy sampling': 'Tissue sampling',
  'EBUS accessory': 'EBUS',
  'EBUS platform': 'EBUS',
  'Endobronchial occlusion': 'Bronchoscopic lung volume reduction',
  'Endobronchial valve': 'Bronchoscopic lung volume reduction',
  'Endoscopy platform': 'Endoscopy platform',
  'Generic equipment': 'Room & generic supply',
  'Generic supply': 'Room & generic supply',
  Guidewire: 'Tissue sampling',
  'Imaging platform': 'Endoscopy platform',
  'Medical thoracoscopy': 'Medical thoracoscopy',
  'Percutaneous tracheostomy': 'Airway isolation & tracheostomy',
  'Peripheral bronchoscopy': 'Peripheral & robotic bronchoscopy',
  'Pleural procedures': 'Pleural drainage',
  Pleurodesis: 'Medical thoracoscopy',
  Reprocessing: 'Reprocessing',
  Retrieval: 'Therapeutic bronchoscopy',
  'Rigid bronchoscopy': 'Rigid bronchoscopy',
  'Robotic bronchoscopy': 'Peripheral & robotic bronchoscopy',
  Sampling: 'Tissue sampling',
  'Sampling accessory': 'Tissue sampling',
  'Specimen management': 'Tissue sampling',
  'Therapeutic bronchoscopy': 'Therapeutic bronchoscopy',
  'Thoracoscopy platform': 'Medical thoracoscopy',
  Tracheostomy: 'Airway isolation & tracheostomy',
  'Whole lung lavage': 'Whole lung lavage',
}

/**
 * Headings a role must carry once its code is renamed below, where the rename also moves the
 * role between sections. Keyed by the *new* role code, applied after the code rename.
 */
export const ROLE_CATEGORY_OVERRIDES: Readonly<Record<string, RoleCategory>> = {
  ENERGY_PLATFORM: 'Energy platforms',
}

/**
 * Resolve a historical heading to its reviewed replacement. Returns null when the heading is
 * unknown, which the import treats as a hard failure rather than a passthrough.
 */
export function canonicalRoleCategory(value: string | null | undefined): RoleCategory | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (isRoleCategory(trimmed)) return trimmed
  return LEGACY_ROLE_CATEGORY_MAP[trimmed] ?? null
}

/**
 * Permanent old-code → new-code aliases for the taxonomy-v2 renames.
 *
 * These can never be dropped. `ip_user_preference_cards.builder_inputs` stores `roleCode`
 * strings, and family item ids embed the role as `family-role:{role}:{key}`, so a saved card
 * written before the rename still carries the old code. Without the alias, reopening that
 * card fails with `unknown_role` and the selection silently disappears.
 *
 * An alias resolves on the way in and is never surfaced: it does not appear in facets, in
 * search, on the browse page, or in a rebuilt pick, which always carries the canonical code.
 */
export const ROLE_CODE_ALIASES: Readonly<Record<string, string>> = {
  // Semi-rigid pleuroscope and rigid telescope are different devices; the pair now reads
  // as such instead of one being named for the procedure and the other for the optic.
  PLEUROSCOPE: 'THORACOSCOPE_SEMIRIGID',
  THORACOSCOPY_TELESCOPE: 'THORACOSCOPE_RIGID',
  // Medical thoracoscopy and pleuroscopy are one procedure. One procedure, one prefix.
  PLEUROSCOPY_TROCAR: 'THORACOSCOPY_TROCAR',
  PLEURAL_BIOPSY_FORCEPS: 'THORACOSCOPY_BIOPSY_FORCEPS',
  // Percutaneous dilational tracheostomy, which collided head-on with photodynamic therapy.
  // The rename is what frees the PHOTODYNAMIC_/PDT namespace for the real thing.
  PDT_KIT: 'PERC_TRACH_KIT',
  // "Generic" was a placeholder for "no products behind it yet". Both now hold real,
  // manufacturer-documented equipment.
  GENERIC_ENERGY_PLATFORM: 'ENERGY_PLATFORM',
  GENERIC_COLLATERAL_VENT: 'COLLATERAL_VENTILATION_SYSTEM',
  // One opaque line became a named lavage circuit, with the rest of the setup decomposed
  // into its own slots alongside it.
  GENERIC_WLL_LAVAGE: 'WLL_LAVAGE_CIRCUIT',
}

export const DEPRECATED_ROLE_CODES: ReadonlySet<string> = new Set(Object.keys(ROLE_CODE_ALIASES))

/**
 * The role code a caller means. Untrusted input — a saved card, a URL, a picker payload —
 * goes through this before any catalog lookup.
 *
 * This is the **live** table, and it is only for current-data surfaces: the catalog browse
 * pages, the pickers, the client-side equipment-set library. Anything resolving through a
 * release pin canonicalizes with that release's own resolved taxonomy via
 * `roleCanonicalizerFor` instead — a role's meaning inside a published release is part of
 * what the release froze, and a live alias added later must never reinterpret it (P92-C1).
 */
export function canonicalRoleCode(roleCode: string): string {
  // Own-property lookup: a client-supplied code like "constructor" must canonicalize to
  // itself, not to an inherited Object.prototype member.
  return Object.hasOwn(ROLE_CODE_ALIASES, roleCode) ? ROLE_CODE_ALIASES[roleCode] : roleCode
}

/** A role-code canonicalizer bound to one exact alias table. */
export type RoleCodeCanonicalizer = (roleCode: string) => string

/**
 * Canonicalization under an exact alias table — the one a release resolved by its
 * `roleTaxonomyPin`, not whatever the live table says today.
 *
 * Single-hop by construction, exactly like `canonicalRoleCode`: every alias maps an old code
 * directly onto its canonical replacement, so a chain would be an authoring error rather than
 * something to follow. Applying the pinned table single-hop is what makes a historical
 * release's canonicalization byte-stable under any future live edit — including a future
 * alias whose source is a role code this release actively uses.
 */
export function roleCanonicalizerFor(
  aliases: Readonly<Record<string, string>>,
): RoleCodeCanonicalizer {
  return (roleCode: string) => (Object.hasOwn(aliases, roleCode) ? aliases[roleCode] : roleCode)
}

export function isDeprecatedRoleCode(roleCode: string): boolean {
  return DEPRECATED_ROLE_CODES.has(roleCode)
}
