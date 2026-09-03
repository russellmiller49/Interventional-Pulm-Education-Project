/**
 * Deterministic answer-order balancing for authored choice sets.
 *
 * Every authored item in this module — the twenty Learn predictions, the twenty foundation
 * predict/transfer items and the forty-two Practice reassessment sets — lists its best choice
 * first. That is the most common authoring artifact there is, and a learner finds it within a
 * handful of items: "always pick the first option" becomes a strategy that outperforms reading.
 * The authored order is kept (it is what the rationales, the teaching panels and the tests are
 * written against); what changes is where the list *starts* when it is rendered.
 *
 * Why a cyclic rotation rather than a permutation
 *
 * A full shuffle would remove the position cue just as well, but it would also scramble the
 * neighbour relationships the author chose: the harmful reflex placed beside the best option so
 * the contrast reads, two mechanisms that pair with each other, "not enough information" kept at
 * the end. A rotation keeps every adjacency (cyclically) and moves only the starting point, so the
 * best choice still lands at a different position from item to item while each set reads the way
 * it was written. It is also trivially reversible for anyone debugging a rendered list — displayed
 * index to authored index is one subtraction — and it needs no per-choice state.
 *
 * Why the offset is a hash of the item id
 *
 * No random number generator, no storage, no dependence on render count or session. The same
 * learner sees the same order for the same item every time it is opened, a lesson re-read stays
 * consistent with the first read, and the walkthrough tests stay deterministic. Different items
 * hash to different offsets, which is what spreads the best choice across positions over an item
 * set. FNV-1a is used because it is tiny, dependency-free and already the hash this repository
 * reaches for; it runs over UTF-16 code units, which for the ASCII ids this module uses is
 * byte-identical to the reference algorithm.
 *
 * The renderer must reorder the DOM, not the presentation
 *
 * The rotated list has to be what is *mounted*, in that order. CSS `order` or a reversed flex
 * direction would move the options visually while leaving the DOM in authored order, and then a
 * sighted learner, a screen-reader user and a keyboard user (arrow keys in a radio group follow DOM
 * order) would each be offered a different "first" option — and the screen-reader user would be
 * handed the very cue this removes. Map over `orderChoices(...)` when rendering; never over the
 * authored array with a style applied afterwards.
 *
 * Neither function touches ids, labels or any other field: a committed choice id resolves to the
 * same rationale, commitment and verdict regardless of where it was displayed.
 */

const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

/**
 * The position the rendered list starts from, as an authored index in `[0, count)`.
 *
 * Returns `0` when there is nothing to rotate (`count` ≤ 1, or not a positive integer), so a
 * degenerate set renders exactly as authored.
 */
export function choiceOrderOffset(itemId: string, count: number): number {
  if (!Number.isInteger(count) || count <= 1) return 0
  let hash = FNV_OFFSET_BASIS
  for (let index = 0; index < itemId.length; index += 1) {
    hash ^= itemId.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0) % count
}

/**
 * The authored choices, cyclically rotated so that rendering starts at `choiceOrderOffset`.
 *
 * Pure: the input array is never mutated, the elements are the same objects (not copies), and the
 * result for a given `itemId` and set is identical on every call. When the offset is `0` the
 * authored array is returned as it is.
 */
export function orderChoices<T extends { readonly id: string }>(
  itemId: string,
  choices: readonly T[],
): readonly T[] {
  const offset = choiceOrderOffset(itemId, choices.length)
  if (offset === 0) return choices
  return [...choices.slice(offset), ...choices.slice(0, offset)]
}
