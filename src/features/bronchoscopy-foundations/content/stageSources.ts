import { formatSourceRef, SOURCE_BY_ID, type BronchSource, type SourceRef } from '../data/sources'
import { SCOPE_CONTROL_PANEL } from './controlPanel'
import { BRONCH_GRAMMAR } from './grammar'
import { bronchSection, type BronchSectionId } from './pathway'
import { spineStop } from './spine'
import type { BronchAct } from './types'

/**
 * One source set per section, derived from the registries the section is built from.
 *
 * The stage cites the set once, in the shell footer, folded away. It is a derivation, not a
 * render-time collection, so a registry cannot forget to register: the teaching blocks, both
 * items, the Act's own sources, the spine stops the section lights, the grammar rows it
 * highlights and the control panel where it is introduced all contribute, in the order the
 * section meets them. What each source is cited for is shown only once the prediction is
 * committed.
 */
export interface BronchStageSourceRecord {
  readonly source: BronchSource
  /** Every location the section cites in this source, formatted, in first-cited order. */
  readonly locations: readonly string[]
}

export interface BronchStageSources {
  readonly evidenceIds: readonly string[]
  readonly records: readonly BronchStageSourceRecord[]
}

function actSourceRefs(act: BronchAct): readonly SourceRef[] {
  switch (act.kind) {
    case 'sort':
      return act.sort.sourceRefs
    case 'identify':
      return act.identify.sourceRefs
    case 'sequence':
      return act.sequence.sourceRefs
    case 'ledger':
      return act.ledger.sourceRefs
    case 'report':
      return act.report.sourceRefs
    case 'scenario':
      return act.scenario.sourceRefs
    case 'scope-lab':
      return []
  }
}

const cache = new Map<BronchSectionId, BronchStageSources>()

export function bronchStageSources(sectionId: BronchSectionId): BronchStageSources {
  const cached = cache.get(sectionId)
  if (cached) return cached
  const section = bronchSection(sectionId)
  const ids: string[] = []
  const locations = new Map<string, string[]>()
  const add = (refs: readonly SourceRef[]) => {
    for (const ref of refs) {
      if (!ids.includes(ref.sourceId)) {
        ids.push(ref.sourceId)
        locations.set(ref.sourceId, [])
      }
      const formatted = formatSourceRef(ref)
      const list = locations.get(ref.sourceId)!
      if (!list.includes(formatted)) list.push(formatted)
    }
  }
  for (const block of section.blocks) add(block.sourceRefs)
  add(section.prediction.sourceRefs)
  add(actSourceRefs(section.act))
  add(section.transfer.sourceRefs)
  for (const stopId of section.spineStops) add(spineStop(stopId).sourceRefs)
  for (const row of BRONCH_GRAMMAR) if (section.grammarRowIds.includes(row.id)) add(row.sourceRefs)
  if (sectionId === 'five-controls') add(SCOPE_CONTROL_PANEL.sourceRefs)
  const records = ids.map((id) => {
    const source = SOURCE_BY_ID.get(id)
    if (!source) throw new Error(`Section ${sectionId} cites an unregistered source ${id}.`)
    return { source, locations: locations.get(id) ?? [] }
  })
  const built = { evidenceIds: ids, records }
  cache.set(sectionId, built)
  return built
}
