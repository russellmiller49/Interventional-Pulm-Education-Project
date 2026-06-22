import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  Activity,
  Clock,
  Filter,
  KeyRound,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { professionalRoleOptions } from '@/lib/site-auth/profile-options'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Admin Dashboard | Interventional Pulmonology Education',
  robots: {
    index: false,
    follow: false,
  },
}

const ADMIN_EMAIL = 'admin@interventionalpulm.com'
const adminEntitlements = ['ip_registry', 'socal_ebus_course', 'site_admin'] as const
const ALL_INSTITUTIONS_FILTER = 'all'
const NOT_RECORDED_INSTITUTION_FILTER = 'not_recorded'

type AdminEntitlement = (typeof adminEntitlements)[number]

const permissionFilterOptions = [
  { value: 'all', label: 'All permissions' },
  { value: 'ip_registry_active', label: 'IP Registry active' },
  { value: 'ip_registry_inactive', label: 'IP Registry off' },
  { value: 'socal_ebus_course_active', label: 'SoCal EBUS Course active' },
  { value: 'socal_ebus_course_inactive', label: 'SoCal EBUS Course off' },
  { value: 'site_admin_active', label: 'Site Admin active' },
  { value: 'site_admin_inactive', label: 'Site Admin off' },
] as const

type PermissionFilter = (typeof permissionFilterOptions)[number]['value']

const agreementFilterOptions = [
  { value: 'all', label: 'All agreements' },
  { value: 'accepted', label: 'Agreement accepted' },
  { value: 'not_accepted', label: 'Agreement not accepted' },
  { value: 'research_consent', label: 'Research consent recorded' },
  { value: 'no_research_consent', label: 'Research consent missing' },
] as const

type AgreementFilter = (typeof agreementFilterOptions)[number]['value']

interface AdminSearchParams {
  agreement?: string
  institution?: string
  permission?: string
  q?: string
  status?: string
}

interface AdminDashboardPageProps {
  searchParams?: Promise<AdminSearchParams>
}

interface SiteProfileRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  professional_role: string | null
  institution: string | null
  country: string | null
  agreement_accepted_at: string | null
  agreement_version: string | null
  performance_research_consent: boolean | null
  onboarding_completed_at: string | null
  created_at: string | null
}

interface SiteEntitlementRow {
  user_id: string
  entitlement: string
  status: string
  granted_at: string | null
  expires_at: string | null
  notes: string | null
}

interface SiteModuleProgressRow {
  user_id: string
  module_id: string
  percent_complete: number | null
  total_time_seconds: number | null
  completed_at: string | null
  last_visited_at: string | null
}

interface SiteModuleSessionRow {
  user_id: string
  duration_seconds: number | null
  started_at: string | null
  last_heartbeat_at: string | null
}

interface LegacyEbusProfileRow {
  id: string
  email: string | null
  full_name: string | null
  institution: string | null
  approval_status: string | null
  approved_at: string | null
  onboarding_completed_at: string | null
}

interface UserUsageSummary {
  completedModules: number
  lastActivityAt: string | null
  moduleCount: number
  totalSeconds: number
}

interface AdminUserRow {
  id: string
  email: string
  displayName: string
  roleLabel: string
  institution: string
  country: string
  createdAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  profile: SiteProfileRow | null
  legacyEbusProfile: LegacyEbusProfileRow | null
  entitlements: SiteEntitlementRow[]
  usage: UserUsageSummary
}

interface AdminDashboardFilters {
  agreement: AgreementFilter
  institution: string
  permission: PermissionFilter
  q: string
}

interface InstitutionFilterOption {
  label: string
  value: string
}

interface AdminFilterOptions {
  institutions: InstitutionFilterOption[]
}

const roleLabels: Map<string, string> = new Map(
  professionalRoleOptions.map((option) => [option.value, option.label]),
)

const entitlementLabels: Record<AdminEntitlement, string> = {
  ip_registry: 'IP Registry',
  socal_ebus_course: 'SoCal EBUS Course',
  site_admin: 'Site Admin',
}

const permissionFilterConfig: Record<
  Exclude<PermissionFilter, 'all'>,
  { active: boolean; entitlement: AdminEntitlement }
> = {
  ip_registry_active: { active: true, entitlement: 'ip_registry' },
  ip_registry_inactive: { active: false, entitlement: 'ip_registry' },
  socal_ebus_course_active: { active: true, entitlement: 'socal_ebus_course' },
  socal_ebus_course_inactive: { active: false, entitlement: 'socal_ebus_course' },
  site_admin_active: { active: true, entitlement: 'site_admin' },
  site_admin_inactive: { active: false, entitlement: 'site_admin' },
}

const statusMessages: Record<string, string> = {
  entitlement_granted: 'Permission granted.',
  entitlement_revoked: 'Permission revoked.',
  missing_admin_client: 'Supabase service-role client is not configured.',
  missing_target: 'Choose a user and permission.',
  self_admin_revoke_blocked: 'You cannot revoke your own admin access.',
  update_failed: 'Permission update failed.',
}

function isAdminEntitlement(value: FormDataEntryValue | null): value is AdminEntitlement {
  return typeof value === 'string' && adminEntitlements.includes(value as AdminEntitlement)
}

function normalizeQuery(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function normalizeTextFilter(value: string | undefined) {
  return value?.trim() ?? ''
}

function normalizePermissionFilter(value: string | undefined): PermissionFilter {
  return permissionFilterOptions.some((option) => option.value === value)
    ? (value as PermissionFilter)
    : 'all'
}

function normalizeAgreementFilter(value: string | undefined): AgreementFilter {
  return agreementFilterOptions.some((option) => option.value === value)
    ? (value as AgreementFilter)
    : 'all'
}

function getAdminFilters(params?: AdminSearchParams): AdminDashboardFilters {
  return {
    agreement: normalizeAgreementFilter(params?.agreement),
    institution: normalizeTextFilter(params?.institution) || ALL_INSTITUTIONS_FILTER,
    permission: normalizePermissionFilter(params?.permission),
    q: normalizeTextFilter(params?.q),
  }
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : undefined
}

function hasActiveFilters(filters: AdminDashboardFilters) {
  return Boolean(
    filters.q ||
    filters.institution !== ALL_INSTITUTIONS_FILTER ||
    filters.permission !== 'all' ||
    filters.agreement !== 'all',
  )
}

function getDisplayName(
  profile: SiteProfileRow | null,
  user: User | null,
  legacyEbusProfile: LegacyEbusProfileRow | null = null,
) {
  const profileName = [profile?.first_name, profile?.last_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  if (profileName) {
    return profileName
  }

  const metadataName =
    typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''

  return (
    metadataName ||
    legacyEbusProfile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    profile?.email ||
    legacyEbusProfile?.email ||
    'Unknown user'
  )
}

function getRoleLabel(role: string | null | undefined) {
  if (!role) {
    return 'Profile pending'
  }

  return roleLabels.get(role) ?? role.replaceAll('_', ' ')
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDuration(totalSeconds: number) {
  if (!totalSeconds) {
    return '0 min'
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)

  if (hours < 1) {
    return `${minutes} min`
  }

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

function entitlementIsActive(row: SiteEntitlementRow) {
  if (row.status !== 'active') {
    return false
  }

  return !row.expires_at || new Date(row.expires_at).getTime() > Date.now()
}

function userHasLegacyEbusAccess(user: AdminUserRow) {
  return user.legacyEbusProfile?.approval_status === 'approved'
}

function userHasActiveSiteEntitlement(user: AdminUserRow, entitlement: AdminEntitlement) {
  return user.entitlements.some(
    (row) => row.entitlement === entitlement && entitlementIsActive(row),
  )
}

function userHasEffectiveEntitlement(user: AdminUserRow, entitlement: AdminEntitlement) {
  return (
    userHasActiveSiteEntitlement(user, entitlement) ||
    (entitlement === 'socal_ebus_course' && userHasLegacyEbusAccess(user))
  )
}

function userHasAcceptedAgreement(user: AdminUserRow) {
  return Boolean(user.profile?.agreement_accepted_at)
}

function userHasResearchConsent(user: AdminUserRow) {
  return Boolean(user.profile?.performance_research_consent)
}

function isNotRecordedInstitution(institution: string) {
  return institution.trim().toLowerCase() === 'not recorded'
}

function matchesInstitutionFilter(user: AdminUserRow, institutionFilter: string) {
  if (institutionFilter === ALL_INSTITUTIONS_FILTER) {
    return true
  }

  if (institutionFilter === NOT_RECORDED_INSTITUTION_FILTER) {
    return isNotRecordedInstitution(user.institution)
  }

  return user.institution.trim().toLowerCase() === institutionFilter.trim().toLowerCase()
}

function matchesPermissionFilter(user: AdminUserRow, permissionFilter: PermissionFilter) {
  if (permissionFilter === 'all') {
    return true
  }

  const config = permissionFilterConfig[permissionFilter]
  return userHasEffectiveEntitlement(user, config.entitlement) === config.active
}

function matchesAgreementFilter(user: AdminUserRow, agreementFilter: AgreementFilter) {
  switch (agreementFilter) {
    case 'accepted':
      return userHasAcceptedAgreement(user)
    case 'not_accepted':
      return !userHasAcceptedAgreement(user)
    case 'research_consent':
      return userHasResearchConsent(user)
    case 'no_research_consent':
      return !userHasResearchConsent(user)
    case 'all':
    default:
      return true
  }
}

function getInstitutionFilterOptions(users: AdminUserRow[]): InstitutionFilterOption[] {
  const institutionsByKey = new Map<string, InstitutionFilterOption>()
  let hasNotRecorded = false

  for (const user of users) {
    const institution = user.institution.trim()

    if (!institution || isNotRecordedInstitution(institution)) {
      hasNotRecorded = true
      continue
    }

    const key = institution.toLowerCase()
    if (!institutionsByKey.has(key)) {
      institutionsByKey.set(key, { label: institution, value: institution })
    }
  }

  const institutions = Array.from(institutionsByKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  )

  if (hasNotRecorded) {
    institutions.push({ label: 'Not recorded', value: NOT_RECORDED_INSTITUTION_FILTER })
  }

  return institutions
}

function buildAdminUrl(status: string, filters: AdminDashboardFilters) {
  const params = new URLSearchParams({ status })

  if (filters.q) {
    params.set('q', filters.q)
  }

  if (filters.institution !== ALL_INSTITUTIONS_FILTER) {
    params.set('institution', filters.institution)
  }

  if (filters.permission !== 'all') {
    params.set('permission', filters.permission)
  }

  if (filters.agreement !== 'all') {
    params.set('agreement', filters.agreement)
  }

  return `/admin?${params.toString()}` as Route
}

async function requireSiteAdminUser() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin' as Route)
  }

  if (!user.email_confirmed_at) {
    redirect('/verify-email' as Route)
  }

  const { data: adminEntitlement } = await supabase
    .from('site_entitlements')
    .select('entitlement')
    .eq('user_id', user.id)
    .eq('entitlement', 'site_admin')
    .eq('status', 'active')
    .maybeSingle()

  if (!adminEntitlement) {
    redirect('/dashboard?required=site_admin' as Route)
  }

  return user
}

async function updateSiteEntitlementAction(formData: FormData) {
  'use server'

  const currentUser = await requireSiteAdminUser()
  const filters = getAdminFilters({
    agreement: getFormString(formData, 'agreement'),
    institution: getFormString(formData, 'institution'),
    permission: getFormString(formData, 'permission'),
    q: getFormString(formData, 'q'),
  })
  const targetUserId = String(formData.get('userId') ?? '').trim()
  const requestedEntitlement = formData.get('entitlement')
  const requestedAction = String(formData.get('action') ?? '').trim()

  if (!targetUserId || !isAdminEntitlement(requestedEntitlement)) {
    redirect(buildAdminUrl('missing_target', filters))
  }

  if (!supabaseAdmin) {
    redirect(buildAdminUrl('missing_admin_client', filters))
  }

  if (
    requestedAction === 'revoke' &&
    requestedEntitlement === 'site_admin' &&
    targetUserId === currentUser.id
  ) {
    redirect(buildAdminUrl('self_admin_revoke_blocked', filters))
  }

  const now = new Date().toISOString()

  const result =
    requestedAction === 'revoke'
      ? await supabaseAdmin
          .from('site_entitlements')
          .update({
            status: 'revoked',
            expires_at: now,
            notes: `Revoked by ${currentUser.email ?? currentUser.id}`,
            updated_at: now,
          })
          .eq('user_id', targetUserId)
          .eq('entitlement', requestedEntitlement)
      : await supabaseAdmin.from('site_entitlements').upsert(
          {
            user_id: targetUserId,
            entitlement: requestedEntitlement,
            status: 'active',
            granted_by: currentUser.id,
            granted_at: now,
            expires_at: null,
            notes: `Granted by ${currentUser.email ?? currentUser.id}`,
            updated_at: now,
          },
          { onConflict: 'user_id,entitlement' },
        )

  if (result.error) {
    redirect(buildAdminUrl('update_failed', filters))
  }

  revalidatePath('/admin')
  redirect(
    buildAdminUrl(
      requestedAction === 'revoke' ? 'entitlement_revoked' : 'entitlement_granted',
      filters,
    ),
  )
}

async function loadAdminDashboardData(filters: AdminDashboardFilters) {
  if (!supabaseAdmin) {
    return {
      error: 'Supabase service-role client is not configured.',
      filterOptions: {
        institutions: [],
      },
      users: [] as AdminUserRow[],
      summary: {
        activeAdminCount: 0,
        activeEbusCourseCount: 0,
        activeRegistryCount: 0,
        totalHours: 0,
        totalUsers: 0,
      },
    }
  }

  const [
    authUsersResult,
    profilesResult,
    legacyEbusProfilesResult,
    entitlementsResult,
    progressResult,
    sessionsResult,
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
    supabaseAdmin
      .from('site_profiles')
      .select(
        'id,email,first_name,last_name,professional_role,institution,country,agreement_accepted_at,agreement_version,performance_research_consent,onboarding_completed_at,created_at',
      )
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('learner_profiles')
      .select('id,email,full_name,institution,approval_status,approved_at,onboarding_completed_at')
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('site_entitlements')
      .select('user_id,entitlement,status,granted_at,expires_at,notes')
      .order('granted_at', { ascending: false }),
    supabaseAdmin
      .from('site_module_progress')
      .select('user_id,module_id,percent_complete,total_time_seconds,completed_at,last_visited_at')
      .limit(5000),
    supabaseAdmin
      .from('site_module_sessions')
      .select('user_id,duration_seconds,started_at,last_heartbeat_at')
      .limit(5000),
  ])

  if (authUsersResult.error) {
    return {
      error: authUsersResult.error.message,
      filterOptions: {
        institutions: [],
      },
      users: [] as AdminUserRow[],
      summary: {
        activeAdminCount: 0,
        activeEbusCourseCount: 0,
        activeRegistryCount: 0,
        totalHours: 0,
        totalUsers: 0,
      },
    }
  }

  const authUsers = authUsersResult.data.users
  const profiles = ((profilesResult.data ?? []) as SiteProfileRow[]).filter(Boolean)
  const legacyEbusProfiles = (
    (legacyEbusProfilesResult.data ?? []) as LegacyEbusProfileRow[]
  ).filter(Boolean)
  const entitlements = ((entitlementsResult.data ?? []) as SiteEntitlementRow[]).filter(Boolean)
  const progressRows = ((progressResult.data ?? []) as SiteModuleProgressRow[]).filter(Boolean)
  const sessionRows = ((sessionsResult.data ?? []) as SiteModuleSessionRow[]).filter(Boolean)

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const legacyEbusProfilesById = new Map(legacyEbusProfiles.map((profile) => [profile.id, profile]))
  const usersById = new Map(authUsers.map((user) => [user.id, user]))
  const entitlementsByUser = new Map<string, SiteEntitlementRow[]>()
  const usageByUser = new Map<string, UserUsageSummary>()

  for (const entitlement of entitlements) {
    const current = entitlementsByUser.get(entitlement.user_id) ?? []
    current.push(entitlement)
    entitlementsByUser.set(entitlement.user_id, current)
  }

  for (const progress of progressRows) {
    const current = usageByUser.get(progress.user_id) ?? {
      completedModules: 0,
      lastActivityAt: null,
      moduleCount: 0,
      totalSeconds: 0,
    }

    current.moduleCount += 1
    current.totalSeconds += progress.total_time_seconds ?? 0
    current.completedModules += progress.completed_at ? 1 : 0
    if (
      progress.last_visited_at &&
      (!current.lastActivityAt ||
        new Date(progress.last_visited_at).getTime() > new Date(current.lastActivityAt).getTime())
    ) {
      current.lastActivityAt = progress.last_visited_at
    }

    usageByUser.set(progress.user_id, current)
  }

  for (const session of sessionRows) {
    const current = usageByUser.get(session.user_id) ?? {
      completedModules: 0,
      lastActivityAt: null,
      moduleCount: 0,
      totalSeconds: 0,
    }

    current.totalSeconds += session.duration_seconds ?? 0
    const sessionActivityAt = session.last_heartbeat_at ?? session.started_at
    if (
      sessionActivityAt &&
      (!current.lastActivityAt ||
        new Date(sessionActivityAt).getTime() > new Date(current.lastActivityAt).getTime())
    ) {
      current.lastActivityAt = sessionActivityAt
    }

    usageByUser.set(session.user_id, current)
  }

  const allUserIds = new Set<string>([
    ...authUsers.map((user) => user.id),
    ...profiles.map((profile) => profile.id),
    ...legacyEbusProfiles.map((profile) => profile.id),
  ])

  const searchQuery = normalizeQuery(filters.q)
  const allUsers = Array.from(allUserIds).map((userId): AdminUserRow => {
    const user = usersById.get(userId) ?? null
    const profile = profilesById.get(userId) ?? null
    const legacyEbusProfile = legacyEbusProfilesById.get(userId) ?? null
    const email = user?.email ?? profile?.email ?? legacyEbusProfile?.email ?? ''

    return {
      id: userId,
      email,
      displayName: getDisplayName(profile, user, legacyEbusProfile),
      roleLabel: getRoleLabel(profile?.professional_role),
      institution:
        profile?.institution?.trim() || legacyEbusProfile?.institution?.trim() || 'Not recorded',
      country: profile?.country?.trim() || 'Not recorded',
      createdAt: user?.created_at ?? profile?.created_at ?? null,
      lastSignInAt: user?.last_sign_in_at ?? null,
      emailConfirmedAt: user?.email_confirmed_at ?? null,
      profile,
      legacyEbusProfile,
      entitlements: entitlementsByUser.get(userId) ?? [],
      usage: usageByUser.get(userId) ?? {
        completedModules: 0,
        lastActivityAt: null,
        moduleCount: 0,
        totalSeconds: 0,
      },
    }
  })

  const filterOptions: AdminFilterOptions = {
    institutions: getInstitutionFilterOptions(allUsers),
  }

  const users = allUsers
    .filter((user) => {
      if (!searchQuery) {
        return true
      }

      const activePermissionLabels = adminEntitlements
        .filter((entitlement) => userHasEffectiveEntitlement(user, entitlement))
        .map((entitlement) => `${entitlementLabels[entitlement]} active`)
      const inactivePermissionLabels = adminEntitlements
        .filter((entitlement) => !userHasEffectiveEntitlement(user, entitlement))
        .map((entitlement) => `${entitlementLabels[entitlement]} off`)
      const haystack = [
        user.displayName,
        user.email,
        user.roleLabel,
        user.institution,
        user.country,
        userHasAcceptedAgreement(user) ? 'agreement accepted signed' : 'agreement not accepted',
        userHasResearchConsent(user) ? 'research consent recorded' : 'research consent missing',
        ...activePermissionLabels,
        ...inactivePermissionLabels,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchQuery)
    })
    .filter((user) => matchesInstitutionFilter(user, filters.institution))
    .filter((user) => matchesPermissionFilter(user, filters.permission))
    .filter((user) => matchesAgreementFilter(user, filters.agreement))
    .sort((a, b) => {
      const aActivity = a.usage.lastActivityAt ?? a.lastSignInAt ?? a.createdAt ?? ''
      const bActivity = b.usage.lastActivityAt ?? b.lastSignInAt ?? b.createdAt ?? ''
      return bActivity.localeCompare(aActivity)
    })

  const activeRegistryCount = users.filter((user) =>
    userHasEffectiveEntitlement(user, 'ip_registry'),
  ).length
  const activeAdminCount = users.filter((user) =>
    userHasEffectiveEntitlement(user, 'site_admin'),
  ).length
  const activeEbusCourseCount = users.filter((user) =>
    userHasEffectiveEntitlement(user, 'socal_ebus_course'),
  ).length
  const totalSeconds = users.reduce((total, user) => total + user.usage.totalSeconds, 0)

  return {
    error: [
      profilesResult.error,
      legacyEbusProfilesResult.error,
      entitlementsResult.error,
      progressResult.error,
      sessionsResult.error,
    ]
      .filter(Boolean)
      .map((error) => error?.message)
      .join(' '),
    filterOptions,
    users,
    summary: {
      activeAdminCount,
      activeEbusCourseCount,
      activeRegistryCount,
      totalHours: Math.round(totalSeconds / 3600),
      totalUsers: users.length,
    },
  }
}

function EntitlementBadge({
  entitlement,
  entitlements,
  hasLegacyEbusAccess,
}: {
  entitlement: AdminEntitlement
  entitlements: SiteEntitlementRow[]
  hasLegacyEbusAccess?: boolean
}) {
  const record = entitlements.find((row) => row.entitlement === entitlement)
  const active = record ? entitlementIsActive(record) : false
  const effectiveActive = active || (entitlement === 'socal_ebus_course' && hasLegacyEbusAccess)
  const suffix =
    entitlement === 'socal_ebus_course' && hasLegacyEbusAccess && !active
      ? ' active via course profile'
      : effectiveActive
        ? ''
        : ' off'

  return (
    <Badge
      variant={effectiveActive ? 'success' : 'outline'}
      className="normal-case tracking-normal"
    >
      {entitlementLabels[entitlement]}
      {suffix}
    </Badge>
  )
}

function LegacyEbusAccessAction() {
  return (
    <Button type="button" variant="ghost" size="sm" disabled className="w-full justify-start">
      <ShieldCheck className="h-4 w-4" aria-hidden />
      EBUS course profile active
    </Button>
  )
}

function EntitlementAction({
  action,
  entitlement,
  filters,
  isCurrentUser,
  userId,
}: {
  action: 'grant' | 'revoke'
  entitlement: AdminEntitlement
  filters: AdminDashboardFilters
  isCurrentUser: boolean
  userId: string
}) {
  const isSelfAdminRevoke = action === 'revoke' && entitlement === 'site_admin' && isCurrentUser

  return (
    <form action={updateSiteEntitlementAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="entitlement" value={entitlement} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="q" value={filters.q} />
      <input type="hidden" name="institution" value={filters.institution} />
      <input type="hidden" name="permission" value={filters.permission} />
      <input type="hidden" name="agreement" value={filters.agreement} />
      <Button
        type="submit"
        variant={action === 'grant' ? 'outline' : 'ghost'}
        size="sm"
        disabled={isSelfAdminRevoke}
        className="w-full justify-start"
      >
        {action === 'grant' ? (
          <ShieldCheck className="h-4 w-4" aria-hidden />
        ) : (
          <ShieldOff className="h-4 w-4" aria-hidden />
        )}
        {action === 'grant' ? 'Grant' : 'Revoke'} {entitlementLabels[entitlement]}
      </Button>
    </form>
  )
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const currentUser = await requireSiteAdminUser()
  const params = await searchParams
  const filters = getAdminFilters(params)
  const status = params?.status
  const { error, filterOptions, summary, users } = await loadAdminDashboardData(filters)
  const filtersAreActive = hasActiveFilters(filters)

  return (
    <main className="container space-y-8 py-10">
      <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="info">Admin</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Site admin dashboard
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Signed in as {currentUser.email ?? ADMIN_EMAIL}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={'/dashboard' as Route}>Back to dashboard</Link>
        </Button>
      </header>

      {status && statusMessages[status] ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          {statusMessages[status]}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden />
            Users
          </div>
          <p className="mt-2 text-2xl font-semibold">{summary.totalUsers}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="h-4 w-4" aria-hidden />
            Registry access
          </div>
          <p className="mt-2 text-2xl font-semibold">{summary.activeRegistryCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            EBUS course access
          </div>
          <p className="mt-2 text-2xl font-semibold">{summary.activeEbusCourseCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Admins
          </div>
          <p className="mt-2 text-2xl font-semibold">{summary.activeAdminCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            Total learning time
          </div>
          <p className="mt-2 text-2xl font-semibold">{summary.totalHours}h</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Users and permissions</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} matching {users.length === 1 ? 'user' : 'users'}
            </p>
          </div>
        </div>

        <form
          action="/admin"
          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(180px,1fr))_auto_auto] xl:items-end"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Search users"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              aria-label="Search users"
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Institution
            <select
              name="institution"
              defaultValue={filters.institution}
              className="mt-1 h-10 w-full rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value={ALL_INSTITUTIONS_FILTER}>All institutions</option>
              {filterOptions.institutions.map((institution) => (
                <option key={institution.value} value={institution.value}>
                  {institution.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Permissions
            <select
              name="permission"
              defaultValue={filters.permission}
              className="mt-1 h-10 w-full rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {permissionFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agreement
            <select
              name="agreement"
              defaultValue={filters.agreement}
              className="mt-1 h-10 w-full rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-normal normal-case tracking-normal text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {agreementFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            <Filter className="h-4 w-4" aria-hidden />
            Apply
          </Button>
          {filtersAreActive ? (
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href={'/admin' as Route}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset
              </Link>
            </Button>
          ) : null}
        </form>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Profile</th>
                <th className="px-4 py-3 font-medium">Agreement</th>
                <th className="px-4 py-3 font-medium">Permissions</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUser.id
                const hasLegacyEbusAccess = userHasLegacyEbusAccess(user)

                return (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="max-w-xs px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{user.displayName}</p>
                        <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex flex-wrap gap-1">
                          {user.emailConfirmedAt ? (
                            <Badge variant="success" size="sm">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" size="sm">
                              Unverified
                            </Badge>
                          )}
                          {user.email.toLowerCase() === ADMIN_EMAIL ? (
                            <Badge variant="info" size="sm">
                              Primary admin
                            </Badge>
                          ) : null}
                          {hasLegacyEbusAccess ? (
                            <Badge variant="success" size="sm">
                              EBUS course learner
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p>{user.roleLabel}</p>
                        <p className="text-xs text-muted-foreground">{user.institution}</p>
                        <p className="text-xs text-muted-foreground">{user.country}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {user.profile?.agreement_accepted_at ? (
                          <>
                            <Badge variant="success" size="sm">
                              Accepted
                            </Badge>
                            <p>{formatDate(user.profile.agreement_accepted_at)}</p>
                          </>
                        ) : (
                          <Badge variant="outline" size="sm">
                            Not accepted
                          </Badge>
                        )}
                        {user.profile?.performance_research_consent ? (
                          <p>Research consent recorded</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex max-w-sm flex-wrap gap-2">
                        {adminEntitlements.map((entitlement) => (
                          <EntitlementBadge
                            key={entitlement}
                            entitlement={entitlement}
                            entitlements={user.entitlements}
                            hasLegacyEbusAccess={hasLegacyEbusAccess}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1 text-sm text-foreground">
                          <Activity className="h-4 w-4" aria-hidden />
                          {formatDuration(user.usage.totalSeconds)}
                        </p>
                        <p>{user.usage.moduleCount} modules visited</p>
                        <p>{user.usage.completedModules} completed</p>
                        <p>Last active: {formatDate(user.usage.lastActivityAt)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="grid gap-2">
                        {adminEntitlements.map((entitlement) => {
                          const active = user.entitlements.some(
                            (row) => row.entitlement === entitlement && entitlementIsActive(row),
                          )

                          if (
                            entitlement === 'socal_ebus_course' &&
                            hasLegacyEbusAccess &&
                            !active
                          ) {
                            return <LegacyEbusAccessAction key={entitlement} />
                          }

                          return (
                            <EntitlementAction
                              key={entitlement}
                              action={active ? 'revoke' : 'grant'}
                              entitlement={entitlement}
                              filters={filters}
                              isCurrentUser={isCurrentUser}
                              userId={user.id}
                            />
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
