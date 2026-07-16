import { notFound } from 'next/navigation'

import { pccmIntroCourseAdminEntitlements } from '@/features/pccm-intro-course/server'
import { areDraftModulesEnabled, canViewDraftModules } from '@/lib/draft-modules'
import { supabaseServer } from '@/lib/supabase/server'

interface DraftModuleGuardOptions {
  allowPccmIntroCourse?: boolean
}

export async function canCurrentUserViewDraftModules(options: DraftModuleGuardOptions = {}) {
  if (areDraftModulesEnabled) {
    return true
  }

  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return false
    }

    const { data: adminEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('entitlement', 'site_admin')
      .eq('status', 'active')
      .maybeSingle()

    if (adminEntitlement) {
      return canViewDraftModules({ isAdmin: true })
    }

    if (!options.allowPccmIntroCourse) {
      return false
    }

    const { data: pccmEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('entitlement', [
        'pccm_intro_course',
        pccmIntroCourseAdminEntitlements.ucsd,
        pccmIntroCourseAdminEntitlements.loma_linda,
      ])
      .limit(1)
      .maybeSingle()

    return Boolean(pccmEntitlement)
  } catch {
    return false
  }
}

export async function assertDraftModulesEnabled(options: DraftModuleGuardOptions = {}) {
  if (!(await canCurrentUserViewDraftModules(options))) {
    notFound()
  }
}
