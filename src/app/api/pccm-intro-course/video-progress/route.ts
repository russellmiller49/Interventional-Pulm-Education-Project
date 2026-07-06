import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createSupabaseAdmin } from '@/lib/supabase/admin'
import {
  loadActivePccmEnrollment,
  loadPccmIntroCourseAdminScope,
  loadPccmAssessmentAttempts,
  pccmCourseContentUnlocked,
  requirePccmApiUser,
} from '@/features/pccm-intro-course/server'
import {
  getPccmVideo,
  pccmAdminCanAccessVideo,
  userCanAccessPccmVideo,
} from '@/features/pccm-intro-course/content/videos'

export const dynamic = 'force-dynamic'

const progressSchema = z.object({
  durationSeconds: z.number().finite().min(0).max(86_400).optional(),
  lastPositionSeconds: z.number().finite().min(0).max(86_400).optional(),
  maxPercentComplete: z.number().finite().min(0).max(100),
  videoId: z.string().trim().min(1).max(160),
  watchedSeconds: z.number().finite().min(0).max(86_400).optional(),
})

export async function POST(request: Request) {
  const auth = await requirePccmApiUser()
  if (!auth.ok) {
    return auth.response
  }

  const payload = progressSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return jsonNoStore({ error: 'Invalid video progress payload.' }, 400)
  }

  const video = getPccmVideo(payload.data.videoId)
  if (!video) {
    return jsonNoStore({ error: 'Unknown PCCM intro course video.' }, 404)
  }

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    return jsonNoStore({ error: 'Supabase service-role credentials are not configured.' }, 501)
  }

  const [adminScope, enrollment] = await Promise.all([
    loadPccmIntroCourseAdminScope(supabase, auth.user.id),
    loadActivePccmEnrollment(supabase, auth.user.id),
  ])
  const adminCanAccessVideo = pccmAdminCanAccessVideo(
    video,
    adminScope.institutions,
    adminScope.canAccessAll,
  )

  if (
    !adminCanAccessVideo &&
    (!enrollment || !userCanAccessPccmVideo(video, enrollment.institution))
  ) {
    return jsonNoStore({ error: 'Video not available for this cohort.' }, 404)
  }

  const attempts = adminCanAccessVideo
    ? []
    : await loadPccmAssessmentAttempts(supabase, auth.user.id)
  if (
    !adminCanAccessVideo &&
    enrollment &&
    !pccmCourseContentUnlocked(enrollment.institution, attempts)
  ) {
    return jsonNoStore({ error: 'Complete both pretests before recording video progress.' }, 403)
  }

  const now = new Date().toISOString()
  const roundedPercent = Math.max(0, Math.min(100, Math.round(payload.data.maxPercentComplete)))
  const completedAt = roundedPercent >= 95 ? now : null
  const { data: current } = await supabase
    .from('pccm_intro_course_video_progress')
    .select('completed_at,max_percent_complete,watched_seconds')
    .eq('user_id', auth.user.id)
    .eq('video_id', video.id)
    .maybeSingle()

  const nextPercent = Math.max(current?.max_percent_complete ?? 0, roundedPercent)
  const nextWatchedSeconds = Math.max(
    current?.watched_seconds ?? 0,
    Math.round(payload.data.watchedSeconds ?? payload.data.lastPositionSeconds ?? 0),
  )
  const nextCompletedAt = current?.completed_at ?? completedAt

  const { error } = await supabase.from('pccm_intro_course_video_progress').upsert(
    {
      completed_at: nextCompletedAt,
      duration_seconds:
        typeof payload.data.durationSeconds === 'number'
          ? Math.round(payload.data.durationSeconds)
          : null,
      last_activity_at: now,
      last_position_seconds:
        typeof payload.data.lastPositionSeconds === 'number'
          ? Math.round(payload.data.lastPositionSeconds)
          : null,
      max_percent_complete: nextPercent,
      updated_at: now,
      user_id: auth.user.id,
      video_id: video.id,
      watched_seconds: nextWatchedSeconds,
    },
    { onConflict: 'user_id,video_id' },
  )

  if (error) {
    return jsonNoStore({ error: error.message }, 500)
  }

  await mirrorVideoProgressToSiteAnalytics({
    completedAt: nextCompletedAt,
    maxPercentComplete: nextPercent,
    now,
    supabase,
    userId: auth.user.id,
    videoId: video.id,
    videoTitle: video.title,
    watchedSeconds: nextWatchedSeconds,
  })

  return jsonNoStore({
    completedAt: nextCompletedAt,
    maxPercentComplete: nextPercent,
    status: 'ok',
  })
}

async function mirrorVideoProgressToSiteAnalytics({
  completedAt,
  maxPercentComplete,
  now,
  supabase,
  userId,
  videoId,
  videoTitle,
  watchedSeconds,
}: {
  completedAt: string | null
  maxPercentComplete: number
  now: string
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>
  userId: string
  videoId: string
  videoTitle: string
  watchedSeconds: number
}) {
  const moduleId = `pccm-intro-course:video:${videoId}`
  const routePath = '/pccm-intro-course'

  await supabase.from('site_module_events').insert({
    event_payload: {
      percentComplete: maxPercentComplete,
      videoId,
      videoTitle,
    },
    event_type: completedAt ? 'module_completed' : 'session_heartbeat',
    module_id: moduleId,
    route_path: routePath,
    user_id: userId,
  })

  const { data: current } = await supabase
    .from('site_module_progress')
    .select('completed_at,completed_sections,first_started_at,percent_complete,total_time_seconds')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .maybeSingle()

  const completedSections = new Set<string>(current?.completed_sections ?? [])
  if (completedAt) {
    completedSections.add('video')
  }

  await supabase.from('site_module_progress').upsert(
    {
      completed_at: current?.completed_at ?? completedAt,
      completed_sections: Array.from(completedSections),
      first_started_at: current?.first_started_at ?? now,
      last_visited_at: now,
      module_id: moduleId,
      percent_complete: Math.max(current?.percent_complete ?? 0, maxPercentComplete),
      total_time_seconds: Math.max(current?.total_time_seconds ?? 0, watchedSeconds),
      updated_at: now,
      user_id: userId,
    },
    { onConflict: 'user_id,module_id' },
  )
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
