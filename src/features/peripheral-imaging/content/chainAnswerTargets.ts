import { isChainStopId, type ChainStopId } from './imagingChain'
import { imagingStageItems } from './stageItems'

/**
 * Which items are answered by choosing a stop on the chain map, and where each choice points.
 *
 * The ECMO rule (R4-OD-12): a mapping must be total over the item's choices. A map that can
 * express three of four answers is a trap, so an item qualifies only when every choice is a stop
 * on the chain — or an explicit off-chain option, which is a real answer and is nowhere on a
 * drawing, so the answer surface gives it a row with no pin. The keyed answer is never off-chain.
 */
export type ChainAnswerTarget =
  | { readonly choiceId: string; readonly stopId: ChainStopId }
  | { readonly choiceId: string; readonly offChain: true }

export function isOffChainTarget(
  target: ChainAnswerTarget,
): target is { readonly choiceId: string; readonly offChain: true } {
  return 'offChain' in target
}

const WALK_1: readonly ChainAnswerTarget[] = [
  { choiceId: 'a', stopId: 'beam' },
  { choiceId: 'b', stopId: 'detector' },
  { choiceId: 'c', stopId: 'display' },
]

const CAPSTONE_1: readonly ChainAnswerTarget[] = [
  { choiceId: 'a', stopId: 'patient' },
  { choiceId: 'b', stopId: 'source' },
  { choiceId: 'c', stopId: 'display' },
]

const targetsByItemId: Readonly<Record<string, readonly ChainAnswerTarget[]>> = {
  'chain-walk:walk-1': WALK_1,
  'good-image:walk-1': WALK_1,
  'suite-cases:capstone-1': CAPSTONE_1,
}

export function imagingChainAnswerTargets(itemId: string): readonly ChainAnswerTarget[] | null {
  return targetsByItemId[itemId] ?? null
}

export const imagingChainAnsweredItemIds: readonly string[] = Object.keys(targetsByItemId)

export function validateImagingChainAnswerTargets(): readonly string[] {
  const errors: string[] = []
  const allItems = Object.values(imagingStageItems).flatMap((items) => [
    items.prediction,
    items.transfer,
  ])
  for (const [itemId, targets] of Object.entries(targetsByItemId)) {
    const item = allItems.find((candidate) => candidate.id === itemId)
    if (!item) {
      errors.push(`Chain answer ${itemId} is not a stage item.`)
      continue
    }
    const choiceIds = new Set(item.choices.map((choice) => choice.id))
    const mapped = new Set<string>()
    const stops = new Set<string>()
    for (const target of targets) {
      if (!choiceIds.has(target.choiceId))
        errors.push(`Chain answer ${itemId} maps a choice that does not exist: ${target.choiceId}.`)
      if (mapped.has(target.choiceId))
        errors.push(`Chain answer ${itemId} maps ${target.choiceId} twice.`)
      mapped.add(target.choiceId)
      if (!isOffChainTarget(target)) {
        if (!isChainStopId(target.stopId))
          errors.push(`Chain answer ${itemId} points at an unknown stop.`)
        if (stops.has(target.stopId))
          errors.push(`Chain answer ${itemId} puts two choices on ${target.stopId}.`)
        stops.add(target.stopId)
      }
    }
    for (const choiceId of choiceIds) {
      if (!mapped.has(choiceId))
        errors.push(`Chain answer ${itemId} is not total: ${choiceId} has no place.`)
    }
    if (stops.size < 2) errors.push(`Chain answer ${itemId} offers fewer than two stops.`)
    const keyedTarget = targets.find((target) => target.choiceId === item.correctChoiceIds[0])
    if (keyedTarget && isOffChainTarget(keyedTarget)) {
      errors.push(`Chain answer ${itemId} keys the off-chain option, which the map cannot mark.`)
    }
  }
  return errors
}

const chainAnswerErrors = validateImagingChainAnswerTargets()
if (chainAnswerErrors.length > 0) {
  throw new Error(`The imaging chain answers are invalid:\n${chainAnswerErrors.join('\n')}`)
}
