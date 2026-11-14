import { z } from 'zod'
import type { NavSummary } from './nav-session'
import type { PlanSummary } from './plan-session'
import { browserStorage } from './selfPacedProgress'

/**
 * What happened the last time each whole lesion was reached, kept on this device so the lesion
 * list can say which have been done and what was missed. One entry per Practice lesion and per
 * closing-set lesion. It is the learner's own record: never sent anywhere, and never a result
 * anyone else sees.
 *
 * It is kept apart from the place record (`nav-storage`): that one drops its oldest entry past a
 * limit, and a reached lesion must not lose its line because a later one was opened.
 */
export const RESULTS_STORAGE_KEY = 'branch-tracing.results-v1'

const count = z.number().int().min(0).max(999)
const step = z.object({ asked: z.boolean(), misses: count, shown: z.boolean() }).strict()
const tally = z.object({ asked: count, firstTry: count }).strict()
const resultSchema = z
  .object({
    reachedAt: z.string().max(40),
    /** Times this lesion has been reached on this device. */
    runs: z.number().int().min(1).max(999),
    plan: z.object({ lesion: step, segment: step, frame: step, arcs: tally }).strict().nullable(),
    drive: z.object({ choose: tally, wrongTurns: count, backedOut: count }).strict().nullable(),
  })
  .strict()
const recordSchema = z
  .object({ version: z.literal(1), results: z.record(z.string().min(1).max(120), resultSchema) })
  .strict()

export type TripResult = z.infer<typeof resultSchema>
export type ResultsStatus = 'unavailable' | 'empty' | 'saved' | 'unreadable'

export function readResults(storage: Storage | null = browserStorage()): {
  status: ResultsStatus
  results: Record<string, TripResult>
} {
  if (!storage) return { status: 'unavailable', results: {} }
  let raw: string | null
  try {
    raw = storage.getItem(RESULTS_STORAGE_KEY)
  } catch {
    return { status: 'unavailable', results: {} }
  }
  if (raw === null) return { status: 'empty', results: {} }
  try {
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return { status: 'saved', results: parsed.data.results }
  } catch {
    /* reported below */
  }
  return { status: 'unreadable', results: {} }
}

/** The part of a trip's two summaries the record keeps. */
export function resultOf(
  plan: PlanSummary | null,
  drive: NavSummary | null,
): Pick<TripResult, 'plan' | 'drive'> {
  return {
    plan: plan && {
      lesion: { ...plan.lesion },
      segment: { ...plan.segment },
      frame: { ...plan.frame },
      arcs: { ...plan.arcs },
    },
    drive: drive && {
      choose: { ...drive.choose },
      wrongTurns: drive.wrongTurns,
      backedOut: drive.backedOut,
    },
  }
}

/**
 * Records that a lesion was reached, replacing what was kept for it and counting the run. A
 * record that does not parse is left alone: it may be a later version's, and this one line is
 * not worth its loss.
 */
export function recordResult(
  key: string,
  result: Pick<TripResult, 'plan' | 'drive'>,
  storage: Storage | null = browserStorage(),
): boolean {
  if (!storage) return false
  const all = readResults(storage)
  if (all.status === 'unavailable' || all.status === 'unreadable') return false
  const runs = Math.min(999, (all.results[key]?.runs ?? 0) + 1)
  const next = { ...all.results, [key]: { ...result, runs, reachedAt: new Date().toISOString() } }
  try {
    storage.setItem(RESULTS_STORAGE_KEY, JSON.stringify({ version: 1, results: next }))
    return true
  } catch {
    return false
  }
}

/** Every step asked landed at its first check, nothing was shown, and no branch led away. */
export function everyStepFirst(result: Pick<TripResult, 'plan' | 'drive'>): boolean {
  const clean = (s: { asked: boolean; misses: number; shown: boolean }) =>
    !s.asked || (!s.misses && !s.shown)
  const plan = result.plan
  const drive = result.drive
  return (
    (!plan ||
      (clean(plan.lesion) &&
        clean(plan.segment) &&
        clean(plan.frame) &&
        plan.arcs.firstTry === plan.arcs.asked)) &&
    (!drive || (drive.choose.firstTry === drive.choose.asked && drive.wrongTurns === 0))
  )
}
