import type { EcmoCircuitSegmentId } from './circuitSegments'
import { ecmoCircuitSegments } from './circuitSegments'
import { ecmoFoundationLearningItems } from './foundationLearningItems'

/**
 * The items a learner answers by pointing at the circuit instead of reading a list.
 *
 * Some questions this module asks are about a place: "where in the blood path does the circuit
 * report pInt?" has four candidate answers and every one of them is somewhere on the drawing beside
 * the question. An owner review asked for exactly that — "click the location from a set of choices
 * in the animation instead of answering in the right panel" — and it is the better question either
 * way: naming a place from a list tests the words, pointing at it tests the thing.
 *
 * A mapping must be *total* over its item's choices, and at least two of them must be places. What
 * decides an item is therefore whether every one of its answers is expressible on the circuit —
 * either as somewhere on it, or as the explicit statement that the pattern does not point anywhere.
 *
 * That is why most items keep their lists. Their choices are statements ("very little — saturation
 * is one part of oxygen content"), directions ("flow should rise somewhat"), controls ("the
 * sweep-gas setting"), actions ("raise the pump speed until the flow comes back") or explanations
 * that carry their own expected findings. None of those is a place, and pointing at the circuit
 * cannot say them. Two more items did ask for a place, and were held back only by a "not enough
 * information" choice that the off-circuit option now expresses.
 *
 * Validated at import: every choice mapped, at least two places, every segment distinct and drawn.
 */

/**
 * A choice's place on the circuit, or the fact that it does not have one.
 *
 * "There is not enough information to localise it" is a real answer to "where does this localise",
 * and it is nowhere on a drawing. An item that offers it can still be answered on the map as long
 * as the answer surface can express it, so the surface has an off-circuit option: a row under the
 * legend, in the same radio group, saying the pattern does not point at a place.
 *
 * Answering a "where" question then includes deciding whether the answer is a where at all, which
 * is the discrimination those two items were written for.
 */
export type EcmoMapAnswerTarget =
  | { readonly choiceId: string; readonly segmentId: EcmoCircuitSegmentId }
  | { readonly choiceId: string; readonly offCircuit: true }

export function isOffCircuitTarget(
  target: EcmoMapAnswerTarget,
): target is { readonly choiceId: string; readonly offCircuit: true } {
  return 'offCircuit' in target
}

const TARGETS: Readonly<Record<string, readonly EcmoMapAnswerTarget[]>> = {
  // "Where in the blood path does the circuit report pInt?"
  'ecmo.foundation.path.prediction': Object.freeze([
    { choiceId: 'drainage-side', segmentId: 'drainage' },
    { choiceId: 'between-pump-and-membrane', segmentId: 'pre-membrane' },
    { choiceId: 'after-membrane', segmentId: 'post-membrane' },
    { choiceId: 'in-the-gas-path', segmentId: 'gas-supply' },
  ]),
  // "Which part of the circuit does that pattern indicate?" — two pressures rising together.
  'ecmo.foundation.path.transfer': Object.freeze([
    { choiceId: 'drainage', segmentId: 'drainage' },
    { choiceId: 'membrane', segmentId: 'membrane' },
    { choiceId: 'return-side', segmentId: 'return' },
    { choiceId: 'not-enough', offCircuit: true },
  ]),
  // "Where does that pattern localise?" — speed raised twice, drainage falling, flow flat.
  'ecmo.foundation.pump.transfer': Object.freeze([
    { choiceId: 'drainage-preload', segmentId: 'drainage' },
    { choiceId: 'membrane-resistance', segmentId: 'membrane' },
    { choiceId: 'return-resistance', segmentId: 'return' },
    { choiceId: 'insufficient-information', offCircuit: true },
  ]),
}

export function ecmoMapAnswerTargets(itemId: string): readonly EcmoMapAnswerTarget[] | null {
  return TARGETS[itemId] ?? null
}

/** Every item that is answered on the map, for tests and for the pathway audit. */
export const ecmoMapAnsweredItemIds: readonly string[] = Object.freeze(Object.keys(TARGETS))

/** Import-time checks the type system cannot express. */
export function validateEcmoMapAnswerTargets(): string[] {
  const errors: string[] = []
  const drawn = new Set(ecmoCircuitSegments.map((segment) => segment.id))
  const itemsById = new Map(
    Object.values(ecmoFoundationLearningItems).flatMap((items) =>
      [items.prediction, items.transfer].map((item) => [item.id, item] as const),
    ),
  )
  for (const [itemId, targets] of Object.entries(TARGETS)) {
    const item = itemsById.get(itemId)
    if (!item) {
      errors.push(`${itemId}: no foundation learning item carries this id`)
      continue
    }
    const mapped = new Set(targets.map((target) => target.choiceId))
    if (mapped.size !== targets.length) errors.push(`${itemId}: a choice is mapped twice`)
    const placed = targets.flatMap((target) => (isOffCircuitTarget(target) ? [] : [target]))
    const segments = new Set(placed.map((target) => target.segmentId))
    if (segments.size !== placed.length) {
      errors.push(`${itemId}: two choices point at the same place, so the answer is ambiguous`)
    }
    // Two places at least, or the map is not being used to answer anything.
    if (placed.length < 2) {
      errors.push(`${itemId}: fewer than two choices are places, so this item belongs in a list`)
    }
    for (const target of targets) {
      if (!item.choices.some((choice) => choice.id === target.choiceId)) {
        errors.push(`${itemId}: ${target.choiceId} is not a choice of this item`)
      }
      if (isOffCircuitTarget(target)) continue
      if (!drawn.has(target.segmentId)) {
        errors.push(
          `${itemId}: ${target.choiceId} points at ${target.segmentId}, which is not drawn`,
        )
      }
    }
    // Total, or the item keeps its list: a map that can express three of four answers is a trap.
    for (const choice of item.choices) {
      if (!mapped.has(choice.id)) {
        errors.push(`${itemId}: ${choice.id} has nowhere on the circuit to point at`)
      }
    }
  }
  return errors
}

const mapAnswerErrors = validateEcmoMapAnswerTargets()
if (mapAnswerErrors.length > 0) {
  throw new Error(`ecmoMapAnswerTargets registry invalid:\n${mapAnswerErrors.join('\n')}`)
}
