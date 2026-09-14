import { z } from 'zod'
import { FINAL_CASES } from '../content/cases'
import { LESSONS } from '../content/curriculum'
import { labGoalMet, type Lab, type Question } from '../content/types'
import type { EbusObservation } from '@/lib/ebus-guided-bridge'
import {
  isLinkedFrameSource,
  linkedTaskKey,
  type LinkedFrameSource,
} from '@/lib/ebus-linked-contract'

/**
 * The pre-conversion course record, `ip-ebus-guided-v1`: completed lessons, first attempts with
 * a support flag, support requests, linked skill observations paired with an interpretation, and
 * completed cases.
 *
 * Since EBUS-01 (owner decision of 2026-09-14, `docs/gap-remediation/self-paced/`) the course
 * keeps only the self-paced record in `selfPacedProgress.ts`. This module is read-only
 * compatibility: it can still interpret an old value, and its pure transforms document what the
 * old record meant, so the historical acquisition and first-response records stay readable. No
 * writer remains here, no component imports this module, and nothing converts an old completion,
 * response or observation into current progress.
 */
export const STORAGE_KEY = 'ip-ebus-guided-v1'
const attempt = z
  .object({
    choiceId: z.string().max(80),
    at: z.string().max(80),
    supportRequested: z.boolean().optional(),
  })
  .strict()
const skillObservation = z
  .object({
    source: z.custom<LinkedFrameSource>(isLinkedFrameSource),
    landmarks: z.array(z.string().max(100)).max(8),
    sweeps: z
      .array(
        z
          .object({
            approach: z.enum(['rms', 'lms', 'default']),
            samples: z.number().int().min(5).max(200),
            span: z.number().min(20).max(360),
            frameId: z.string().max(160),
          })
          .strict(),
      )
      .max(3),
    baselineFrameId: z.string().max(160).optional(),
    questionId: z.string().max(100),
    choiceId: z.string().max(80),
    correct: z.boolean(),
    at: z.string().max(80),
  })
  .strict()
const schema = z
  .object({
    version: z.literal(1),
    completed: z.array(z.string().max(100)).max(100),
    lastLesson: z.string().max(100).nullable(),
    firstAttempts: z.record(attempt),
    skillObservations: z.record(skillObservation).default({}).catch({}),
    supportRequests: z
      .record(
        z
          .array(
            z
              .object({
                activityId: z.string().max(180),
                sessionId: z.string().max(180),
                at: z.string().max(80),
              })
              .strict(),
          )
          .max(200),
      )
      .default({}),
    skillHistory: z.record(z.array(skillObservation).max(100)).default({}).catch({}),
    completedCases: z.array(z.string().max(100)).max(100).default([]),
    assessmentComplete: z.boolean(),
    updatedAt: z.string().max(80),
  })
  .strict()
export type CourseRecord = z.infer<typeof schema>
export const emptyRecord = (): CourseRecord => ({
  version: 1,
  completed: [],
  lastLesson: null,
  firstAttempts: {},
  skillObservations: {},
  skillHistory: {},
  supportRequests: {},
  completedCases: [],
  assessmentComplete: false,
  updatedAt: '',
})
/** Interpret a stored legacy value. Pure: nothing is written back. */
export function parseRecord(raw: string | null): CourseRecord {
  try {
    const parsed = schema.safeParse(JSON.parse(raw ?? 'null'))
    if (!parsed.success) return emptyRecord()
    const ids = new Set(LESSONS.map((l) => l.id))
    const cleaned = {
      ...parsed.data,
      completed: [...new Set(parsed.data.completed.filter((id) => ids.has(id)))],
    }
    if (cleaned.lastLesson && !ids.has(cleaned.lastLesson)) cleaned.lastLesson = null
    cleaned.skillObservations = Object.fromEntries(
      Object.entries(cleaned.skillObservations).filter(
        ([key, item]) => key === `${item.source.taskId}:v${item.source.taskVersion}`,
      ),
    )
    cleaned.completedCases = [
      ...new Set(cleaned.completedCases.filter((id) => FINAL_CASES.some((c) => c.id === id))),
    ]
    cleaned.assessmentComplete =
      cleaned.assessmentComplete &&
      cleaned.completed.length === LESSONS.length &&
      cleaned.completedCases.length === FINAL_CASES.length
    return cleaned
  } catch {
    return emptyRecord()
  }
}
/** Legacy transform, kept to document the old first-response rule. Pure; no current caller writes it. */
export function firstAttempt(
  record: CourseRecord,
  key: string,
  question: Question,
  choiceId: string,
  supportRequested = false,
): CourseRecord {
  if (Object.hasOwn(record.firstAttempts, key) || !question.choices.some((c) => c.id === choiceId))
    return record
  if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(key)) return record
  return {
    ...record,
    firstAttempts: {
      ...record.firstAttempts,
      [key]: { choiceId, at: new Date().toISOString(), supportRequested },
    },
  }
}

/**
 * Legacy transform: the actual acquisition paired with its response, never derived from old
 * completion. Pure; kept so the retained-evidence and linked-task rules of old records remain
 * tested. No current session records a skill observation.
 */
export function recordLinkedObservation(
  record: CourseRecord,
  lab: Lab,
  observation: EbusObservation,
  question: Question,
  choiceId: string,
): CourseRecord {
  const source = observation.linked?.source,
    choice = question.choices.find((c) => c.id === choiceId)
  if (
    !lab.linkedLesson ||
    !source ||
    !isLinkedFrameSource(source) ||
    !choice ||
    !labGoalMet(lab, observation)
  )
    return record
  const key = linkedTaskKey(lab.linkedLesson, lab.linkedVariant ?? 'guided')
  return {
    ...record,
    skillHistory: {
      ...record.skillHistory,
      [key]:
        record.skillObservations[key] &&
        record.skillObservations[key].source.sessionId !== source.sessionId
          ? [...(record.skillHistory[key] ?? []), record.skillObservations[key]].slice(-100)
          : (record.skillHistory[key] ?? []),
    },
    skillObservations: {
      ...record.skillObservations,
      [key]: {
        source,
        landmarks: observation.linked!.identifiedStructures ?? [],
        sweeps: Object.entries(observation.linked!.sweeps ?? {})
          .filter(([, s]) => s.phase === 'complete')
          .map(([approach, s]) => ({
            approach: approach as 'rms' | 'lms' | 'default',
            samples: s.samples,
            span: s.span,
            frameId: s.lastFrameId,
          })),
        baselineFrameId: observation.linked?.baselineFrameId,
        questionId: question.id,
        choiceId,
        correct: !!choice.correct,
        at: new Date().toISOString(),
      },
    },
  }
}
