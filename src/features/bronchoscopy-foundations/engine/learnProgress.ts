import { z } from 'zod'

import { bronchItem } from '../content/stageItems'
import { BRONCH_LEARN_VERSIONS } from '../content/lessonVersions'
import { AIRWAY_LABELS } from '../components/scope/types'

/**
 * The course's earlier record, now read-only (BF-01, owner's self-paced decision of 2026-09-14).
 *
 * Until then this key held which sections had been worked through, the first decision on every
 * committed item with its declared support, how the scope was driven, when the capstone debrief was
 * seen and the finished survey. New sessions never write it — the module's only writer is
 * `selfPacedProgress.ts` — and no stored byte is rewritten. The schema and parser stay so a stored
 * record reads exactly as it was written; the survey schema is shared with the self-paced record.
 * No navigation, recommendation or learner-facing claim is derived from its completions, first
 * attempts, performance summaries or finished survey: since BF-03 that survey no longer feeds the
 * report exercise either, and no module code reads this record at run time.
 *
 * The earlier nine-module course's record (`ip-intro-bronchoscopy-progress-v1`) is not read either:
 * its booleans were hand toggles (A20).
 */
export const BRONCH_STORAGE_KEY = 'ip-bronchoscopy-foundations-v1'

const attemptKey = z.string().regex(/^[a-z0-9-]+:[A-Za-z0-9._-]+$/)

const firstAttemptSchema = z
  .object({
    choiceId: z.string().min(1).max(40),
    correct: z.boolean(),
    at: z.string().min(1).max(64),
    support: z.enum(['learn-after-teaching', 'reviewed-teaching']).optional(),
  })
  .strict()

const performanceSchema = z
  .object({
    inputModes: z.array(z.string().min(1).max(24)).max(8),
    assistsUsed: z.array(z.string().min(1).max(40)).max(12),
    unaided: z.boolean(),
  })
  .strict()

/** A finished lower-airway survey: what was identified, entered and declared, never a finding. */
export const inspectionSnapshotSchema = z
  .object({
    sectionId: z.literal('systematic-survey'),
    at: z.string().max(64),
    rows: z
      .array(
        z
          .object({
            label: z.enum(AIRWAY_LABELS),
            identified: z.boolean(),
            ostiumVisualized: z.boolean(),
            entered: z.boolean(),
            distalViewObtained: z.boolean(),
            inspected: z.enum(['no', 'declared', 'declared-without-view']),
            limitation: z.enum(['not-safely-accessible', 'not-observed', 'entry-route']).nullable(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict()

export type BronchInspectionSnapshot = z.infer<typeof inspectionSnapshotSchema>

const recordSchema = z
  .object({
    version: z.literal(1),
    completedSectionIds: z.array(z.string().min(1).max(160)).max(64),
    lastSectionId: z.string().min(1).max(160).nullable(),
    firstAttempts: z.record(attemptKey, firstAttemptSchema).default({}),
    sectionPerformance: z.record(z.string().min(1).max(160), performanceSchema).default({}),
    sectionVersions: z.record(z.string().min(1).max(160), z.number().int().positive()).default({}),
    capstoneDebriefViewedAt: z.string().min(1).max(64).nullable().default(null),
    inspectionSnapshot: inspectionSnapshotSchema.nullable().default(null),
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
    sectionVersions: {},
    capstoneDebriefViewedAt: null,
    inspectionSnapshot: null,
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

/** Parses in memory only; the stored string is never replaced by the parsed form. */
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

/** Reads the earlier record, or an empty one. Never writes. */
export function readBronchRecord(): BronchRecord {
  if (typeof window === 'undefined') return createEmptyBronchRecord()
  try {
    return (
      parseBronchRecord(window.localStorage.getItem(BRONCH_STORAGE_KEY)) ??
      createEmptyBronchRecord()
    )
  } catch {
    return createEmptyBronchRecord()
  }
}

/** How the earlier record read a completion: the section id at its then-current lesson version. */
export function isSectionCompleted(record: BronchRecord, sectionId: string): boolean {
  return (
    record.completedSectionIds.includes(sectionId) &&
    (!BRONCH_LEARN_VERSIONS[sectionId] ||
      record.sectionVersions[sectionId] === BRONCH_LEARN_VERSIONS[sectionId])
  )
}
