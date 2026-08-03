/**
 * Which requirements may be satisfied by a product line without committing to a size.
 *
 * Airway stents are sized intraoperatively — the diameter and length are chosen once the
 * stenosis is measured — so a card that says "Dumon TD silicone stent, size at time of
 * procedure" is more honest than one that names a size nobody can know in advance. The
 * expectation is that the whole family is available in the room.
 *
 * Everywhere else a card records a specific catalog number, because the card's job is to be
 * a pull list.
 */

const SIZE_AT_PROCEDURE_ROLE_PATTERN = /^AIRWAY_STENT_(?!SIZING_DEVICE$)/

export function allowsSizeAtProcedure(roleCode: string): boolean {
  return SIZE_AT_PROCEDURE_ROLE_PATTERN.test(roleCode)
}

/**
 * Family-level pick id, distinct from a product id so the two can never be confused.
 *
 * Addressed by *reviewed family version id* rather than by the discovery grouping key. The two
 * prefixes are different strings on purpose: `family:` and `family-role:` are the discovery-keyed
 * forms written by builder-inputs versions 2 and 3, and a card carrying one of those is asking for
 * whatever a mutable label happened to group at the time. They stay parseable, because a stored
 * snapshot that used them still has to render; they are never written again.
 *
 * The one-argument form is the ordinary case, where a family version is selected for one role. A
 * role-qualified identity is used only when the same family version is selected for more than one
 * of the roles it serves, which would otherwise collapse two requirements onto one item.
 */
export function familyPickId(productFamilyVersionId: string, roleCode?: string): string {
  return roleCode
    ? `family-version-role:${roleCode}:${productFamilyVersionId}`
    : `family-version:${productFamilyVersionId}`
}

const FAMILY_PICK_ID_PREFIXES = [
  'family-version:',
  'family-version-role:',
  'family:',
  'family-role:',
] as const

export function isFamilyPickId(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' && FAMILY_PICK_ID_PREFIXES.some((prefix) => value.startsWith(prefix))
  )
}

/**
 * The discovery-keyed forms, written by builder-inputs versions 2 and 3 and never again.
 *
 * `family:` alone is the oldest, unqualified by role. Both are recognized so a stored snapshot
 * still renders; neither can be turned back into a reviewed family, because the key they carry is
 * a grouping recomputed from labels rather than an identity — see `product-family.ts`.
 */
export function isLegacyFamilyPickId(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' && (value.startsWith('family:') || value.startsWith('family-role:'))
  )
}

export function isUnqualifiedLegacyFamilyPickId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('family:')
}

export function familyKeyFromPickId(value: string): string | null {
  if (isUnqualifiedLegacyFamilyPickId(value)) return value.slice('family:'.length)
  if (!value.startsWith('family-role:')) return null
  const roleSeparator = value.indexOf(':', 'family-role:'.length)
  return roleSeparator === -1 ? null : value.slice(roleSeparator + 1)
}

export function productFamilyVersionIdFromPickId(value: string): string | null {
  if (value.startsWith('family-version:')) return value.slice('family-version:'.length)
  if (!value.startsWith('family-version-role:')) return null
  const roleSeparator = value.indexOf(':', 'family-version-role:'.length)
  return roleSeparator === -1 ? null : value.slice(roleSeparator + 1)
}
