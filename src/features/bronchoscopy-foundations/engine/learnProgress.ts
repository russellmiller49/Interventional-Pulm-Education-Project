import { z } from 'zod'

import { bronchItem } from '../content/stageItems'

/**
 * The module's own record: which sections have been worked through on this device, where the
 * learner was last, the first decision recorded on every item they have committed, and — for a
 * section worked on the simulator — how it was driven (A18: the input modes and the assists used,
 * so a summary can say "keyboard, assisted (centerline lock)" rather than claim an unaided run).
 *
 * Nothing about a section in progress is stored. A reload starts a section at its first step and
 * asks its prediction again; what survives is the record of the outcome. First decisions are
 * write-once and their correctness is recomputed from the item bank at read time, never trusted
 * from storage.
 *
 * The earlier course's record (`ip-intro-bronchoscopy-progress-v1`) is deliberately NOT read: its
 * booleans were hand toggles, and importing them would manufacture completion (A20).
 */
export const BRONCH_STORAGE_KEY = 'ip-bronchoscopy-foundations-v1'
export const BRONCH_RECORD_CHANGED_EVENT = 'bronchoscopy-foundations-record-changed'

const attemptKey = z.string().regex(/^[a-z0-9-]+:[A-Za-z0-9._-]+$/)

const firstAttemptSchema = z
  .object({
    choiceId: z.string().min(1).max(40),
    correct: z.boolean(),
    at: z.string().min(1).max(64),
  })
  .strict()

const performanceSchema = z
  .object({
    inputModes: z.array(z.string().min(1).max(24)).max(8),
    assistsUsed: z.array(z.string().min(1).max(40)).max(12),
    unaided: z.boolean(),
  })
  .strict()

const recordSchema = z
  .object({
    version: z.literal(1),
    completedSectionIds: z.array(z.string().min(1).max(160)).max(64),
    lastSectionId: z.string().min(1).max(160).nullable(),
    firstAttempts: z.record(attemptKey, firstAttemptSchema).default({}),
    sectionPerformance: z.record(z.string().min(1).max(160), performanceSchema).default({}),
    capstoneDebriefViewedAt: z.string().min(1).max(64).nullable().default(null),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type BronchRecord = z.infer<typeof recordSchema>
export type BronchFirstAttempt = BronchRecord['firstAttempts'][string]
export type BronchSectionPerformance = BronchRecord['sectionPerformance'][string]

export function createEmptyBronchRecord(): BronchRecord {
  return {
    version: 1,
    completedSectionIds: [],
    lastSectionId: null,
    firstAttempts: {},
    sectionPerformance: {},
    capstoneDebriefViewedAt: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

/** The item behind an attempt key: everything after the first colon. */
export function itemIdOfAttemptKey(key: string): string {
  return key.slice(key.indexOf(':') + 1)
}

const RESERVED = new Set(['__proto__', 'constructor', 'prototype'])

function recomputedAttempts(
  attempts: Readonly<Record<string, BronchFirstAttempt>>,
): Record<string, BronchFirstAttempt> {
  const result: Record<string, BronchFirstAttempt> = {}
  for (const [key, attempt] of Object.entries(attempts)) {
    if (RESERVED.has(key)) continue
    const item = bronchItem(itemIdOfAttemptKey(key))
    if (!item) continue
    if (!item.choices.some((choice) => choice.id === attempt.choiceId)) continue
    result[key] = { ...attempt, correct: item.correctChoiceIds.includes(attempt.choiceId) }
  }
  return result
}

function cleanPerformance(
  performance: Readonly<Record<string, BronchSectionPerformance>>,
): Record<string, BronchSectionPerformance> {
  const result: Record<string, BronchSectionPerformance> = {}
  for (const [key, value] of Object.entries(performance)) {
    if (RESERVED.has(key)) continue
    result[key] = value
  }
  return result
}

export function parseBronchRecord(serialized: string | null | undefined): BronchRecord | null {
  if (!serialized) return null
  try {
    const parsed: unknown = JSON.parse(serialized)
    const result = recordSchema.safeParse(parsed)
    if (!result.success) return null
    return {
      ...result.data,
      completedSectionIds: [...new Set(result.data.completedSectionIds)],
      firstAttempts: recomputedAttempts(result.data.firstAttempts),
      sectionPerformance: cleanPerformance(result.data.sectionPerformance),
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

export function readBronchRecord(): BronchRecord {
  const store = storage()
  if (!store) return createEmptyBronchRecord()
  try {
    return parseBronchRecord(store.getItem(BRONCH_STORAGE_KEY)) ?? createEmptyBronchRecord()
  } catch {
    return createEmptyBronchRecord()
  }
}

export function writeBronchRecord(record: BronchRecord): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(BRONCH_STORAGE_KEY, JSON.stringify(recordSchema.parse(record)))
    window.dispatchEvent(new Event(BRONCH_RECORD_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function withSectionVisited(
  record: BronchRecord,
  sectionId: string,
  now = new Date().toISOString(),
): BronchRecord {
  if (record.lastSectionId === sectionId) return record
  return { ...record, lastSectionId: sectionId, updatedAt: now }
}

export function withSectionCompleted(
  record: BronchRecord,
  sectionId: string,
  performance: BronchSectionPerformance | null = null,
  now = new Date().toISOString(),
): BronchRecord {
  return {
    ...record,
    completedSectionIds: record.completedSectionIds.includes(sectionId)
      ? record.completedSectionIds
      : [...record.completedSectionIds, sectionId],
    lastSectionId: sectionId,
    sectionPerformance:
      performance && !record.sectionPerformance[sectionId]
        ? { ...record.sectionPerformance, [sectionId]: performance }
        : record.sectionPerformance,
    updatedAt: now,
  }
}

/** Write-once: a key that already holds a decision keeps it. */
export function withFirstAttempt(
  record: BronchRecord,
  key: string,
  choiceId: string,
  now = new Date().toISOString(),
): BronchRecord {
  if (record.firstAttempts[key]) return record
  const item = bronchItem(itemIdOfAttemptKey(key))
  if (!item) return record
  if (!item.choices.some((choice) => choice.id === choiceId)) return record
  return {
    ...record,
    firstAttempts: {
      ...record.firstAttempts,
      [key]: { choiceId, correct: item.correctChoiceIds.includes(choiceId), at: now },
    },
    updatedAt: now,
  }
}

export function withCapstoneDebriefViewed(
  record: BronchRecord,
  now = new Date().toISOString(),
): BronchRecord {
  if (record.capstoneDebriefViewedAt) return record
  return { ...record, capstoneDebriefViewedAt: now, updatedAt: now }
}

export function isSectionCompleted(record: BronchRecord, sectionId: string): boolean {
  return record.completedSectionIds.includes(sectionId)
}

export function firstAttempt(record: BronchRecord, key: string): BronchFirstAttempt | undefined {
  return record.firstAttempts[key]
}
