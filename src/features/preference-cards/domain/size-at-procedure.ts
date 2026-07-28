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

/** Family-level pick id, distinct from a product id so the two can never be confused. */
export function familyPickId(familyKey: string): string {
  return `family:${familyKey}`
}

export function isFamilyPickId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('family:')
}

export function familyKeyFromPickId(value: string): string | null {
  return isFamilyPickId(value) ? value.slice('family:'.length) : null
}
