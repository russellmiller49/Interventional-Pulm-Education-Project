import { NextResponse } from 'next/server'

import {
  criticalCareAccountSyncModuleIds,
  criticalCareAccountSyncSections,
  criticalCareCoarseAccountProgressSchema,
  criticalCareCoarseProgressBatchSchema,
  type CriticalCareAccountSyncModuleId,
  type CriticalCareCoarseModuleProgress,
} from '@/lib/critical-care-progress-sync'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_MERGE_ATTEMPTS = 4
const SYNC_ACCOUNT_HEADER = 'x-critical-care-sync-account'

interface StoredCoarseProgress {
  readonly module_id: string
  readonly first_started_at: string
  readonly completed_at: string | null
  readonly completed_sections: readonly string[] | null
  readonly percent_complete: number
  readonly total_time_seconds: number
  readonly updated_at: string
}

type ProgressClient = Awaited<ReturnType<typeof supabaseServer>>

function isUniqueConflict(error: { readonly code?: string } | null): boolean {
  return error?.code === '23505'
}

function mergeStoredProgress(
  current: StoredCoarseProgress | null,
  incoming: CriticalCareCoarseModuleProgress,
) {
  const completedSections = [
    ...new Set([...(current?.completed_sections ?? []), ...incoming.completedSections]),
  ].filter((section): section is (typeof incoming.completedSections)[number] =>
    criticalCareAccountSyncSections.some((candidate) => candidate === section),
  )
  const percentComplete = Math.max(current?.percent_complete ?? 0, incoming.percentComplete)
  const changed =
    !current ||
    percentComplete > current.percent_complete ||
    incoming.completedSections.some(
      (section) => !(current.completed_sections ?? []).includes(section),
    ) ||
    (incoming.completed && !current.completed_at)

  return { changed, completedSections, percentComplete }
}

/**
 * Monotonically merge one module using updated_at as a compare-and-swap token.
 *
 * Inserts use DO NOTHING on conflict, while updates only match the row version
 * that was read. A lost race is re-read and re-merged instead of overwriting
 * the winner with a stale percentage or section set.
 */
async function mergeModuleProgress(
  supabase: ProgressClient,
  userId: string,
  incoming: CriticalCareCoarseModuleProgress,
): Promise<'changed' | 'unchanged' | 'error'> {
  for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS; attempt += 1) {
    const { data, error: readError } = await supabase
      .from('site_module_progress')
      .select(
        'module_id,first_started_at,completed_at,completed_sections,percent_complete,total_time_seconds,updated_at',
      )
      .eq('user_id', userId)
      .eq('module_id', incoming.moduleId)
      .maybeSingle()

    if (readError) return 'error'
    const current = (data as StoredCoarseProgress | null) ?? null
    const merged = mergeStoredProgress(current, incoming)
    if (!merged.changed) return 'unchanged'

    const now = new Date().toISOString()
    if (!current) {
      const { data: inserted, error: insertError } = await supabase
        .from('site_module_progress')
        .upsert(
          [
            {
              user_id: userId,
              module_id: incoming.moduleId,
              first_started_at: now,
              last_visited_at: now,
              completed_at: merged.percentComplete === 100 ? now : null,
              percent_complete: merged.percentComplete,
              total_time_seconds: 0,
              completed_sections: merged.completedSections,
              updated_at: now,
            },
          ],
          {
            onConflict: 'user_id,module_id',
            ignoreDuplicates: true,
          },
        )
        .select('module_id')

      if (insertError && !isUniqueConflict(insertError)) return 'error'
      if (!insertError && Array.isArray(inserted) && inserted.length > 0) return 'changed'
      continue
    }

    const { data: updated, error: updateError } = await supabase
      .from('site_module_progress')
      .update({
        last_visited_at: now,
        completed_at: current.completed_at ?? (merged.percentComplete === 100 ? now : null),
        percent_complete: merged.percentComplete,
        total_time_seconds: current.total_time_seconds,
        completed_sections: merged.completedSections,
      })
      .eq('user_id', userId)
      .eq('module_id', incoming.moduleId)
      .eq('updated_at', current.updated_at)
      .select('module_id')

    if (updateError) return 'error'
    if (Array.isArray(updated) && updated.length > 0) return 'changed'
  }

  return 'error'
}

export async function POST(request: Request) {
  const rawPayload = await request.json().catch(() => null)
  const payload = criticalCareCoarseProgressBatchSchema.safeParse(rawPayload)
  if (!payload.success) {
    return NextResponse.json({ error: 'Invalid coarse progress payload.' }, { status: 400 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  if (request.headers.get(SYNC_ACCOUNT_HEADER) !== user.id) {
    return NextResponse.json({ error: 'Account changed during progress sync.' }, { status: 409 })
  }

  let synced = 0
  for (const incoming of payload.data.modules) {
    const result = await mergeModuleProgress(supabase, user.id, incoming)
    if (result === 'error') {
      return NextResponse.json({ error: 'Unable to write coarse progress.' }, { status: 500 })
    }
    if (result === 'changed') synced += 1
  }

  return NextResponse.json({ status: 'ok', synced })
}

export async function GET() {
  const supabase = await supabaseServer()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('site_module_progress')
    .select('module_id,completed_at,completed_sections,last_visited_at,percent_complete')
    .eq('user_id', user.id)
    .in('module_id', [...criticalCareAccountSyncModuleIds])

  if (error) {
    return NextResponse.json({ error: 'Unable to read coarse progress.' }, { status: 500 })
  }

  const response = criticalCareCoarseAccountProgressSchema.safeParse({
    schemaVersion: 1,
    accountId: user.id,
    modules: (data ?? []).map((row) => ({
      moduleId: row.module_id as CriticalCareAccountSyncModuleId,
      percentComplete: row.percent_complete as number,
      completedSections: [
        ...new Set(
          (Array.isArray(row.completed_sections) ? row.completed_sections : []).filter(
            (section): section is (typeof criticalCareAccountSyncSections)[number] =>
              criticalCareAccountSyncSections.some((candidate) => candidate === section),
          ),
        ),
      ],
      completedAt: row.completed_at as string | null,
      lastVisitedAt: row.last_visited_at as string,
    })),
  })
  if (!response.success) {
    return NextResponse.json({ error: 'Unable to read coarse progress.' }, { status: 500 })
  }
  return NextResponse.json(response.data)
}
