import { z } from 'zod'

import { isObjectiveId } from '../content/objectives'

/**
 * The learner's record: profile, evidence and review schedule. One record per device, in local
 * storage, private by default; the progress screen exports and deletes it. Nothing here is a
 * grade. Evidence is a list of observations, each of which says what task was set, what the learner
 * did, how sure they were and which wrong model, if any, the error matched.
 */
export const NAVIGATOR_STORAGE_KEY = 'ip-board-navigator-v1'
export const NAVIGATOR_CHANGED_EVENT = 'board-navigator-record-changed'

export const LEARNER_GOALS = ['board', 'fellowship', 'maintenance'] as const
export type LearnerGoal = (typeof LEARNER_GOALS)[number]

export const SESSION_LENGTHS = [5, 10, 20] as const
export type SessionLength = (typeof SESSION_LENGTHS)[number]

export const EVIDENCE_PHASES = ['diagnose', 'manipulate', 'verify', 'review'] as const
export type EvidencePhase = (typeof EVIDENCE_PHASES)[number]

export const EVIDENCE_OUTCOMES = ['independent', 'with-hint', 'missed'] as const
export type EvidenceOutcome = (typeof EVIDENCE_OUTCOMES)[number]

export const CONFIDENCE_LEVELS = ['guess', 'fairly-sure', 'sure'] as const
export type Confidence = (typeof CONFIDENCE_LEVELS)[number]

const taskKindSchema = z.enum(['choice', 'predict', 'sequence', 'sort', 'hotspot'])

export const evidenceSchema = z
  .object({
    objectiveId: z.string().min(1).max(64),
    taskId: z.string().min(1).max(128),
    taskKind: taskKindSchema,
    phase: z.enum(EVIDENCE_PHASES),
    outcome: z.enum(EVIDENCE_OUTCOMES),
    confidence: z.enum(CONFIDENCE_LEVELS).nullable(),
    misconceptionId: z.string().min(1).max(128).nullable(),
    at: z.string().min(1).max(64),
  })
  .strict()

export type Evidence = z.infer<typeof evidenceSchema>

export const reviewSchema = z
  .object({
    /** Index into the review intervals. */
    stage: z.number().int().min(0).max(8),
    dueAt: z.string().min(1).max(64),
    lastAt: z.string().min(1).max(64),
  })
  .strict()

export type ReviewEntry = z.infer<typeof reviewSchema>

export const profileSchema = z
  .object({
    goal: z.enum(LEARNER_GOALS),
    /** ISO date (YYYY-MM-DD) of the board examination, when the goal is board preparation. */
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    sessionMinutes: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  })
  .strict()

export type LearnerProfile = z.infer<typeof profileSchema>

const MAX_EVIDENCE = 4000

export const recordSchema = z
  .object({
    version: z.literal(1),
    profile: profileSchema.nullable(),
    evidence: z.array(evidenceSchema).max(MAX_EVIDENCE),
    reviews: z.record(z.string().min(1).max(64), reviewSchema),
    /** Objectives the learner marked as difficult after using an outside resource. */
    flagged: z.array(z.string().min(1).max(64)).max(256),
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type NavigatorRecord = z.infer<typeof recordSchema>

export function createEmptyRecord(): NavigatorRecord {
  return {
    version: 1,
    profile: null,
    evidence: [],
    reviews: {},
    flagged: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

/** Drops evidence and reviews for objectives that no longer exist, so a retired id cannot linger. */
function knownObjectivesOnly(record: NavigatorRecord): NavigatorRecord {
  return {
    ...record,
    evidence: record.evidence.filter((entry) => isObjectiveId(entry.objectiveId)),
    reviews: Object.fromEntries(
      Object.entries(record.reviews).filter(([objectiveId]) => isObjectiveId(objectiveId)),
    ),
    flagged: record.flagged.filter((id) => isObjectiveId(id)),
  }
}

export function parseRecord(serialized: string | null | undefined): NavigatorRecord | null {
  if (!serialized) return null
  try {
    const result = recordSchema.safeParse(JSON.parse(serialized))
    return result.success ? knownObjectivesOnly(result.data) : null
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

export function readRecord(): NavigatorRecord {
  const store = storage()
  if (!store) return createEmptyRecord()
  try {
    return parseRecord(store.getItem(NAVIGATOR_STORAGE_KEY)) ?? createEmptyRecord()
  } catch {
    return createEmptyRecord()
  }
}

/** Returns false when the device refuses storage; learning carries on either way. */
export function writeRecord(record: NavigatorRecord): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(NAVIGATOR_STORAGE_KEY, JSON.stringify(recordSchema.parse(record)))
    window.dispatchEvent(new Event(NAVIGATOR_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function clearRecord(): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.removeItem(NAVIGATOR_STORAGE_KEY)
    window.dispatchEvent(new Event(NAVIGATOR_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

/** Pure: a record with one more observation, oldest evidence dropped past the cap. */
export function withEvidence(record: NavigatorRecord, evidence: Evidence): NavigatorRecord {
  const list = [...record.evidence, evidence]
  return {
    ...record,
    evidence: list.length > MAX_EVIDENCE ? list.slice(list.length - MAX_EVIDENCE) : list,
    updatedAt: evidence.at,
  }
}

export function withProfile(
  record: NavigatorRecord,
  profile: LearnerProfile,
  now: string,
): NavigatorRecord {
  return { ...record, profile, updatedAt: now }
}

export function withReview(
  record: NavigatorRecord,
  objectiveId: string,
  review: ReviewEntry | null,
  now: string,
): NavigatorRecord {
  const reviews = { ...record.reviews }
  if (review) reviews[objectiveId] = review
  else delete reviews[objectiveId]
  return { ...record, reviews, updatedAt: now }
}

export function withFlag(
  record: NavigatorRecord,
  objectiveId: string,
  on: boolean,
  now: string,
): NavigatorRecord {
  const has = record.flagged.includes(objectiveId)
  if (has === on) return record
  return {
    ...record,
    flagged: on
      ? [...record.flagged, objectiveId]
      : record.flagged.filter((id) => id !== objectiveId),
    updatedAt: now,
  }
}

export function evidenceFor(record: NavigatorRecord, objectiveId: string): readonly Evidence[] {
  return record.evidence.filter((entry) => entry.objectiveId === objectiveId)
}
