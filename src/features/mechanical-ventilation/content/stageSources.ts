import type { VentilatorDeviceId } from '../engine/types'
import { ventilationEvidenceById, type VentilationEvidenceReference } from './evidence'
import { ventilatorDeviceSources } from './deviceProfiles'
import { ventilationUnitById } from './learningCurriculum'

/**
 * Every source a section cites, for the footer that cites them all in one place.
 *
 * Derived from the registries rather than reported by the panes at render, so the set cannot go
 * stale behind a surface that quietly starts citing something new: the unit's own evidence, the
 * manufacturer source behind the console the learner is looking at, and the bounded-model record
 * that every section's boundary note rests on.
 */
export interface VentilationStageSources {
  /** Registry ids, in the order the section introduces them, deduplicated. */
  readonly evidenceIds: readonly string[]
  readonly records: readonly VentilationEvidenceReference[]
}

const MODEL_RECORD_ID = 'bounded-ventilation-model'

export function ventilationStageSources(
  unitId: string,
  deviceId: VentilatorDeviceId,
): VentilationStageSources {
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`Unknown unit ${unitId}`)
  const ids: string[] = []
  const push = (id: string) => {
    if (!ids.includes(id) && ventilationEvidenceById.has(id)) ids.push(id)
  }
  for (const id of unit.evidenceIds) push(id)
  for (const source of ventilatorDeviceSources) {
    if (source.deviceId === deviceId) push(source.id)
  }
  push(MODEL_RECORD_ID)
  const records = ids.map((id) => ventilationEvidenceById.get(id)!)
  return { evidenceIds: ids, records }
}
