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
 * The one-argument form is the persisted v1 identity and remains stable for the common case
 * where a line is selected for one role. A role-qualified identity is used only when the same
 * family key is selected for multiple role-scoped slices with different variant metadata.
 */
export function familyPickId(familyKey: string, roleCode?: string): string {
  return roleCode ? `family-role:${roleCode}:${familyKey}` : `family:${familyKey}`
}

export function isFamilyPickId(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' && (value.startsWith('family:') || value.startsWith('family-role:'))
  )
}

export function isLegacyFamilyPickId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('family:')
}

export function familyKeyFromPickId(value: string): string | null {
  if (isLegacyFamilyPickId(value)) return value.slice('family:'.length)
  if (!value.startsWith('family-role:')) return null
  const roleSeparator = value.indexOf(':', 'family-role:'.length)
  return roleSeparator === -1 ? null : value.slice(roleSeparator + 1)
}
