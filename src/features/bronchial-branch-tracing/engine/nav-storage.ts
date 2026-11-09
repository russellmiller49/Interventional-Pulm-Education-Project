import { z } from 'zod'
import type { TripSession } from './trip-session'
import { browserStorage } from './selfPacedProgress'

/**
 * Where a trip was left, kept on this device so a reload does not lose it.
 *
 * One entry per lesson, Practice lesion or Assess lesion. It holds the place and what the learner
 * did in planning and at each fork; it is never sent anywhere and it is not a result. A value that
 * does not parse is left alone and the trip starts fresh.
 *
 * The record also keeps whether the learner has shown they can turn the CT to match the scope:
 * after lesson 1, or after three forks matched on the first check, turning it becomes optional.
 *
 * Version 2 holds planning as well as the drive. A version 1 record (`branch-tracing.nav-v1`) is
 * not read: its trips start fresh.
 */
export const NAV_STORAGE_KEY = 'branch-tracing.nav-v2'
export const NAV_ENTRY_LIMIT = 24
/** First-check matches after which turning the CT is the learner's choice. */
export const ORIENTATION_MATCHES = 3

const orientation = z
  .object({
    turns: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    reflected: z.boolean(),
  })
  .strict()
const pixel = z.tuple([z.number().min(0).max(511), z.number().min(0).max(511)])
const slice = z.number().int().min(230).max(480)
const verdict = z.enum(['intended-lumen', 'near-fork', 'other-airway', 'not-in-airway'])
const count = z.number().int().min(0).max(999)
const option = z.number().int().min(0).max(4)
const navSchema = z
  .object({
    version: z.literal(2),
    traceId: z.string().min(1).max(80),
    station: z.number().int().min(0).max(40),
    phase: z.enum([
      'match',
      'identify',
      'choose',
      'ready',
      'drive',
      'astray-in',
      'astray',
      'astray-out',
      'arrived',
      'done',
    ]),
    orientation,
    matchNote: z.enum(['asked', 'kept', 'set', 'optional']),
    matchChecked: orientation.nullable(),
    optionalCheck: z.object({ orientation, ok: z.boolean() }).strict().nullable(),
    identifyOption: option,
    marks: z
      .array(
        z
          .object({
            mark: z.object({ slice, pixel: pixel.nullable() }).strict(),
            verdict: verdict.nullable(),
            ok: z.boolean(),
            shown: z.boolean(),
          })
          .strict()
          .nullable(),
      )
      .max(5),
    declined: z.array(option).max(5),
    choice: option.nullable(),
    astray: option.nullable(),
    log: z
      .array(
        z
          .object({
            matchAsked: z.boolean(),
            matchMisses: count,
            matchShown: z.boolean(),
            identifyAsked: z.boolean(),
            identifyMisses: count,
            identifyShown: z.boolean(),
            chooseAsked: z.boolean(),
            chooseMisses: count,
            chooseShown: z.boolean(),
            wrongTurns: count,
            backedOut: count,
          })
          .strict(),
      )
      .max(41),
  })
  .strict()
const anatomical = z.enum(['superior', 'inferior', 'medial', 'lateral', 'anterior', 'posterior'])
/** One of the eight places round the circle, clockwise from the top. */
const sector = z.number().int().min(0).max(7)
const stepLog = z.object({ asked: z.boolean(), misses: count, shown: z.boolean() }).strict()
const planSchema = z
  .object({
    version: z.literal(1),
    traceId: z.string().min(1).max(80),
    targetId: z.string().min(1).max(80),
    stage: z.enum(['lesion', 'segment', 'views', 'frame', 'arcs', 'review', 'done']),
    lesionMark: z.object({ slice, pixel, ok: z.boolean(), shown: z.boolean() }).strict().nullable(),
    segmentChoice: z.string().max(12).nullable(),
    views: z.object({ coronal: z.boolean(), sagittal: z.boolean() }).strict(),
    frame: z
      .object({
        top: anatomical.nullable(),
        right: anatomical.nullable(),
        bottom: anatomical.nullable(),
        left: anatomical.nullable(),
      })
      .strict(),
    frameChecked: z.boolean(),
    frameTurn: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    division: z.number().int().min(0).max(12),
    arcs: z
      .array(
        z
          .object({
            placed: z.array(sector).max(4),
            leadsOn: option.nullable(),
            checked: z.boolean(),
            ok: z.boolean(),
            shown: z.boolean(),
            misses: count,
          })
          .strict(),
      )
      .max(12),
    log: z.object({ lesion: stepLog, segment: stepLog, frame: stepLog }).strict(),
  })
  .strict()
const tripSchema = z
  .object({
    version: z.literal(2),
    stage: z.enum(['plan', 'navigate', 'done']),
    plan: planSchema.nullable(),
    nav: navSchema.nullable(),
  })
  .strict()
const entrySchema = z
  .object({
    /** Which trip of a lesson this is; 0 for a route. */
    leg: z.number().int().min(0).max(12),
    trip: tripSchema,
    updatedAt: z.string().max(40),
  })
  .strict()
const orientationProgressSchema = z
  .object({ firstTryMatches: count, lessonOneDone: z.boolean() })
  .strict()
const recordSchema = z
  .object({
    version: z.literal(2),
    entries: z.record(z.string().min(1).max(120), entrySchema),
    orientation: orientationProgressSchema,
  })
  .strict()

export interface NavEntry {
  leg: number
  trip: TripSession
  updatedAt: string
}
export interface OrientationProgress {
  /** Forks where the CT was matched to the scope on the first check, without being shown. */
  firstTryMatches: number
  lessonOneDone: boolean
}
export type NavStorageStatus = 'unavailable' | 'empty' | 'saved' | 'unreadable'
const NO_PROGRESS: OrientationProgress = { firstTryMatches: 0, lessonOneDone: false }

function readAll(storage: Storage | null): {
  status: NavStorageStatus
  entries: Record<string, NavEntry>
  orientation: OrientationProgress
} {
  const none = { entries: {}, orientation: { ...NO_PROGRESS } }
  if (!storage) return { status: 'unavailable', ...none }
  let raw: string | null
  try {
    raw = storage.getItem(NAV_STORAGE_KEY)
  } catch {
    return { status: 'unavailable', ...none }
  }
  if (raw === null) return { status: 'empty', ...none }
  try {
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    if (parsed.success)
      return {
        status: 'saved',
        entries: parsed.data.entries as Record<string, NavEntry>,
        orientation: parsed.data.orientation,
      }
  } catch {
    /* reported below, never repaired */
  }
  return { status: 'unreadable', ...none }
}

function writeAll(
  storage: Storage,
  entries: Record<string, NavEntry>,
  orientation: OrientationProgress,
) {
  // Oldest first out, so the record never grows without bound.
  const kept = Object.entries(entries)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
    .slice(0, NAV_ENTRY_LIMIT)
  try {
    storage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ version: 2, entries: Object.fromEntries(kept), orientation }),
    )
    return true
  } catch {
    return false
  }
}

export const navKey = (section: 'learn' | 'practice' | 'assess', id: string) => `${section}:${id}`

export function readNavEntry(
  key: string,
  storage: Storage | null = browserStorage(),
): { status: NavStorageStatus; entry: NavEntry | null } {
  const all = readAll(storage)
  return { status: all.status, entry: all.entries[key] ?? null }
}

/** Saves one trip's place. An unreadable record is replaced: it holds a place, not work. */
export function writeNavEntry(
  key: string,
  entry: Omit<NavEntry, 'updatedAt'> | null,
  storage: Storage | null = browserStorage(),
): boolean {
  if (!storage) return false
  const all = readAll(storage)
  if (all.status === 'unavailable') return false
  const entries = { ...all.entries }
  if (entry) entries[key] = { ...entry, updatedAt: new Date().toISOString() }
  else delete entries[key]
  return writeAll(storage, entries, all.orientation)
}

export function savedNavKeys(storage: Storage | null = browserStorage()): string[] {
  return Object.keys(readAll(storage).entries)
}

export function readOrientationProgress(
  storage: Storage | null = browserStorage(),
): OrientationProgress {
  return readAll(storage).orientation
}
/** Turning the CT has been shown: lesson 1 is done, or enough forks were matched first time. */
export const orientationShown = (progress: OrientationProgress) =>
  progress.lessonOneDone || progress.firstTryMatches >= ORIENTATION_MATCHES

/** Adds to what the learner has shown about turning the CT. Never takes anything away. */
export function recordOrientationProgress(
  change: { firstTryMatches?: number; lessonOneDone?: boolean },
  storage: Storage | null = browserStorage(),
): boolean {
  if (!storage) return false
  const all = readAll(storage)
  if (all.status === 'unavailable') return false
  const orientation: OrientationProgress = {
    firstTryMatches: Math.min(
      999,
      all.orientation.firstTryMatches + Math.max(0, change.firstTryMatches ?? 0),
    ),
    lessonOneDone: all.orientation.lessonOneDone || Boolean(change.lessonOneDone),
  }
  if (
    orientation.firstTryMatches === all.orientation.firstTryMatches &&
    orientation.lessonOneDone === all.orientation.lessonOneDone
  )
    return true
  return writeAll(storage, all.entries, orientation)
}
