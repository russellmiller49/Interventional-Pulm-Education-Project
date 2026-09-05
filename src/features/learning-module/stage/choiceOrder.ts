/**
 * Deterministic answer order.
 *
 * The keyed answer used to sit first in most authored items. Rotating the list by a hash of the
 * item id puts it somewhere else on each item without a shuffle — a shuffle would break authored
 * adjacencies (two choices that are meant to be read together) and would change between renders.
 * Rotation is cyclic, so every ordering is a valid reading of the same list.
 *
 * The rotated list must be what is *mounted*. CSS `order` would hand a screen-reader or keyboard
 * user a different "first" from the one a sighted learner sees.
 */

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function choiceOrderOffset(itemId: string, count: number): number {
  if (count <= 1) return 0
  return fnv1a(itemId) % count
}

export function orderChoices<T extends { readonly id: string }>(
  itemId: string,
  choices: readonly T[],
): readonly T[] {
  const offset = choiceOrderOffset(itemId, choices.length)
  if (offset === 0) return choices
  return [...choices.slice(offset), ...choices.slice(0, offset)]
}
