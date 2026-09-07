import { isRouteStopId, type RouteStopId } from './routeSpine'
import { hemodynamicsStageItems } from './stageItems'

/**
 * Which items are answered by pointing at the catheter map, and where each choice points.
 *
 * The rule from the ECMO rebuild (R4-OD-12): a mapping must be total over the item's choices. A
 * map that can express three of four answers is a trap, so an item qualifies only when every one
 * of its choices is a place on the spine — or an explicit off-map option ("it cannot be named"),
 * which is a real answer and is nowhere on a drawing, so the answer surface gives it a row under
 * the legend with no pin. Naming a place from a list tests the words; pointing at it tests the
 * thing.
 */
export type HemodynamicsMapAnswerTarget =
  | { readonly choiceId: string; readonly stopId: RouteStopId }
  | { readonly choiceId: string; readonly offMap: true }

export function isOffMapTarget(
  target: HemodynamicsMapAnswerTarget,
): target is { readonly choiceId: string; readonly offMap: true } {
  return 'offMap' in target
}

const targetsByItemId: Readonly<Record<string, readonly HemodynamicsMapAnswerTarget[]>> = {
  'hd-place-predict-1': [
    { choiceId: 'ra', stopId: 'ra' },
    { choiceId: 'rv', stopId: 'rv' },
    { choiceId: 'pa', stopId: 'pa' },
    { choiceId: 'wedge', stopId: 'wedge' },
    { choiceId: 'cannot-name', offMap: true },
  ],
  'hd-place-transfer-1': [
    { choiceId: 'wedge', stopId: 'wedge' },
    { choiceId: 'right-atrium', stopId: 'ra' },
    { choiceId: 'right-ventricle', stopId: 'rv' },
    { choiceId: 'cannot-name', offMap: true },
  ],
}

export function hemodynamicsMapAnswerTargets(
  itemId: string,
): readonly HemodynamicsMapAnswerTarget[] | null {
  return targetsByItemId[itemId] ?? null
}

export const hemodynamicsMapAnsweredItemIds: readonly string[] = Object.keys(targetsByItemId)

export function validateHemodynamicsMapAnswerTargets(): readonly string[] {
  const errors: string[] = []
  const allItems = Object.values(hemodynamicsStageItems).flatMap((items) => [
    items.prediction,
    items.transfer,
  ])
  for (const [itemId, targets] of Object.entries(targetsByItemId)) {
    const item = allItems.find((candidate) => candidate.id === itemId)
    if (!item) {
      errors.push(`Map answer ${itemId} is not a stage item.`)
      continue
    }
    const choiceIds = new Set(item.choices.map((choice) => choice.id))
    const mapped = new Set<string>()
    const stops = new Set<string>()
    for (const target of targets) {
      if (!choiceIds.has(target.choiceId)) {
        errors.push(`Map answer ${itemId} maps a choice that does not exist: ${target.choiceId}.`)
      }
      if (mapped.has(target.choiceId)) {
        errors.push(`Map answer ${itemId} maps ${target.choiceId} twice.`)
      }
      mapped.add(target.choiceId)
      if (!isOffMapTarget(target)) {
        if (!isRouteStopId(target.stopId)) {
          errors.push(`Map answer ${itemId} points at an unknown stop ${String(target.stopId)}.`)
        }
        if (stops.has(target.stopId)) {
          errors.push(`Map answer ${itemId} puts two choices on ${target.stopId}.`)
        }
        stops.add(target.stopId)
      }
    }
    for (const choiceId of choiceIds) {
      if (!mapped.has(choiceId)) {
        errors.push(`Map answer ${itemId} is not total: ${choiceId} has no place.`)
      }
    }
    if (stops.size < 2) errors.push(`Map answer ${itemId} offers fewer than two places.`)
    const keyed = item.correctChoiceIds[0]
    const keyedTarget = targets.find((target) => target.choiceId === keyed)
    if (keyedTarget && isOffMapTarget(keyedTarget)) {
      errors.push(`Map answer ${itemId} keys the off-map option, which the map cannot mark.`)
    }
  }
  return errors
}

const mapAnswerErrors = validateHemodynamicsMapAnswerTargets()
if (mapAnswerErrors.length > 0) {
  throw new Error(`Hemodynamics map answers are invalid:\n${mapAnswerErrors.join('\n')}`)
}
