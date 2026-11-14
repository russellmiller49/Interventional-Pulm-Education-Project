import { z } from 'zod'
import { browserStorage } from './selfPacedProgress'

/**
 * How the learner likes the drive to run, kept on this device. One choice so far: whether the
 * scope flies through the central airways (the default) or stops at every fork from the trachea.
 * Never sent anywhere. A value that does not parse reads as the defaults and is replaced by the
 * next choice: it holds a preference, not work.
 */
export const PREFS_STORAGE_KEY = 'branch-tracing.prefs-v1'

export interface BenchPrefs {
  /** Choose at every fork from the trachea; no fork is flown through. */
  everyFork: boolean
}
export const DEFAULT_PREFS: BenchPrefs = { everyFork: false }

const schema = z.object({ version: z.literal(1), everyFork: z.boolean() }).strict()

export function readPrefs(storage: Storage | null = browserStorage()): BenchPrefs {
  if (!storage) return { ...DEFAULT_PREFS }
  try {
    const raw = storage.getItem(PREFS_STORAGE_KEY)
    if (raw === null) return { ...DEFAULT_PREFS }
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? { everyFork: parsed.data.everyFork } : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function writePrefs(prefs: BenchPrefs, storage: Storage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ version: 1, everyFork: prefs.everyFork }))
    return true
  } catch {
    return false
  }
}
