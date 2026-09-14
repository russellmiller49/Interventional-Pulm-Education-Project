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
export const STORAGE_KEY = 'ip-ebus-guided-v1'
export const RECORD_EVENT = 'ebus-guided-record'
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
export function readRecord(): CourseRecord {
  try {
    return parseRecord(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return emptyRecord()
  }
}
export function writeRecord(record: CourseRecord): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schema.parse(record)))
    window.dispatchEvent(new Event(RECORD_EVENT))
    return true
  } catch {
    return false
  }
}
export function updateRecord(change: (record: CourseRecord) => CourseRecord): boolean {
  return writeRecord({ ...change(readRecord()), updatedAt: new Date().toISOString() })
}
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
export function recordSupportRequest(
  record: CourseRecord,
  lessonId: string,
  activityId: string,
  sessionId: string,
): CourseRecord {
  const requests = record.supportRequests[lessonId] ?? []
  if (requests.some((entry) => entry.activityId === activityId && entry.sessionId === sessionId))
    return record
  return {
    ...record,
    supportRequests: {
      ...record.supportRequests,
      [lessonId]: [...requests, { activityId, sessionId, at: new Date().toISOString() }].slice(
        -200,
      ),
    },
  }
}
export function completeLesson(record: CourseRecord, id: string): CourseRecord {
  if (!LESSONS.some((l) => l.id === id) || record.completed.includes(id)) return record
  return { ...record, completed: [...record.completed, id] }
}

/** Store the actual acquisition paired with this response; never derive it from old completion. */
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

export function assessmentReady(record: CourseRecord): boolean {
  return LESSONS.every((l) => record.completed.includes(l.id))
}
export function completeCase(
  record: CourseRecord,
  id: string,
  answers: Record<string, string>,
): CourseRecord {
  const item = FINAL_CASES.find((c) => c.id === id)
  if (
    !assessmentReady(record) ||
    !item ||
    item.questions.some((q) => !q.choices.some((c) => c.id === answers[q.id] && !c.unsafe))
  )
    return record
  const completedCases = [...new Set([...record.completedCases, id])]
  return {
    ...record,
    completedCases,
    assessmentComplete: completedCases.length === FINAL_CASES.length,
  }
}
