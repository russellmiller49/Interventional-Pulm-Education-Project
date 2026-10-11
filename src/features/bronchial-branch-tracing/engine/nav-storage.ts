import { z } from 'zod'
import type { NavSession } from './nav-session'
import { browserStorage } from './selfPacedProgress'

/**
 * Where a trip was left, kept on this device so a reload does not lose it.
 *
 * One entry per lesson, Practice lesion or Assess lesion. It holds the place and what the learner
 * did at each fork; it is never sent anywhere and it is not a result. A value that does not parse
 * is left alone and the trip starts fresh.
 */
export const NAV_STORAGE_KEY = 'branch-tracing.nav-v1'
export const NAV_ENTRY_LIMIT = 24

const orientation = z
  .object({
    turns: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    reflected: z.boolean(),
  })
  .strict()
const pixel = z.tuple([z.number().min(0).max(511), z.number().min(0).max(511)])
const verdict = z.enum(['intended-lumen', 'near-fork', 'other-airway', 'not-in-airway'])
const count = z.number().int().min(0).max(999)
const sessionSchema = z
  .object({
    version: z.literal(1),
    traceId: z.string().min(1).max(80),
    station: z.number().int().min(0).max(40),
    phase: z.enum(['match', 'identify', 'choose', 'ready', 'drive', 'arrived', 'done']),
    orientation,
    matchNote: z.enum(['asked', 'kept', 'set']),
    matchChecked: orientation.nullable(),
    identifyOption: z.number().int().min(0).max(4),
    marks: z
      .array(
        z
          .object({
            mark: z
              .object({ slice: z.number().int().min(230).max(480), pixel: pixel.nullable() })
              .strict(),
            verdict: verdict.nullable(),
            ok: z.boolean(),
            shown: z.boolean(),
          })
          .strict()
          .nullable(),
      )
      .max(5),
    declined: z.array(z.number().int().min(0).max(4)).max(5),
    choice: z.number().int().min(0).max(4).nullable(),
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
          })
          .strict(),
      )
      .max(41),
  })
  .strict()
const entrySchema = z
  .object({
    /** Which trip of a lesson this is; 0 for a route. */
    leg: z.number().int().min(0).max(12),
    session: sessionSchema,
    updatedAt: z.string().max(40),
  })
  .strict()
const recordSchema = z
  .object({ version: z.literal(1), entries: z.record(z.string().min(1).max(120), entrySchema) })
  .strict()

export interface NavEntry {
  leg: number
  session: NavSession
  updatedAt: string
}
export type NavStorageStatus = 'unavailable' | 'empty' | 'saved' | 'unreadable'

function readAll(storage: Storage | null): {
  status: NavStorageStatus
  entries: Record<string, NavEntry>
} {
  if (!storage) return { status: 'unavailable', entries: {} }
  let raw: string | null
  try {
    raw = storage.getItem(NAV_STORAGE_KEY)
  } catch {
    return { status: 'unavailable', entries: {} }
  }
  if (raw === null) return { status: 'empty', entries: {} }
  try {
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    if (parsed.success)
      return { status: 'saved', entries: parsed.data.entries as Record<string, NavEntry> }
  } catch {
    /* reported below, never repaired */
  }
  return { status: 'unreadable', entries: {} }
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
  // Oldest first out, so the record never grows without bound.
  const kept = Object.entries(entries)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
    .slice(0, NAV_ENTRY_LIMIT)
  try {
    storage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: Object.fromEntries(kept) }),
    )
    return true
  } catch {
    return false
  }
}

export function savedNavKeys(storage: Storage | null = browserStorage()): string[] {
  return Object.keys(readAll(storage).entries)
}
