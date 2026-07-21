import { supabaseServer } from '@/lib/supabase/server'

const SOCRATES_EDITOR_ENTITLEMENTS = ['socrates_editor', 'site_admin'] as const

export async function getSocratesEditorSession() {
  const supabase = await supabaseServer()
  const now = new Date().toISOString()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      canEdit: false,
      canPublish: false,
    }
  }

  const { data: entitlements } = await supabase
    .from('site_entitlements')
    .select('entitlement')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('entitlement', [...SOCRATES_EDITOR_ENTITLEMENTS])
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  const entitlementSet = new Set((entitlements ?? []).map((row) => row.entitlement))
  return {
    supabase,
    user,
    canEdit: entitlementSet.has('socrates_editor') || entitlementSet.has('site_admin'),
    canPublish: entitlementSet.has('site_admin'),
  }
}
