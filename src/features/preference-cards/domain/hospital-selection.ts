import type { BuildContext, RecipeSlot } from './types'

/**
 * Turning "whatever the local formulary ranks first" into a decision the card records.
 *
 * A requirement with no explicit selection used to resolve to `options[0]` — the active option
 * for its role with the lowest `preferenceRank`, ties broken by option id. That is a reasonable
 * *default* and an indefensible *pin*: the card stored nothing, so reopening it a year later
 * re-ran the same expression against a formulary that had since been re-ranked, and the card
 * silently changed which product it asked for. Nothing about the stored card had moved; the
 * ranking underneath it had.
 *
 * The fix is not to freeze the ranking — preference rank is hospital-local content and is
 * *supposed* to be current. It is to make the choice explicit at the moment it is actually
 * made. The builder computes the default once, writes the resulting hospital-item id into
 * `selectedHospitalItemIds`, and from then on the card says which item it means.
 *
 * `null` is a real value here and not the absence of one: it records that a requirement was
 * deliberately left unselected, which is a different statement from "nobody has looked at this
 * yet" and has to survive a round trip.
 */

/**
 * The selections a resolved card actually made, ready to be stored as explicit choices.
 *
 * Read from the resolved card rather than recomputed from the composition, and that is the
 * whole point: the card's item list includes the requirements a modifier or rescue module
 * added, which no expression over the composition alone can produce. Densifying from anything
 * else would record a decision for the lines the composition knows about and leave the
 * modifier-added ones to a fallback — which is the implicit behaviour this replaces.
 *
 * So what gets stored is exactly what the physician saw resolved in the preview.
 *
 * `suppressedItems` counts too. A requirement a kit covers is still a requirement the card
 * made a choice about — suppression is a statement about the kit supplying it, not about the
 * choice being absent — and dropping those would leave exactly the suppressed lines on the
 * fallback, so a re-ranked formulary could change which item a kit was judged to cover.
 */
export function selectionsFromResolvedCard(card: {
  items: Array<{ id: string; selectedHospitalItemId: string | null }>
  suppressedItems: Array<{ id: string; selectedHospitalItemId: string | null }>
}): Record<string, string | null> {
  return Object.fromEntries(
    [...card.items, ...card.suppressedItems].map((item) => [item.id, item.selectedHospitalItemId]),
  )
}

/** The option a requirement would default to, by the local formulary's own ranking. */
export function preferredOptionItemId(slot: RecipeSlot, context: BuildContext): string | null {
  const best = context.hospitalRoleOptions
    .filter((option) => option.active && option.roleCode === slot.roleCode)
    .sort(
      (left, right) =>
        left.preferenceRank - right.preferenceRank || left.id.localeCompare(right.id),
    )[0]
  return best?.hospitalItemId ?? null
}

/**
 * Fill in a selection for every requirement that does not already record one.
 *
 * Existing entries are never overwritten, including explicit `null`s — a physician who cleared
 * a line meant it, and recomputing the default over the top would undo the decision every time
 * the card was reopened. Only requirements the card has never expressed an opinion about get a
 * default, which is exactly the set that used to be resolved implicitly.
 */
export function materializeHospitalSelections(
  slots: RecipeSlot[],
  context: BuildContext,
  existing: Record<string, string | null> | undefined,
): Record<string, string | null> {
  const materialized: Record<string, string | null> = { ...(existing ?? {}) }
  for (const slot of slots) {
    if (Object.prototype.hasOwnProperty.call(materialized, slot.id)) continue
    materialized[slot.id] = preferredOptionItemId(slot, context)
  }
  return materialized
}
