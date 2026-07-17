import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  BAXTER_CRRT_ANALYTICS_MODULE_ID,
  expectedBaxterCrrtAnalyticsEventType,
  validateBaxterCrrtAnalyticsEventPayload,
} from '@/lib/baxter-crrt-analytics'
import { resolveSiteModuleId } from '@/lib/site-auth/access'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const analyticsPayloadSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  eventPayload: z.record(z.unknown()).optional(),
  eventType: z.enum([
    'module_completed',
    'module_interaction',
    'module_opened',
    'quiz_submitted',
    'section_completed',
    'session_end',
    'session_heartbeat',
    'session_start',
  ]),
  moduleId: z.string().trim().min(1).max(160),
  percentComplete: z.number().int().min(0).max(100).optional(),
  routePath: z.string().trim().startsWith('/').max(500),
  section: z.string().trim().min(1).max(120).optional(),
  sessionId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const rawPayload = await request.json().catch(() => null)
  const payload = analyticsPayloadSchema.safeParse(rawPayload)

  if (!payload.success) {
    return NextResponse.json({ error: 'Invalid analytics payload.' }, { status: 400 })
  }

  const event = payload.data
  let validatedEventPayload = event.eventPayload
  const isBaxterCrrtEvent = event.moduleId === BAXTER_CRRT_ANALYTICS_MODULE_ID
  if (isBaxterCrrtEvent) {
    if (event.eventPayload === undefined) {
      return NextResponse.json({ error: 'Invalid Baxter CRRT analytics payload.' }, { status: 400 })
    }

    const crrtPayload = validateBaxterCrrtAnalyticsEventPayload(event.eventPayload)
    const hasGenericProgressOrSessionFields =
      event.durationSeconds !== undefined ||
      event.percentComplete !== undefined ||
      event.section !== undefined ||
      event.sessionId !== undefined
    if (
      !crrtPayload.success ||
      hasGenericProgressOrSessionFields ||
      resolveSiteModuleId(event.routePath) !== BAXTER_CRRT_ANALYTICS_MODULE_ID ||
      (crrtPayload.success &&
        event.eventType !== expectedBaxterCrrtAnalyticsEventType(crrtPayload.data.interaction))
    ) {
      return NextResponse.json({ error: 'Invalid Baxter CRRT analytics payload.' }, { status: 400 })
    }

    validatedEventPayload = crrtPayload.data
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const userId = user.id
  const now = new Date().toISOString()
  const durationSeconds = event.durationSeconds ?? 0
  const eventPayload = validatedEventPayload ?? {}

  // CRRT maintains its protected learner progress locally. During the Phase 7 review boundary,
  // the server records only allowlisted learner interaction summaries and never derives generic
  // session time, section completion, module percentage, or completion from them.
  if (isBaxterCrrtEvent) {
    await recordModuleEvent(event.eventType)
    return NextResponse.json({ status: 'ok' })
  }

  if (event.eventType === 'session_start') {
    if (!event.sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
    }

    const { error: sessionError } = await supabase.from('site_module_sessions').upsert(
      {
        id: event.sessionId,
        duration_seconds: durationSeconds,
        last_heartbeat_at: now,
        module_id: event.moduleId,
        route_path: event.routePath,
        started_at: now,
        user_id: userId,
      },
      { onConflict: 'id' },
    )

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    await recordModuleEvent('module_opened')
    await updateModuleProgress({ totalTimeDeltaSeconds: 0 })

    return NextResponse.json({ status: 'ok' })
  }

  if (event.eventType === 'session_heartbeat' || event.eventType === 'session_end') {
    if (!event.sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })
    }

    if (event.eventType === 'session_end') {
      const { data: closedSessions, error: sessionError } = await supabase
        .from('site_module_sessions')
        .update({
          duration_seconds: durationSeconds,
          ended_at: now,
          last_heartbeat_at: now,
        })
        .eq('id', event.sessionId)
        .eq('user_id', userId)
        .is('ended_at', null)
        .select('id')

      if (sessionError) {
        return NextResponse.json({ error: sessionError.message }, { status: 500 })
      }

      if ((closedSessions ?? []).length > 0) {
        await recordModuleEvent('session_ended')
        await updateModuleProgress({ totalTimeDeltaSeconds: durationSeconds })
      }

      return NextResponse.json({ status: 'ok' })
    }

    const { error: sessionError } = await supabase
      .from('site_module_sessions')
      .update({
        duration_seconds: durationSeconds,
        last_heartbeat_at: now,
      })
      .eq('id', event.sessionId)
      .eq('user_id', userId)
      .is('ended_at', null)

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 })
    }

    await updateModuleProgress({ totalTimeDeltaSeconds: 0 })

    return NextResponse.json({ status: 'ok' })
  }

  if (event.eventType === 'module_interaction') {
    await recordModuleEvent(event.eventType)
    return NextResponse.json({ status: 'ok' })
  }

  await recordModuleEvent(event.eventType)
  await updateModuleProgress({
    completedSection: event.eventType === 'section_completed' ? event.section : undefined,
    completedModule: event.eventType === 'module_completed',
    percentComplete: event.percentComplete,
    totalTimeDeltaSeconds: 0,
  })

  return NextResponse.json({ status: 'ok' })

  async function recordModuleEvent(eventType: string) {
    const { error } = await supabase.from('site_module_events').insert({
      event_payload: {
        ...eventPayload,
        ...(typeof event.percentComplete === 'number'
          ? { percentComplete: event.percentComplete }
          : {}),
        ...(event.section ? { section: event.section } : {}),
      },
      event_type: eventType,
      module_id: event.moduleId,
      route_path: event.routePath,
      session_id: event.sessionId ?? null,
      user_id: userId,
    })

    if (error) {
      console.warn('Unable to record module event', error)
    }
  }

  async function updateModuleProgress({
    completedModule = false,
    completedSection,
    percentComplete,
    totalTimeDeltaSeconds,
  }: {
    completedModule?: boolean
    completedSection?: string
    percentComplete?: number
    totalTimeDeltaSeconds: number
  }) {
    const { data: current, error: readError } = await supabase
      .from('site_module_progress')
      .select(
        'completed_at, completed_sections, first_started_at, percent_complete, total_time_seconds',
      )
      .eq('user_id', userId)
      .eq('module_id', event.moduleId)
      .maybeSingle()

    if (readError) {
      console.warn('Unable to read module progress', readError)
      return
    }

    const completedSections = new Set<string>(current?.completed_sections ?? [])
    if (completedSection) {
      completedSections.add(completedSection)
    }

    const nextPercent = Math.max(
      current?.percent_complete ?? 0,
      completedModule ? 100 : 0,
      percentComplete ?? 0,
    )
    const nextCompletedAt =
      current?.completed_at ?? (completedModule || nextPercent >= 100 ? now : null)

    const { error: writeError } = await supabase.from('site_module_progress').upsert(
      {
        completed_at: nextCompletedAt,
        completed_sections: Array.from(completedSections),
        first_started_at: current?.first_started_at ?? now,
        last_visited_at: now,
        module_id: event.moduleId,
        percent_complete: nextPercent,
        total_time_seconds: (current?.total_time_seconds ?? 0) + totalTimeDeltaSeconds,
        updated_at: now,
        user_id: userId,
      },
      { onConflict: 'user_id,module_id' },
    )

    if (writeError) {
      console.warn('Unable to write module progress', writeError)
    }
  }
}
