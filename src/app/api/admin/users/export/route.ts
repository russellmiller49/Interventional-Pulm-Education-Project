import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { professionalRoleOptions } from '@/lib/site-auth/profile-options'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const adminEntitlements = [
  'ip_registry',
  'pccm_intro_course',
  'pccm_intro_course_admin_ucsd',
  'pccm_intro_course_admin_loma_linda',
  'socal_ebus_course',
  'site_admin',
] as const
const ALL_INSTITUTIONS_FILTER = 'all'
const NOT_RECORDED_INSTITUTION_FILTER = 'not_recorded'

type AdminEntitlement = (typeof adminEntitlements)[number]
type PermissionFilter =
  | 'all'
  | 'ip_registry_active'
  | 'ip_registry_inactive'
  | 'pccm_intro_course_active'
  | 'pccm_intro_course_inactive'
  | 'pccm_intro_course_admin_ucsd_active'
  | 'pccm_intro_course_admin_ucsd_inactive'
  | 'pccm_intro_course_admin_loma_linda_active'
  | 'pccm_intro_course_admin_loma_linda_inactive'
  | 'socal_ebus_course_active'
  | 'socal_ebus_course_inactive'
  | 'site_admin_active'
  | 'site_admin_inactive'
type AgreementFilter =
  | 'all'
  | 'accepted'
  | 'not_accepted'
  | 'research_consent'
  | 'no_research_consent'

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

interface AdminDashboardFilters {
  agreement: AgreementFilter
  institution: string
  permission: PermissionFilter
  q: string
}

interface ExportUserRow {
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
}

const roleLabels: Map<string, string> = new Map(
  professionalRoleOptions.map((option) => [option.value, option.label]),
)

const entitlementLabels: Record<AdminEntitlement, string> = {
  ip_registry: 'IP Registry',
  pccm_intro_course: 'PCCM Intro Course',
  pccm_intro_course_admin_loma_linda: 'PCCM Loma Linda Admin',
  pccm_intro_course_admin_ucsd: 'PCCM UCSD Admin',
  socal_ebus_course: 'SoCal EBUS Course',
  site_admin: 'Site Admin',
}

const permissionFilterConfig: Record<
  Exclude<PermissionFilter, 'all'>,
  { active: boolean; entitlement: AdminEntitlement }
> = {
  ip_registry_active: { active: true, entitlement: 'ip_registry' },
  ip_registry_inactive: { active: false, entitlement: 'ip_registry' },
  pccm_intro_course_active: { active: true, entitlement: 'pccm_intro_course' },
  pccm_intro_course_inactive: {
    active: false,
    entitlement: 'pccm_intro_course',
  },
  pccm_intro_course_admin_ucsd_active: {
    active: true,
    entitlement: 'pccm_intro_course_admin_ucsd',
  },
  pccm_intro_course_admin_ucsd_inactive: {
    active: false,
    entitlement: 'pccm_intro_course_admin_ucsd',
  },
  pccm_intro_course_admin_loma_linda_active: {
    active: true,
    entitlement: 'pccm_intro_course_admin_loma_linda',
  },
  pccm_intro_course_admin_loma_linda_inactive: {
    active: false,
    entitlement: 'pccm_intro_course_admin_loma_linda',
  },
  socal_ebus_course_active: { active: true, entitlement: 'socal_ebus_course' },
  socal_ebus_course_inactive: {
    active: false,
    entitlement: 'socal_ebus_course',
  },
  site_admin_active: { active: true, entitlement: 'site_admin' },
  site_admin_inactive: { active: false, entitlement: 'site_admin' },
}

function normalizeQuery(value: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function normalizeTextFilter(value: string | null) {
  return value?.trim() ?? ''
}

function normalizePermissionFilter(value: string | null): PermissionFilter {
  const validFilters: PermissionFilter[] = [
    'all',
    'ip_registry_active',
    'ip_registry_inactive',
    'pccm_intro_course_active',
    'pccm_intro_course_inactive',
    'pccm_intro_course_admin_ucsd_active',
    'pccm_intro_course_admin_ucsd_inactive',
    'pccm_intro_course_admin_loma_linda_active',
    'pccm_intro_course_admin_loma_linda_inactive',
    'socal_ebus_course_active',
    'socal_ebus_course_inactive',
    'site_admin_active',
    'site_admin_inactive',
  ]

  return validFilters.includes(value as PermissionFilter) ? (value as PermissionFilter) : 'all'
}

function normalizeAgreementFilter(value: string | null): AgreementFilter {
  const validFilters: AgreementFilter[] = [
    'all',
    'accepted',
    'not_accepted',
    'research_consent',
    'no_research_consent',
  ]

  return validFilters.includes(value as AgreementFilter) ? (value as AgreementFilter) : 'all'
}

function getAdminFilters(searchParams: URLSearchParams): AdminDashboardFilters {
  return {
    agreement: normalizeAgreementFilter(searchParams.get('agreement')),
    institution: normalizeTextFilter(searchParams.get('institution')) || ALL_INSTITUTIONS_FILTER,
    permission: normalizePermissionFilter(searchParams.get('permission')),
    q: normalizeTextFilter(searchParams.get('q')),
  }
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

function entitlementIsActive(row: SiteEntitlementRow) {
  if (row.status !== 'active') {
    return false
  }

  return !row.expires_at || new Date(row.expires_at).getTime() > Date.now()
}

function userHasLegacyEbusAccess(user: ExportUserRow) {
  return user.legacyEbusProfile?.approval_status === 'approved'
}

function userHasActiveSiteEntitlement(user: ExportUserRow, entitlement: AdminEntitlement) {
  return user.entitlements.some(
    (row) => row.entitlement === entitlement && entitlementIsActive(row),
  )
}

function userHasEffectiveEntitlement(user: ExportUserRow, entitlement: AdminEntitlement) {
  return (
    userHasActiveSiteEntitlement(user, entitlement) ||
    (entitlement === 'socal_ebus_course' && userHasLegacyEbusAccess(user))
  )
}

function userHasAcceptedAgreement(user: ExportUserRow) {
  return Boolean(user.profile?.agreement_accepted_at)
}

function userHasResearchConsent(user: ExportUserRow) {
  return Boolean(user.profile?.performance_research_consent)
}

function isNotRecordedInstitution(institution: string) {
  return institution.trim().toLowerCase() === 'not recorded'
}

function matchesInstitutionFilter(user: ExportUserRow, institutionFilter: string) {
  if (institutionFilter === ALL_INSTITUTIONS_FILTER) {
    return true
  }

  if (institutionFilter === NOT_RECORDED_INSTITUTION_FILTER) {
    return isNotRecordedInstitution(user.institution)
  }

  return user.institution.trim().toLowerCase() === institutionFilter.trim().toLowerCase()
}

function matchesPermissionFilter(user: ExportUserRow, permissionFilter: PermissionFilter) {
  if (permissionFilter === 'all') {
    return true
  }

  const config = permissionFilterConfig[permissionFilter]
  return userHasEffectiveEntitlement(user, config.entitlement) === config.active
}

function matchesAgreementFilter(user: ExportUserRow, agreementFilter: AgreementFilter) {
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

function booleanLabel(value: boolean | null | undefined) {
  return value ? 'Yes' : 'No'
}

function getEntitlementRecord(user: ExportUserRow, entitlement: AdminEntitlement) {
  return user.entitlements.find((row) => row.entitlement === entitlement) ?? null
}

function getEntitlementExportStatus(user: ExportUserRow, entitlement: AdminEntitlement) {
  const record = getEntitlementRecord(user, entitlement)
  const active = record ? entitlementIsActive(record) : false

  if (entitlement === 'socal_ebus_course' && userHasLegacyEbusAccess(user) && !active) {
    return 'active via legacy EBUS profile'
  }

  if (!record) {
    return 'not granted'
  }

  return active ? 'active' : record.status || 'inactive'
}

function getSourceFlags(user: ExportUserRow) {
  const flags = []

  if (user.createdAt || user.lastSignInAt || user.emailConfirmedAt) {
    flags.push('auth_user')
  }

  if (user.profile) {
    flags.push('site_profile')
  }

  if (user.legacyEbusProfile) {
    flags.push('legacy_ebus_profile')
  }

  return flags.join(';')
}

function csvEscape(value: unknown) {
  const raw = value == null ? '' : String(value)
  const spreadsheetSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

async function requireSiteAdmin() {
  const supabase = await supabaseServer()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ),
      user: null,
    }
  }

  if (!user.email_confirmed_at) {
    return {
      response: NextResponse.json(
        { error: 'Verified email required.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ),
      user: null,
    }
  }

  const now = new Date().toISOString()
  const { data: adminEntitlement } = await supabase
    .from('site_entitlements')
    .select('entitlement')
    .eq('user_id', user.id)
    .eq('entitlement', 'site_admin')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .maybeSingle()

  if (!adminEntitlement) {
    return {
      response: NextResponse.json(
        { error: 'Site admin access required.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ),
      user: null,
    }
  }

  return { response: null, user }
}

async function listAllAuthUsers() {
  if (!supabaseAdmin) {
    throw new Error('Supabase service-role client is not configured.')
  }

  const users: User[] = []
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw new Error(error.message)
    }

    const batch = data.users
    users.push(...batch)

    if (batch.length < perPage) {
      break
    }

    page += 1
  }

  return users
}

async function loadExportUsers(filters: AdminDashboardFilters) {
  if (!supabaseAdmin) {
    throw new Error('Supabase service-role client is not configured.')
  }

  const [authUsers, profilesResult, legacyEbusProfilesResult, entitlementsResult] =
    await Promise.all([
      listAllAuthUsers(),
      supabaseAdmin
        .from('site_profiles')
        .select(
          'id,email,first_name,last_name,professional_role,institution,country,agreement_accepted_at,agreement_version,performance_research_consent,onboarding_completed_at,created_at',
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('learner_profiles')
        .select(
          'id,email,full_name,institution,approval_status,approved_at,onboarding_completed_at',
        )
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('site_entitlements')
        .select('user_id,entitlement,status,granted_at,expires_at')
        .order('granted_at', { ascending: false }),
    ])

  const queryErrors = [
    profilesResult.error,
    legacyEbusProfilesResult.error,
    entitlementsResult.error,
  ]
    .filter(Boolean)
    .map((error) => error?.message)

  if (queryErrors.length > 0) {
    throw new Error(queryErrors.join(' '))
  }

  const profiles = ((profilesResult.data ?? []) as SiteProfileRow[]).filter(Boolean)
  const legacyEbusProfiles = (
    (legacyEbusProfilesResult.data ?? []) as LegacyEbusProfileRow[]
  ).filter(Boolean)
  const entitlements = ((entitlementsResult.data ?? []) as SiteEntitlementRow[]).filter(Boolean)
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const legacyEbusProfilesById = new Map(legacyEbusProfiles.map((profile) => [profile.id, profile]))
  const usersById = new Map(authUsers.map((user) => [user.id, user]))
  const entitlementsByUser = new Map<string, SiteEntitlementRow[]>()

  for (const entitlement of entitlements) {
    const current = entitlementsByUser.get(entitlement.user_id) ?? []
    current.push(entitlement)
    entitlementsByUser.set(entitlement.user_id, current)
  }

  const allUserIds = new Set<string>([
    ...authUsers.map((user) => user.id),
    ...profiles.map((profile) => profile.id),
    ...legacyEbusProfiles.map((profile) => profile.id),
    ...entitlements.map((entitlement) => entitlement.user_id),
  ])
  const searchQuery = normalizeQuery(filters.q)

  return Array.from(allUserIds)
    .map((userId): ExportUserRow => {
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
      }
    })
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
      const aDate = a.lastSignInAt ?? a.createdAt ?? ''
      const bDate = b.lastSignInAt ?? b.createdAt ?? ''
      return bDate.localeCompare(aDate)
    })
}

function buildCsvRows(users: ExportUserRow[]) {
  const headers = [
    'user_id',
    'email',
    'display_name',
    'first_name',
    'last_name',
    'professional_role',
    'role_label',
    'institution',
    'country',
    'account_created_at',
    'last_sign_in_at',
    'email_confirmed_at',
    'onboarding_completed_at',
    'agreement_accepted_at',
    'agreement_version',
    'performance_research_consent',
    'ip_registry_status',
    'ip_registry_granted_at',
    'ip_registry_expires_at',
    'pccm_intro_course_status',
    'pccm_intro_course_granted_at',
    'pccm_intro_course_expires_at',
    'pccm_intro_course_admin_ucsd_status',
    'pccm_intro_course_admin_ucsd_granted_at',
    'pccm_intro_course_admin_ucsd_expires_at',
    'pccm_intro_course_admin_loma_linda_status',
    'pccm_intro_course_admin_loma_linda_granted_at',
    'pccm_intro_course_admin_loma_linda_expires_at',
    'socal_ebus_course_status',
    'socal_ebus_course_granted_at',
    'socal_ebus_course_expires_at',
    'site_admin_status',
    'site_admin_granted_at',
    'site_admin_expires_at',
    'legacy_ebus_approval_status',
    'legacy_ebus_approved_at',
    'legacy_ebus_onboarding_completed_at',
    'source_flags',
  ]

  const rows = users.map((user) => {
    const ipRegistry = getEntitlementRecord(user, 'ip_registry')
    const pccmIntroCourse = getEntitlementRecord(user, 'pccm_intro_course')
    const pccmIntroCourseAdminUcsd = getEntitlementRecord(user, 'pccm_intro_course_admin_ucsd')
    const pccmIntroCourseAdminLomaLinda = getEntitlementRecord(
      user,
      'pccm_intro_course_admin_loma_linda',
    )
    const socalEbusCourse = getEntitlementRecord(user, 'socal_ebus_course')
    const siteAdmin = getEntitlementRecord(user, 'site_admin')

    return [
      user.id,
      user.email,
      user.displayName,
      user.profile?.first_name ?? '',
      user.profile?.last_name ?? '',
      user.profile?.professional_role ?? '',
      user.roleLabel,
      user.institution,
      user.country,
      user.createdAt,
      user.lastSignInAt,
      user.emailConfirmedAt,
      user.profile?.onboarding_completed_at ?? '',
      user.profile?.agreement_accepted_at ?? '',
      user.profile?.agreement_version ?? '',
      booleanLabel(user.profile?.performance_research_consent),
      getEntitlementExportStatus(user, 'ip_registry'),
      ipRegistry?.granted_at ?? '',
      ipRegistry?.expires_at ?? '',
      getEntitlementExportStatus(user, 'pccm_intro_course'),
      pccmIntroCourse?.granted_at ?? '',
      pccmIntroCourse?.expires_at ?? '',
      getEntitlementExportStatus(user, 'pccm_intro_course_admin_ucsd'),
      pccmIntroCourseAdminUcsd?.granted_at ?? '',
      pccmIntroCourseAdminUcsd?.expires_at ?? '',
      getEntitlementExportStatus(user, 'pccm_intro_course_admin_loma_linda'),
      pccmIntroCourseAdminLomaLinda?.granted_at ?? '',
      pccmIntroCourseAdminLomaLinda?.expires_at ?? '',
      getEntitlementExportStatus(user, 'socal_ebus_course'),
      socalEbusCourse?.granted_at ?? '',
      socalEbusCourse?.expires_at ?? '',
      getEntitlementExportStatus(user, 'site_admin'),
      siteAdmin?.granted_at ?? '',
      siteAdmin?.expires_at ?? '',
      user.legacyEbusProfile?.approval_status ?? '',
      user.legacyEbusProfile?.approved_at ?? '',
      user.legacyEbusProfile?.onboarding_completed_at ?? '',
      getSourceFlags(user),
    ]
  })

  return [headers, ...rows]
}

export async function GET(request: NextRequest) {
  const { response } = await requireSiteAdmin()

  if (response) {
    return response
  }

  try {
    const filters = getAdminFilters(request.nextUrl.searchParams)
    const users = await loadExportUsers(filters)
    const csv = toCsv(buildCsvRows(users))
    const exportedDate = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="site-admin-users-${exportedDate}.csv"`,
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export admin users.'

    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
