import { z } from 'zod'

import { QUESTION_BY_ID } from '../data/questions'

/**
 * The module's own record: which sections have been worked through on this device, where the
 * learner was last, and the first decision recorded on every item they have committed.
 *
 * Nothing about a section in progress is stored. A reload starts a section at its first step and
 * asks its prediction again; what survives is the record of the outcome — the ECMO rule, kept
 * because the labs are pure functions of their sliders and a checkpoint would only carry a solved
 * Act past a reload. First decisions are write-once and their correctness is recomputed from the
 * item bank at read time, never trusted from storage. The draft's v1 record is read once and
 * migrated; its key is left in place so the draft still runs against it.
 */
export const PERIPHERAL_IMAGING_STORAGE_KEY = 'ip-peripheral-imaging-v2'
export const PERIPHERAL_IMAGING_STORAGE_KEY_V1 = 'ip-peripheral-imaging-v1'
export const PERIPHERAL_IMAGING_RECORD_CHANGED_EVENT = 'peripheral-imaging-record-changed'

const attemptKey = z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+$/)

const firstAttemptSchema = z
  .object({
    choiceId: z.string().min(1).max(40),
    correct: z.boolean(),
    at: z.string().min(1).max(64),
  })
  .strict()

const recordSchema = z
  .object({
    version: z.literal(2),
    completedSectionIds: z.array(z.string().min(1).max(160)).max(64),
    lastSectionId: z.string().min(1).max(160).nullable(),
    firstAttempts: z.record(attemptKey, firstAttemptSchema).default({}),
    capstoneDebriefViewedAt: z.string().min(1).max(64).nullable().default(null),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type ImagingRecord = z.infer<typeof recordSchema>
export type ImagingFirstAttempt = ImagingRecord['firstAttempts'][string]

export function createEmptyImagingRecord(): ImagingRecord {
  return {
    version: 2,
    completedSectionIds: [],
    lastSectionId: null,
    firstAttempts: {},
    capstoneDebriefViewedAt: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

/** The question behind an attempt key: everything after the first colon. */
export function questionIdOfAttemptKey(key: string): string {
  return key.slice(key.indexOf(':') + 1)
}

function recomputedAttempts(
  attempts: Readonly<Record<string, ImagingFirstAttempt>>,
): Record<string, ImagingFirstAttempt> {
  const result: Record<string, ImagingFirstAttempt> = {}
  for (const [key, attempt] of Object.entries(attempts)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const question = QUESTION_BY_ID[questionIdOfAttemptKey(key)]
    if (!question) continue
    if (!question.choices.some((choice) => choice.id === attempt.choiceId)) continue
    result[key] = { ...attempt, correct: attempt.choiceId === question.correct }
  }
  return result
}

export function parseImagingRecord(serialized: string | null | undefined): ImagingRecord | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    const result = recordSchema.safeParse(parsed)
    if (!result.success) return null
    return {
      ...result.data,
      completedSectionIds: [...new Set(result.data.completedSectionIds)],
      firstAttempts: recomputedAttempts(result.data.firstAttempts),
    }
  } catch {
    return null
  }
}

/**
 * The draft's record, read leniently: only the shapes the migration needs, never the draft's own
 * parser, whose "reviewed" filter re-checks a lesson's items against today's item list and would
 * strip credit earned under yesterday's.
 */
interface LegacyRecord {
  readonly lessonId: string | null
  readonly answers: Readonly<Record<string, { readonly choice: string; readonly correct: boolean }>>
  readonly reviewed: readonly string[]
}

export function parseLegacyImagingRecord(
  serialized: string | null | undefined,
): LegacyRecord | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object') return null
    const data = parsed as Record<string, unknown>
    if (data.version !== 1) return null
    const answers: Record<string, { choice: string; correct: boolean }> = {}
    if (data.answers && typeof data.answers === 'object') {
      for (const [key, value] of Object.entries(data.answers as Record<string, unknown>)) {
        if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(key)) continue
        if (!value || typeof value !== 'object') continue
        const choice = (value as { choice?: unknown }).choice
        if (typeof choice !== 'string' || choice.length === 0 || choice.length > 40) continue
        answers[key] = { choice, correct: false }
      }
    }
    const reviewed = Array.isArray(data.reviewed)
      ? data.reviewed.filter(
          (id): id is string => typeof id === 'string' && /^[a-z0-9-]+$/.test(id),
        )
      : []
    const lessonId =
      typeof data.lessonId === 'string' && data.lessonId.length > 0 ? data.lessonId : null
    return { lessonId, answers, reviewed }
  } catch {
    return null
  }
}

/**
 * The draft's record, carried forward: every committed answer becomes a first attempt under the
 * same key (the draft keyed answers `lesson:question` too), the eight case answers move under the
 * capstone, and every lesson the draft marked reviewed keeps its credit. Pending feedback, lab
 * values and the phase are dropped; they were the draft's checkpoint.
 */
export function migrateImagingRecordFromV1(
  legacy: LegacyRecord,
  now = new Date().toISOString(),
): ImagingRecord {
  const firstAttempts: Record<string, ImagingFirstAttempt> = {}
  for (const [key, attempt] of Object.entries(legacy.answers)) {
    const [lessonId, questionId] = key.split(':')
    if (!lessonId || !questionId) continue
    const target = lessonId === 'suite-cases' ? `capstone:${questionId}` : key
    firstAttempts[target] = { choiceId: attempt.choice, correct: attempt.correct, at: now }
  }
  return {
    version: 2,
    completedSectionIds: [...new Set(legacy.reviewed)],
    lastSectionId: legacy.lessonId,
    firstAttempts: recomputedAttempts(firstAttempts),
    capstoneDebriefViewedAt: null,
    updatedAt: now,
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

export function readImagingRecord(): ImagingRecord {
  const store = storage()
  if (!store) return createEmptyImagingRecord()
  try {
    const current = parseImagingRecord(store.getItem(PERIPHERAL_IMAGING_STORAGE_KEY))
    if (current) return current
    const legacy = store.getItem(PERIPHERAL_IMAGING_STORAGE_KEY_V1)
    const parsedLegacy = parseLegacyImagingRecord(legacy)
    if (parsedLegacy) return migrateImagingRecordFromV1(parsedLegacy)
    return createEmptyImagingRecord()
  } catch {
    return createEmptyImagingRecord()
  }
}

export function writeImagingRecord(record: ImagingRecord): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(PERIPHERAL_IMAGING_STORAGE_KEY, JSON.stringify(recordSchema.parse(record)))
    window.dispatchEvent(new Event(PERIPHERAL_IMAGING_RECORD_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function withSectionVisited(
  record: ImagingRecord,
  sectionId: string,
  now = new Date().toISOString(),
): ImagingRecord {
  if (record.lastSectionId === sectionId) return record
  return { ...record, lastSectionId: sectionId, updatedAt: now }
}

export function withSectionCompleted(
  record: ImagingRecord,
  sectionId: string,
  now = new Date().toISOString(),
): ImagingRecord {
  return {
    ...record,
    completedSectionIds: record.completedSectionIds.includes(sectionId)
      ? record.completedSectionIds
      : [...record.completedSectionIds, sectionId],
    lastSectionId: sectionId,
    updatedAt: now,
  }
}

/** Write-once: a key that already holds a decision keeps it. */
export function withFirstAttempt(
  record: ImagingRecord,
  key: string,
  choiceId: string,
  now = new Date().toISOString(),
): ImagingRecord {
  if (record.firstAttempts[key]) return record
  const question = QUESTION_BY_ID[questionIdOfAttemptKey(key)]
  if (!question) return record
  return {
    ...record,
    firstAttempts: {
      ...record.firstAttempts,
      [key]: { choiceId, correct: choiceId === question.correct, at: now },
    },
    updatedAt: now,
  }
}

export function withCapstoneDebriefViewed(
  record: ImagingRecord,
  now = new Date().toISOString(),
): ImagingRecord {
  if (record.capstoneDebriefViewedAt) return record
  return { ...record, capstoneDebriefViewedAt: now, updatedAt: now }
}

export function isSectionCompleted(record: ImagingRecord, sectionId: string): boolean {
  return record.completedSectionIds.includes(sectionId)
}

export function firstAttempt(record: ImagingRecord, key: string): ImagingFirstAttempt | undefined {
  return record.firstAttempts[key]
}
