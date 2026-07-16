import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getPccmIntroCourseAdminEntitlement,
  hashPccmAccessCode,
  requirePccmApiUser,
} from '@/features/pccm-intro-course/server'
import { isPccmInstitution } from '@/features/pccm-intro-course/types'
import type { SiteEntitlement } from '@/lib/site-auth/access'

export const dynamic = 'force-dynamic'

const redeemCodeSchema = z.object({
  code: z.string().trim().min(1).max(256),
})

interface AccessCodeRow {
  active: boolean
  code_hash: string
  code_type: 'admin' | 'learner'
  institution: string
}

export async function POST(request: Request) {
  const auth = await requirePccmApiUser()
  if (!auth.ok) {
    return auth.response
  }

  const payload = redeemCodeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) {
    return jsonNoStore({ error: 'Enter a valid course code.' }, 400)
  }

  const supabase = createSupabaseAdmin()
  if (!supabase) {
    return jsonNoStore({ error: 'Supabase service-role credentials are not configured.' }, 501)
  }

  const codeHash = hashPccmAccessCode(payload.data.code)
  const { data: accessCode, error: codeError } = await supabase
    .from('pccm_intro_course_access_codes')
    .select('code_hash,institution,active,code_type')
    .eq('code_hash', codeHash)
    .maybeSingle()

  if (codeError) {
    if (isPccmIntroCourseSchemaCacheError(codeError)) {
      return jsonNoStore(
        {
          error:
            'The PCCM intro course database migration has not been applied yet. Apply the Supabase migration and retry this code.',
        },
        503,
      )
    }

    return jsonNoStore({ error: codeError.message }, 500)
  }

  const codeRow = accessCode as AccessCodeRow | null
  if (!codeRow?.active || !isPccmInstitution(codeRow.institution)) {
    return jsonNoStore({ error: 'That course code was not recognized.' }, 404)
  }

  if (codeRow.code_type === 'admin') {
    const adminEntitlement = getPccmIntroCourseAdminEntitlement(codeRow.institution)
    const [courseEntitlementResult, adminEntitlementResult] = await Promise.all([
      grantSiteEntitlement(
        supabase,
        auth.user.id,
        auth.user.id,
        'pccm_intro_course',
        'Granted by PCCM intro course admin code redemption.',
      ),
      grantSiteEntitlement(
        supabase,
        auth.user.id,
        auth.user.id,
        adminEntitlement,
        'Granted by PCCM intro course admin code redemption.',
      ),
    ])

    const entitlementError = courseEntitlementResult.error ?? adminEntitlementResult.error
    if (entitlementError) {
      return jsonNoStore({ error: entitlementError.message }, 500)
    }

    return jsonNoStore({
      adminEntitlement,
      institution: codeRow.institution,
      status: 'admin_access_granted',
    })
  }

  const { data: existingEnrollment, error: enrollmentError } = await supabase
    .from('pccm_intro_course_enrollments')
    .select('id,institution,status,enrolled_at')
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (enrollmentError) {
    if (isPccmIntroCourseSchemaCacheError(enrollmentError)) {
      return jsonNoStore(
        {
          error:
            'The PCCM intro course database migration has not been applied yet. Apply the Supabase migration and retry this code.',
        },
        503,
      )
    }

    return jsonNoStore({ error: enrollmentError.message }, 500)
  }

  if (existingEnrollment) {
    if (existingEnrollment.institution !== codeRow.institution) {
      return jsonNoStore(
        { error: 'This account is already enrolled in a different PCCM intro cohort.' },
        409,
      )
    }

    await grantSiteEntitlement(
      supabase,
      auth.user.id,
      auth.user.id,
      'pccm_intro_course',
      'Granted by PCCM intro course code redemption.',
    )
    return jsonNoStore({
      enrollment: existingEnrollment,
      institution: codeRow.institution,
      status: 'already_enrolled',
    })
  }

  const now = new Date().toISOString()
  const { data: enrollment, error: createError } = await supabase
    .from('pccm_intro_course_enrollments')
    .insert({
      access_code_hash: codeRow.code_hash,
      enrolled_at: now,
      institution: codeRow.institution,
      notes: 'Self-enrolled with PCCM intro course code.',
      status: 'active',
      user_id: auth.user.id,
    })
    .select('id,user_id,institution,status,enrolled_at')
    .single()

  if (createError) {
    return jsonNoStore({ error: createError.message }, 500)
  }

  const entitlementResult = await grantSiteEntitlement(
    supabase,
    auth.user.id,
    auth.user.id,
    'pccm_intro_course',
    'Granted by PCCM intro course code redemption.',
  )
  if (entitlementResult.error) {
    return jsonNoStore({ error: entitlementResult.error.message }, 500)
  }

  return jsonNoStore({
    enrollment,
    institution: codeRow.institution,
    status: 'enrolled',
  })
}

async function grantSiteEntitlement(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  actorId: string,
  entitlement: SiteEntitlement,
  notes: string,
) {
  if (!supabase) {
    return { error: new Error('Supabase service-role credentials are not configured.') }
  }

  const now = new Date().toISOString()
  return supabase.from('site_entitlements').upsert(
    {
      entitlement,
      expires_at: null,
      granted_at: now,
      granted_by: actorId,
      notes,
      status: 'active',
      updated_at: now,
      user_id: userId,
    },
    { onConflict: 'user_id,entitlement' },
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

function isPccmIntroCourseSchemaCacheError(error: { code?: string; message?: string }) {
  const message = error.message ?? ''

  return (
    error.code === 'PGRST205' ||
    (message.includes('schema cache') && message.includes('pccm_intro_course'))
  )
}
