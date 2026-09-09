import { SOURCE_BY_ID } from '../data/sources'
import type { Source, SourceId } from '../types'
import { chainStop } from './imagingChain'
import { IMAGING_CONTROL_PANEL } from './controlPanel'
import { IMAGING_GRAMMAR } from './grammar'
import { imagingLesson, type ImagingSectionId } from './pathway'
import { imagingSectionSpec } from './sectionSpecs'
import { imagingSortFor } from './sorts'
import { imagingSectionItems } from './stageItems'
import { classifyTeachingBlocks } from './teachingBlocks'

/**
 * One source set per section, derived from the registries the section is built from.
 *
 * The stage cites the set once, in the shell footer, folded away. It is a derivation and not a
 * render-time collection, so a registry cannot forget to register: the spec, the stops it lights,
 * the grammar rows it highlights, the control panel where it is introduced, its sort, both items
 * and every teaching block contribute, in the order the section meets them. What each source is
 * cited for is shown only once the prediction is committed.
 */
export interface ImagingStageSources {
  readonly evidenceIds: readonly SourceId[]
  readonly records: readonly Source[]
}

export function imagingStageSources(sectionId: ImagingSectionId): ImagingStageSources {
  const spec = imagingSectionSpec(sectionId)
  const lesson = imagingLesson(sectionId)
  const items = imagingSectionItems(sectionId)
  const ids: SourceId[] = []
  const add = (candidates: readonly string[]) => {
    for (const id of candidates) if (!ids.includes(id as SourceId)) ids.push(id as SourceId)
  }
  add(spec.sourceIds)
  for (const stopId of spec.chainStops) add(chainStop(stopId).sourceIds)
  if (sectionId === 'good-image') add(IMAGING_CONTROL_PANEL.sourceIds)
  const sort = imagingSortFor(sectionId)
  if (sort) add(sort.sourceIds)
  add(items.prediction.evidenceIds)
  add(items.transfer.evidenceIds)
  for (const row of IMAGING_GRAMMAR) if (spec.grammarRowIds.includes(row.id)) add(row.sourceIds)
  for (const entry of classifyTeachingBlocks(lesson)) add(entry.block.sources)
  const records = ids.map((id) => {
    const record = SOURCE_BY_ID.get(id)
    if (!record) throw new Error(`Section ${sectionId} cites an unregistered source ${id}.`)
    return record
  })
  return { evidenceIds: ids, records }
}
