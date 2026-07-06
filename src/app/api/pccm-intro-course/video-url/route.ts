import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase/admin'
import {
  loadActivePccmEnrollment,
  loadPccmIntroCourseAdminScope,
  loadPccmAssessmentAttempts,
  pccmCourseContentUnlocked,
  requirePccmApiUser,
} from '@/features/pccm-intro-course/server'
import {
  type PccmCourseVideo,
  getPccmVideo,
  pccmAdminCanAccessVideo,
  PCCM_INTRO_COURSE_MEDIA_BUCKET,
  userCanAccessPccmVideo,
} from '@/features/pccm-intro-course/content/videos'
import { createPccmS3VideoUrl } from '@/features/pccm-intro-course/s3-media'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePccmApiUser()
  if (!auth.ok) {
    return auth.response
  }

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    return jsonNoStore({ error: 'Supabase service-role credentials are not configured.' }, 501)
  }

  const { searchParams } = new URL(request.url)
  const video = getPccmVideo(searchParams.get('videoId'))
  if (!video) {
    return jsonNoStore({ error: 'Unknown PCCM intro course video.' }, 404)
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

  if (adminCanAccessVideo) {
    return createCourseVideoUrl({
      supabase,
      video,
    })
  }

  if (!enrollment || !userCanAccessPccmVideo(video, enrollment.institution)) {
    return jsonNoStore({ error: 'Video not available for this cohort.' }, 404)
  }

  const attempts = await loadPccmAssessmentAttempts(supabase, auth.user.id)
  if (!pccmCourseContentUnlocked(enrollment.institution, attempts)) {
    return jsonNoStore({ error: 'Complete both pretests before opening course videos.' }, 403)
  }

  return createCourseVideoUrl({
    supabase,
    video,
  })
}

async function createCourseVideoUrl({
  supabase,
  video,
}: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>
  video: PccmCourseVideo
}) {
  const expiresIn = resolvePccmVideoTtl()

  if (resolvePccmMediaProvider() === 'supabase') {
    return createSupabaseSignedVideoUrl({
      expiresIn,
      storagePath: video.storagePath,
      supabase,
      title: video.title,
      videoId: video.id,
    })
  }

  const s3VideoUrl = createPccmS3VideoUrl(video, expiresIn)
  if (!s3VideoUrl.signed) {
    const availability = await checkPublicVideoUrl(s3VideoUrl.url)
    if (!availability.ok) {
      return jsonNoStore(
        {
          error:
            availability.status === 403
              ? 'The S3 course video is private. Configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for server-side video URL signing, or make this S3 object readable.'
              : availability.status === 404
                ? 'This S3 course video was not found.'
                : 'Unable to verify this S3 course video.',
        },
        availability.status === 404 ? 404 : 503,
      )
    }
  }

  return jsonNoStore({
    expiresIn: s3VideoUrl.signed ? expiresIn : null,
    title: video.title,
    url: s3VideoUrl.url,
    videoId: video.id,
  })
}

async function createSupabaseSignedVideoUrl({
  expiresIn,
  storagePath,
  supabase,
  title,
  videoId,
}: {
  expiresIn: number
  storagePath: string
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>
  title: string
  videoId: string
}) {
  const { data, error } = await supabase.storage
    .from(PCCM_INTRO_COURSE_MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresIn, {
      download: false,
    })

  if (error || !data?.signedUrl) {
    if (isMissingPccmVideoObjectError(error)) {
      return jsonNoStore({ error: 'This course video has not been uploaded yet.' }, 404)
    }

    return jsonNoStore(
      { error: error?.message ?? 'Unable to create a signed course video URL.' },
      500,
    )
  }

  return jsonNoStore({
    expiresIn,
    title,
    url: data.signedUrl,
    videoId,
  })
}

function resolvePccmMediaProvider() {
  return process.env.PCCM_INTRO_COURSE_MEDIA_PROVIDER === 'supabase' ? 'supabase' : 's3'
}

async function checkPublicVideoUrl(url: string) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      method: 'HEAD',
    })

    return {
      ok: response.ok,
      status: response.status,
    }
  } catch {
    return {
      ok: false,
      status: 503,
    }
  }
}

function isMissingPccmVideoObjectError(error: { message?: string; statusCode?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.statusCode === '404' || message.includes('object not found')
}

function resolvePccmVideoTtl() {
  const configured = Number(process.env.PCCM_INTRO_COURSE_SIGNED_URL_TTL_SECONDS)
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(60, Math.min(3600, Math.floor(configured)))
  }

  return 1800
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
