import { z } from 'zod'

import type { InspectionLedger } from '../components/scope/types'
import { isBronchSectionId } from '../content/sectionIds'
import { forwardSectionId, forwardSectionIds } from '../content/sectionMigration'
import { inspectionSnapshotSchema, type BronchInspectionSnapshot } from './learnProgress'

/**
 * The module's only learner record under the self-paced contract (BF-01).
 *
 * It holds where the learner was, which sections they opened, which they marked reviewed or for
 * review later, and the lower-airway survey they actually finished — the one simulation record a
 * later exercise (a report from your own survey) reads. Nothing about answers, hints, retries,
 * explanations opened, activities moved past or how the scope was driven is stored, and nothing
 * here is a grade or evidence of skill.
 *
 * "Reviewed" is the learner's own mark. Finishing a section sets it and the learner can undo it; it
 * says the learner has been through the section, never that anything in it was done or answered.
 */
export const BRONCH_SELF_PACED_STORAGE_KEY = 'ip-bronchoscopy-foundations-self-paced-v1'
export const BRONCH_SELF_PACED_CHANGED_EVENT = 'bronchoscopy-foundations-self-paced-changed'

const sectionIdList = z.array(z.string().min(1).max(160)).max(64)

const recordSchema = z
  .object({
    version: z.literal(1),
    lastSectionId: z.string().min(1).max(160).nullable(),
    visitedSectionIds: sectionIdList,
    reviewedSectionIds: sectionIdList,
    reviewLaterSectionIds: sectionIdList,
    surveySnapshot: inspectionSnapshotSchema.nullable(),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type BronchSelfPacedRecord = z.infer<typeof recordSchema>

export function createEmptyBronchSelfPacedRecord(): BronchSelfPacedRecord {
  return {
    version: 1,
    lastSectionId: null,
    visitedSectionIds: [],
    reviewedSectionIds: [],
    reviewLaterSectionIds: [],
    surveySnapshot: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

function knownSections(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => isBronchSectionId(id)))]
}

export function parseBronchSelfPacedRecord(
  serialized: string | null | undefined,
): BronchSelfPacedRecord | null {
  if (!serialized) return null
  try {
    const result = recordSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return null
    const { data } = result
    // A retired section leads to the one that absorbed it: the saved place, the sections opened
    // and the review-later marks carry forward. "Reviewed" does not: the learner has not been
    // through the section that replaced it.
    return {
      ...data,
      lastSectionId: data.lastSectionId ? forwardSectionId(data.lastSectionId) : null,
      visitedSectionIds: forwardSectionIds(data.visitedSectionIds),
      reviewedSectionIds: knownSections(data.reviewedSectionIds),
      reviewLaterSectionIds: forwardSectionIds(data.reviewLaterSectionIds),
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

export function readBronchSelfPacedRecord(): BronchSelfPacedRecord {
  const store = storage()
  if (!store) return createEmptyBronchSelfPacedRecord()
  try {
    return (
      parseBronchSelfPacedRecord(store.getItem(BRONCH_SELF_PACED_STORAGE_KEY)) ??
      createEmptyBronchSelfPacedRecord()
    )
  } catch {
    return createEmptyBronchSelfPacedRecord()
  }
}

/** Returns false when the device refuses storage; learning carries on either way. */
export function writeBronchSelfPacedRecord(record: BronchSelfPacedRecord): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(BRONCH_SELF_PACED_STORAGE_KEY, JSON.stringify(recordSchema.parse(record)))
    window.dispatchEvent(new Event(BRONCH_SELF_PACED_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

function withId(ids: readonly string[], id: string, on: boolean): readonly string[] {
  if (ids.includes(id) === on) return ids
  return on ? [...ids, id] : ids.filter((entry) => entry !== id)
}

/** Opening a section: where the learner is now, and a section visited. Nothing about what was done. */
export function withSectionOpened(
  record: BronchSelfPacedRecord,
  sectionId: string,
  now = new Date().toISOString(),
): BronchSelfPacedRecord {
  if (!isBronchSectionId(sectionId)) return record
  if (record.lastSectionId === sectionId && record.visitedSectionIds.includes(sectionId))
    return record
  return {
    ...record,
    lastSectionId: sectionId,
    visitedSectionIds: [...withId(record.visitedSectionIds, sectionId, true)],
    updatedAt: now,
  }
}

export function withSectionReviewed(
  record: BronchSelfPacedRecord,
  sectionId: string,
  reviewed: boolean,
  now = new Date().toISOString(),
): BronchSelfPacedRecord {
  if (!isBronchSectionId(sectionId)) return record
  if (record.reviewedSectionIds.includes(sectionId) === reviewed) return record
  return {
    ...record,
    reviewedSectionIds: [...withId(record.reviewedSectionIds, sectionId, reviewed)],
    updatedAt: now,
  }
}

export function withReviewLater(
  record: BronchSelfPacedRecord,
  sectionId: string,
  on: boolean,
  now = new Date().toISOString(),
): BronchSelfPacedRecord {
  if (!isBronchSectionId(sectionId)) return record
  if (record.reviewLaterSectionIds.includes(sectionId) === on) return record
  return {
    ...record,
    reviewLaterSectionIds: [...withId(record.reviewLaterSectionIds, sectionId, on)],
    updatedAt: now,
  }
}

/**
 * The learner's own finished survey. The host saves it only when the survey's goals were met on
 * the learner's controls, never from a demonstration or a step moved past.
 */
export function withSurveySnapshot(
  record: BronchSelfPacedRecord,
  ledger: InspectionLedger,
  now = new Date().toISOString(),
): BronchSelfPacedRecord {
  return {
    ...record,
    surveySnapshot: {
      sectionId: 'systematic-survey',
      at: now,
      rows: Object.values(ledger).filter((row) => row !== undefined),
    },
    updatedAt: now,
  }
}

/**
 * The finished survey the report exercise may use: only this record's, saved when the learner met
 * the survey's goals on their own controls. A survey saved under the earlier record stays on the
 * device unread (BF-03). That record saved it with a section completion that never separated the
 * learner's commands from a start state or a scripted path, so it cannot stand in for the learner's
 * own survey.
 */
export function availableSurveySnapshot(
  record: BronchSelfPacedRecord,
): BronchInspectionSnapshot | null {
  return record.surveySnapshot
}

/**
 * The screen the learner had reached inside each section, so a reload or a return opens there and
 * not at the section's first screen. It is a place only: the id of a screen, by section. No answer,
 * attempt or scope position is kept, and the screen opens fresh.
 *
 * It has its own key, apart from the record above. The record's shape is strict, so a field added
 * to it would make a browser still running an earlier bundle discard the whole record.
 */
export const BRONCH_PLACE_STORAGE_KEY = 'ip-bronchoscopy-foundations-place-v1'

const placeSchema = z.record(z.string().min(1).max(160), z.string().min(1).max(200))

function readPlaces(): Record<string, string> {
  const store = storage()
  if (!store) return {}
  try {
    const result = placeSchema.safeParse(
      JSON.parse(store.getItem(BRONCH_PLACE_STORAGE_KEY) ?? '{}'),
    )
    if (!result.success) return {}
    return Object.fromEntries(
      Object.entries(result.data).filter(([sectionId]) => isBronchSectionId(sectionId)),
    )
  } catch {
    return {}
  }
}

function writePlaces(places: Record<string, string>): boolean {
  const store = storage()
  if (!store) return false
  try {
    if (Object.keys(places).length === 0) store.removeItem(BRONCH_PLACE_STORAGE_KEY)
    else store.setItem(BRONCH_PLACE_STORAGE_KEY, JSON.stringify(placeSchema.parse(places)))
    return true
  } catch {
    return false
  }
}

/** The id of the screen the learner had reached in this section, or null to start at the first. */
export function readBronchSectionPlace(sectionId: string): string | null {
  return readPlaces()[sectionId] ?? null
}

/** Keeps the screen reached in a section; `null` forgets it, so the section opens at its start. */
export function writeBronchSectionPlace(sectionId: string, stepId: string | null): boolean {
  if (!isBronchSectionId(sectionId)) return false
  const places = readPlaces()
  if ((places[sectionId] ?? null) === stepId) return true
  if (stepId === null) delete places[sectionId]
  else places[sectionId] = stepId
  return writePlaces(places)
}

/** Forgets the place in every section: the course opens each one at its first screen again. */
export function clearBronchSectionPlaces(): boolean {
  return writePlaces({})
}
