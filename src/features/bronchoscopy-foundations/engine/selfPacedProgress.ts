import { z } from 'zod'

import type { InspectionLedger } from '../components/scope/types'
import { isBronchSectionId } from '../content/sectionIds'
import {
  inspectionSnapshotSchema,
  readBronchRecord,
  type BronchInspectionSnapshot,
} from './learnProgress'

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
    return {
      ...data,
      lastSectionId:
        data.lastSectionId && isBronchSectionId(data.lastSectionId) ? data.lastSectionId : null,
      visitedSectionIds: knownSections(data.visitedSectionIds),
      reviewedSectionIds: knownSections(data.reviewedSectionIds),
      reviewLaterSectionIds: knownSections(data.reviewLaterSectionIds),
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
 * The finished survey the report exercise may use: this record's, or else one saved under the
 * earlier record, read without rewriting it.
 */
export function availableSurveySnapshot(
  record: BronchSelfPacedRecord,
): BronchInspectionSnapshot | null {
  return record.surveySnapshot ?? readBronchRecord().inspectionSnapshot
}
