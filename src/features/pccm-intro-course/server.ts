import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import {
  buildPccmAssessmentOrder,
  normalizePccmAnswers,
  scorePccmAssessmentAttempt,
} from './assessment'
import {
  type PccmAssessmentAttemptRow,
  type PccmAssessmentKind,
  type PccmEnrollment,
  type PccmInstitution,
  type PccmVideoProgressRow,
  pccmInstitutions,
} from './types'
import type { SiteEntitlement } from '@/lib/site-auth/access'
import { supabaseServer } from '@/lib/supabase/server'

export const pccmIntroCourseAdminEntitlements = {
  loma_linda: 'pccm_intro_course_admin_loma_linda',
  ucsd: 'pccm_intro_course_admin_ucsd',
} as const satisfies Record<PccmInstitution, SiteEntitlement>

export interface PccmIntroCourseAdminScope {
  canAccessAll: boolean
  institutions: PccmInstitution[]
  isSiteAdmin: boolean
}

export type PccmApiAuthResult =
  | {
      ok: true
      user: User
    }
  | {
      ok: false
      response: NextResponse
    }

export function hashPccmAccessCode(code: string) {
  return createHash('sha256').update(code.trim()).digest('hex')
}

export function getPccmIntroCourseAdminEntitlement(institution: PccmInstitution) {
  return pccmIntroCourseAdminEntitlements[institution]
}

export function userCanAdministerPccmInstitution(
  scope: PccmIntroCourseAdminScope,
  institution: PccmInstitution,
) {
  return scope.canAccessAll || scope.institutions.includes(institution)
}

export async function loadPccmIntroCourseAdminScope(
  supabase: SupabaseClient,
  userId: string,
): Promise<PccmIntroCourseAdminScope> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('site_entitlements')
    .select('entitlement')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('entitlement', [
      'site_admin',
      pccmIntroCourseAdminEntitlements.ucsd,
      pccmIntroCourseAdminEntitlements.loma_linda,
    ])
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  const activeEntitlements = new Set((data ?? []).map((row) => row.entitlement))
  const isSiteAdmin = activeEntitlements.has('site_admin')
  const institutions = pccmInstitutions.filter((institution) =>
    activeEntitlements.has(pccmIntroCourseAdminEntitlements[institution]),
  )

  return {
    canAccessAll: isSiteAdmin,
    institutions: isSiteAdmin ? [...pccmInstitutions] : institutions,
    isSiteAdmin,
  }
}

export async function requirePccmApiUser(): Promise<PccmApiAuthResult> {
  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error && user) {
      return {
        ok: true,
        user,
      }
    }
  } catch {
    // Fall through to the standard protected API response.
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: 'Authentication required.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    ),
  }
}

export async function loadActivePccmEnrollment(
  supabase: SupabaseClient,
  userId: string,
): Promise<PccmEnrollment | null> {
  const { data, error } = await supabase
    .from('pccm_intro_course_enrollments')
    .select('id,user_id,institution,status,enrolled_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as PccmEnrollment
}

export async function loadPccmAssessmentAttempts(
  supabase: SupabaseClient,
  userId: string,
): Promise<PccmAssessmentAttemptRow[]> {
  const { data } = await supabase
    .from('pccm_intro_course_assessment_attempts')
    .select(
      'id,user_id,enrollment_id,attempt_kind,question_order,choice_order,answers,score,total,submitted_at,created_at,updated_at',
    )
    .eq('user_id', userId)

  return ((data ?? []) as PccmAssessmentAttemptRow[]).map(normalizeAttemptRow)
}

export async function loadPccmVideoProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<PccmVideoProgressRow[]> {
  const { data } = await supabase
    .from('pccm_intro_course_video_progress')
    .select(
      'user_id,video_id,max_percent_complete,watched_seconds,duration_seconds,last_position_seconds,completed_at,last_activity_at',
    )
    .eq('user_id', userId)

  return (data ?? []) as PccmVideoProgressRow[]
}

export async function getOrCreatePccmAssessmentAttempt(
  supabase: SupabaseClient,
  userId: string,
  enrollment: PccmEnrollment,
  kind: PccmAssessmentKind,
) {
  const { data: existing, error: readError } = await supabase
    .from('pccm_intro_course_assessment_attempts')
    .select(
      'id,user_id,enrollment_id,attempt_kind,question_order,choice_order,answers,score,total,submitted_at,created_at,updated_at',
    )
    .eq('user_id', userId)
    .eq('attempt_kind', kind)
    .maybeSingle()

  if (readError) {
    throw readError
  }

  if (existing) {
    return normalizeAttemptRow(existing as PccmAssessmentAttemptRow)
  }

  const order = buildPccmAssessmentOrder(kind, userId)
  const total = order.question_order.length
  const { data: created, error: createError } = await supabase
    .from('pccm_intro_course_assessment_attempts')
    .insert({
      answers: {},
      attempt_kind: kind,
      choice_order: order.choice_order,
      enrollment_id: enrollment.id,
      question_order: order.question_order,
      total,
      user_id: userId,
    })
    .select(
      'id,user_id,enrollment_id,attempt_kind,question_order,choice_order,answers,score,total,submitted_at,created_at,updated_at',
    )
    .single()

  if (createError) {
    throw createError
  }

  return normalizeAttemptRow(created as PccmAssessmentAttemptRow)
}

export async function savePccmAssessmentAnswer(
  supabase: SupabaseClient,
  attempt: PccmAssessmentAttemptRow,
  questionId: string,
  optionId: string,
) {
  if (attempt.submitted_at) {
    return attempt
  }

  const answers = {
    ...attempt.answers,
    [questionId]: optionId,
  }

  const { data, error } = await supabase
    .from('pccm_intro_course_assessment_attempts')
    .update({
      answers,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attempt.id)
    .eq('user_id', attempt.user_id)
    .select(
      'id,user_id,enrollment_id,attempt_kind,question_order,choice_order,answers,score,total,submitted_at,created_at,updated_at',
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeAttemptRow(data as PccmAssessmentAttemptRow)
}

export async function submitPccmAssessmentAttempt(
  supabase: SupabaseClient,
  attempt: PccmAssessmentAttemptRow,
) {
  if (attempt.submitted_at) {
    return attempt
  }

  const now = new Date().toISOString()
  const { score, total } = scorePccmAssessmentAttempt(attempt.attempt_kind, attempt.answers)
  const { data, error } = await supabase
    .from('pccm_intro_course_assessment_attempts')
    .update({
      score,
      submitted_at: now,
      total,
      updated_at: now,
    })
    .eq('id', attempt.id)
    .eq('user_id', attempt.user_id)
    .select(
      'id,user_id,enrollment_id,attempt_kind,question_order,choice_order,answers,score,total,submitted_at,created_at,updated_at',
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeAttemptRow(data as PccmAssessmentAttemptRow)
}

export function lomaLindaPretestsComplete(attempts: readonly PccmAssessmentAttemptRow[]) {
  return (
    attempts.some(
      (attempt) => attempt.attempt_kind === 'bronchoscopy_pre' && Boolean(attempt.submitted_at),
    ) &&
    attempts.some(
      (attempt) => attempt.attempt_kind === 'pleural_pre' && Boolean(attempt.submitted_at),
    )
  )
}

export function pccmCourseContentUnlocked(
  institution: PccmInstitution,
  attempts: readonly PccmAssessmentAttemptRow[],
) {
  return institution === 'ucsd' || lomaLindaPretestsComplete(attempts)
}

function normalizeAttemptRow(row: PccmAssessmentAttemptRow): PccmAssessmentAttemptRow {
  return {
    ...row,
    answers: normalizePccmAnswers(row.answers),
    attempt_kind: row.attempt_kind as PccmAssessmentKind,
    choice_order: normalizeChoiceOrder(row.choice_order),
  }
}

function normalizeChoiceOrder(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .map(([questionId, choices]) => [
        questionId,
        choices.filter((choice): choice is string => typeof choice === 'string'),
      ]),
  )
}
