import { z } from 'zod'
import { FINAL_CASES } from '../content/cases'
import { LESSONS } from '../content/curriculum'
import type { Question } from '../content/types'
export const STORAGE_KEY = 'ip-ebus-guided-v1'
export const RECORD_EVENT = 'ebus-guided-record'
const attempt = z.object({ choiceId: z.string().max(80), at: z.string().max(80) }).strict()
const schema = z
  .object({
    version: z.literal(1),
    completed: z.array(z.string().max(100)).max(100),
    lastLesson: z.string().max(100).nullable(),
    firstAttempts: z.record(attempt),
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
): CourseRecord {
  if (Object.hasOwn(record.firstAttempts, key) || !question.choices.some((c) => c.id === choiceId))
    return record
  if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(key)) return record
  return {
    ...record,
    firstAttempts: { ...record.firstAttempts, [key]: { choiceId, at: new Date().toISOString() } },
  }
}
export function completeLesson(record: CourseRecord, id: string): CourseRecord {
  if (!LESSONS.some((l) => l.id === id) || record.completed.includes(id)) return record
  return { ...record, completed: [...record.completed, id] }
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
