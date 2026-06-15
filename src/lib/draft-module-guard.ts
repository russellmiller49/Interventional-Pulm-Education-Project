import { notFound } from 'next/navigation'

import { areDraftModulesEnabled, canViewDraftModules } from '@/lib/draft-modules'
import { supabaseServer } from '@/lib/supabase/server'

export async function canCurrentUserViewDraftModules() {
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

    return canViewDraftModules({ isAdmin: Boolean(adminEntitlement) })
  } catch {
    return false
  }
}

export async function assertDraftModulesEnabled() {
  if (!(await canCurrentUserViewDraftModules())) {
    notFound()
  }
}
