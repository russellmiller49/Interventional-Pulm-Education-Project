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
 * A mapping must be *total* over its item's choices. That is the rule that decides which items
 * qualify, and it disqualifies most of them for a good reason: the two transfer items that ask
 * where a pattern localises each offer "there is not enough information to say", which is a real and
 * defensible answer and is nowhere on a circuit. An item like that keeps its list, because forcing
 * it onto the map would mean deleting the choice that teaches restraint.
 *
 * Validated at import: every choice mapped, every segment distinct, every segment drawn.
 */

export interface EcmoMapAnswerTarget {
  readonly choiceId: string
  readonly segmentId: EcmoCircuitSegmentId
}

const TARGETS: Readonly<Record<string, readonly EcmoMapAnswerTarget[]>> = {
  'ecmo.foundation.path.prediction': Object.freeze([
    { choiceId: 'drainage-side', segmentId: 'drainage' },
    { choiceId: 'between-pump-and-membrane', segmentId: 'pre-membrane' },
    { choiceId: 'after-membrane', segmentId: 'post-membrane' },
    { choiceId: 'in-the-gas-path', segmentId: 'gas-supply' },
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
    const segments = new Set(targets.map((target) => target.segmentId))
    if (segments.size !== targets.length) {
      errors.push(`${itemId}: two choices point at the same place, so the answer is ambiguous`)
    }
    for (const target of targets) {
      if (!drawn.has(target.segmentId)) {
        errors.push(
          `${itemId}: ${target.choiceId} points at ${target.segmentId}, which is not drawn`,
        )
      }
      if (!item.choices.some((choice) => choice.id === target.choiceId)) {
        errors.push(`${itemId}: ${target.choiceId} is not a choice of this item`)
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
