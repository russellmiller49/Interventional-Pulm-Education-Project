import { z } from 'zod'

/**
 * The Learn record: which sections have been worked through on this device, and where the learner
 * was last.
 *
 * The shared critical-care envelope cannot hold this. Its `authoritativeCriticalCareStatus`
 * downgrades a completion to in-progress for every activity whose completion evidence authority
 * is `none`, which is eight of the nine hemodynamics sections — so a "first incomplete section"
 * resolver over that store would offer section one forever. This record is the module's own, it
 * records completion and nothing else about the work (no commitments, no engine state; a reload
 * starts a section at its first step), and it lives under its own key so the case ledger
 * (`progress.ts`) and its migration are untouched.
 */
export const ICU_HEMODYNAMICS_LEARN_STORAGE_KEY = 'icu-hemodynamics-learn-v1'

const learnRecordSchema = z
  .object({
    version: z.literal(1),
    completedSectionIds: z.array(z.string().min(1).max(160)).max(64),
    lastSectionId: z.string().min(1).max(160).nullable(),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type IcuHemodynamicsLearnRecord = z.infer<typeof learnRecordSchema>

export const ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT = 'icu-hemodynamics-learn-changed'

export function createEmptyLearnRecord(): IcuHemodynamicsLearnRecord {
  return {
    version: 1,
    completedSectionIds: [],
    lastSectionId: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

export function parseLearnRecord(
  serialized: string | null | undefined,
): IcuHemodynamicsLearnRecord | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    const result = learnRecordSchema.safeParse(parsed)
    if (!result.success) return null
    return {
      ...result.data,
      completedSectionIds: [...new Set(result.data.completedSectionIds)],
    }
  } catch {
    return null
  }
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLearnRecord(): IcuHemodynamicsLearnRecord {
  const store = storage()
  if (!store) return createEmptyLearnRecord()
  try {
    return (
      parseLearnRecord(store.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)) ??
      createEmptyLearnRecord()
    )
  } catch {
    return createEmptyLearnRecord()
  }
}

export function writeLearnRecord(record: IcuHemodynamicsLearnRecord): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(
      ICU_HEMODYNAMICS_LEARN_STORAGE_KEY,
      JSON.stringify(learnRecordSchema.parse(record)),
    )
    window.dispatchEvent(new Event(ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function withSectionCompleted(
  record: IcuHemodynamicsLearnRecord,
  sectionId: string,
  now = new Date().toISOString(),
): IcuHemodynamicsLearnRecord {
  return {
    ...record,
    completedSectionIds: record.completedSectionIds.includes(sectionId)
      ? record.completedSectionIds
      : [...record.completedSectionIds, sectionId],
    lastSectionId: sectionId,
    updatedAt: now,
  }
}

export function withSectionVisited(
  record: IcuHemodynamicsLearnRecord,
  sectionId: string,
  now = new Date().toISOString(),
): IcuHemodynamicsLearnRecord {
  if (record.lastSectionId === sectionId) return record
  return { ...record, lastSectionId: sectionId, updatedAt: now }
}

export function isSectionCompleted(record: IcuHemodynamicsLearnRecord, sectionId: string): boolean {
  return record.completedSectionIds.includes(sectionId)
}
