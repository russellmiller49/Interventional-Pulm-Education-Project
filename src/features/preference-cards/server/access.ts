import { supabaseServer } from '@/lib/supabase/server'

const BUILDER_ENTITLEMENTS = ['preference_cards_builder', 'site_admin'] as const

interface OrganizationMembership {
  organization_id: string
  role: 'viewer' | 'builder' | 'admin' | 'content_owner'
}

export async function getPreferenceCardSession() {
  const supabase = await supabaseServer()
  const now = new Date().toISOString()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      user: null,
      memberships: [] as OrganizationMembership[],
      canBuild: false,
      canAdmin: false,
    }
  }

  const [entitlementResult, membershipResult] = await Promise.all([
    supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('entitlement', [...BUILDER_ENTITLEMENTS])
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    supabase
      .from('ip_organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('active', true),
  ])

  const entitlementSet = new Set((entitlementResult.data ?? []).map((row) => row.entitlement))
  const memberships = (membershipResult.data ?? []) as OrganizationMembership[]
  const canAdmin =
    entitlementSet.has('site_admin') ||
    memberships.some(
      (membership) => membership.role === 'admin' || membership.role === 'content_owner',
    )
  const canBuild =
    canAdmin ||
    entitlementSet.has('preference_cards_builder') ||
    memberships.some(
      (membership) =>
        membership.role === 'builder' ||
        membership.role === 'admin' ||
        membership.role === 'content_owner',
    )

  return {
    supabase,
    user,
    memberships,
    canBuild,
    canAdmin,
  }
}
