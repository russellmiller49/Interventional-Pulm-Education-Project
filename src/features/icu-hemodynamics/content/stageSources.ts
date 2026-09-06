import { HEMODYNAMICS_CONTROL_PANEL } from './controlPanel'
import { HEMODYNAMICS_QUESTION_SORT } from './questionSort'
import { routeStop } from './routeSpine'
import { hemodynamicsSectionSpec, type HemodynamicsSectionId } from './sectionSpecs'
import { signalGrammarRows } from './signalGrammar'
import { hemodynamicsSectionItems } from './stageItems'
import { hemodynamicsStoryProblemsFor } from './storyProblems'
import { hemodynamicsSourceById, type HemodynamicsSource } from './sources'

/**
 * One source set per lesson, derived from the registries the lesson is built from.
 *
 * The stage cites the set once, in the shell footer, folded away. It is a derivation and not a
 * render-time collection, so a registry cannot forget to register: the section spec, both items,
 * every stop the section lights, every grammar row it highlights, the control panel where the
 * section introduces it, the question sort and the story problems all contribute, in the order
 * the lesson meets them. What each source is cited for is its registered use, shown only once the
 * prediction is committed — a record's own use sentence can name the mechanism a section asks
 * about.
 */
export interface HemodynamicsStageSources {
  readonly evidenceIds: readonly string[]
  readonly records: readonly HemodynamicsSource[]
}

export function hemodynamicsStageSources(
  sectionId: HemodynamicsSectionId,
): HemodynamicsStageSources {
  const spec = hemodynamicsSectionSpec(sectionId)
  const items = hemodynamicsSectionItems(sectionId)
  const ids: string[] = []
  const add = (candidates: readonly string[]) => {
    for (const id of candidates) if (!ids.includes(id)) ids.push(id)
  }
  add(spec.sourceIds)
  for (const stopId of spec.spineStops) add(routeStop(stopId).sourceIds)
  if (sectionId === 'pressure-system') add(HEMODYNAMICS_CONTROL_PANEL.sourceIds)
  if (sectionId === 'why-measure') add(HEMODYNAMICS_QUESTION_SORT.sourceIds)
  add(items.prediction.evidenceIds)
  add(items.transfer.evidenceIds)
  for (const row of signalGrammarRows) {
    if (spec.grammarRowIds.includes(row.id)) add(row.sourceIds)
  }
  for (const story of hemodynamicsStoryProblemsFor(sectionId)) add(story.item.evidenceIds)
  const records = ids.map((id) => {
    const record = hemodynamicsSourceById.get(id)
    if (!record) throw new Error(`Lesson ${sectionId} cites an unregistered source ${id}.`)
    return record
  })
  return { evidenceIds: ids, records }
}
