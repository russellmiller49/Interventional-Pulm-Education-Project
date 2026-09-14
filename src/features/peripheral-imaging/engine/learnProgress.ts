import { z } from 'zod'

import { QUESTION_BY_ID } from '../data/questions'

/**
 * The module's legacy learner records — read-only.
 *
 * Before the self-paced conversion (PI-01, 2026-09-14) the course wrote `ip-peripheral-imaging-v2`:
 * the sections worked through, the last section, a write-once first attempt on every committed
 * item, and when the capstone debrief was first viewed. The draft before it wrote
 * `ip-peripheral-imaging-v1`. Those records stay on learners' devices exactly as they were stored.
 *
 * No current surface reads them, writes them, migrates them or turns them into self-paced progress:
 * new sessions keep only `selfPacedProgress.ts`, and `self-paced-progress.test.ts` holds that
 * boundary. The pure parsers below remain so the stored bytes stay interpretable — they recompute
 * correctness from the item bank at read time, as they always did — but nothing in the course calls
 * them, so they cannot open, recommend or claim anything.
 */
export const LEGACY_IMAGING_RECORD_KEY_V2 = 'ip-peripheral-imaging-v2'
export const LEGACY_IMAGING_RECORD_KEY_V1 = 'ip-peripheral-imaging-v1'

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
 * The draft's record, read leniently: only the shapes a reader needs, never the draft's own
 * parser, whose "reviewed" filter re-checks a lesson's items against today's item list.
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
 * How the pre-conversion course interpreted a draft record: every committed answer under the same
 * key, the eight case answers under the capstone, and every lesson the draft marked reviewed as
 * worked through. Pure and kept only to interpret legacy bytes; nothing stores its result.
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
