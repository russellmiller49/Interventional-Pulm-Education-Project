import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  getPccmQuestionMap,
  sanitizePccmAssessmentAttempt,
  sanitizePccmQuestionReveal,
} from '@/features/pccm-intro-course/assessment'
import {
  getOrCreatePccmAssessmentAttempt,
  loadActivePccmEnrollment,
  loadPccmCohortSettings,
  pccmAssessmentAnswerIsLocked,
  pccmPosttestsUnlocked,
  requirePccmApiUser,
  savePccmAssessmentAnswer,
  submitPccmAssessmentAttempt,
} from '@/features/pccm-intro-course/server'
import { getPccmAssessmentPhase, isPccmAssessmentKind } from '@/features/pccm-intro-course/types'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface AssessmentRouteContext {
  params: Promise<{
    attemptKind: string
  }>
}

const answerSchema = z.object({
  optionId: z.string().trim().min(1).max(80),
  questionId: z.string().trim().min(1).max(80),
})

export async function GET(_request: Request, context: AssessmentRouteContext) {
  const loaded = await loadAssessmentContext(context)
  if (!loaded.ok) {
    return loaded.response
  }

  return jsonNoStore({
    attempt: sanitizePccmAssessmentAttempt(loaded.attempt),
  })
}

export async function PATCH(request: Request, context: AssessmentRouteContext) {
  const loaded = await loadAssessmentContext(context)
  if (!loaded.ok) {
    return loaded.response
  }

  const payload = answerSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return jsonNoStore({ error: 'Choose a valid answer.' }, 400)
  }

  const question = getPccmQuestionMap(loaded.kind).get(payload.data.questionId)
  if (!question || !question.options.some((option) => option.id === payload.data.optionId)) {
    return jsonNoStore({ error: 'That answer does not belong to this assessment.' }, 400)
  }

  if (pccmAssessmentAnswerIsLocked(loaded.attempt, payload.data.questionId)) {
    return jsonNoStore(
      {
        attempt: sanitizePccmAssessmentAttempt(loaded.attempt),
        error: 'Posttest answers are final once correctness is shown.',
      },
      409,
    )
  }

  const attempt = await savePccmAssessmentAnswer(
    loaded.supabase,
    loaded.attempt,
    payload.data.questionId,
    payload.data.optionId,
  )
  const reveal = sanitizePccmQuestionReveal(
    loaded.kind,
    payload.data.questionId,
    payload.data.optionId,
  )

  await recordAssessmentEvent({
    attemptKind: loaded.kind,
    eventType: 'section_completed',
    questionId: payload.data.questionId,
    supabase: loaded.supabase,
    userId: loaded.userId,
  })

  return jsonNoStore({
    attempt: sanitizePccmAssessmentAttempt(attempt),
    reveal,
  })
}

export async function POST(_request: Request, context: AssessmentRouteContext) {
  const loaded = await loadAssessmentContext(context)
  if (!loaded.ok) {
    return loaded.response
  }

  const attempt = await submitPccmAssessmentAttempt(loaded.supabase, loaded.attempt)
  await recordAssessmentEvent({
    attemptKind: loaded.kind,
    eventType: 'quiz_submitted',
    supabase: loaded.supabase,
    userId: loaded.userId,
  })

  return jsonNoStore({
    attempt: sanitizePccmAssessmentAttempt(attempt),
  })
}

async function loadAssessmentContext(context: AssessmentRouteContext) {
  const auth = await requirePccmApiUser()
  if (!auth.ok) {
    return auth
  }

  const { attemptKind } = await context.params
  if (!isPccmAssessmentKind(attemptKind)) {
    return {
      ok: false as const,
      response: jsonNoStore({ error: 'Unknown PCCM intro course assessment.' }, 404),
    }
  }

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    return {
      ok: false as const,
      response: jsonNoStore(
        { error: 'Supabase service-role credentials are not configured.' },
        501,
      ),
    }
  }

  const enrollment = await loadActivePccmEnrollment(supabase, auth.user.id)
  if (!enrollment) {
    return {
      ok: false as const,
      response: jsonNoStore({ error: 'PCCM intro course enrollment required.' }, 403),
    }
  }

  if (getPccmAssessmentPhase(attemptKind) === 'post') {
    const cohortSettings = await loadPccmCohortSettings(supabase, enrollment.institution)

    if (!pccmPosttestsUnlocked(enrollment.institution, cohortSettings)) {
      return {
        ok: false as const,
        response: jsonNoStore(
          {
            error:
              'Loma Linda posttests are locked until the course administrator releases them after course completion.',
          },
          403,
        ),
      }
    }
  }

  const attempt = await getOrCreatePccmAssessmentAttempt(
    supabase,
    auth.user.id,
    enrollment,
    attemptKind,
  )

  return {
    attempt,
    kind: attemptKind,
    ok: true as const,
    supabase,
    userId: auth.user.id,
  }
}

async function recordAssessmentEvent({
  attemptKind,
  eventType,
  questionId,
  supabase,
  userId,
}: {
  attemptKind: string
  eventType: 'quiz_submitted' | 'section_completed'
  questionId?: string
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>
  userId: string
}) {
  await supabase.from('site_module_events').insert({
    event_payload: {
      attemptKind,
      ...(questionId ? { questionId } : {}),
    },
    event_type: eventType,
    module_id: `pccm-intro-course:assessment:${attemptKind}`,
    route_path: `/pccm-intro-course/assessments/${attemptKind}`,
    user_id: userId,
  })
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
