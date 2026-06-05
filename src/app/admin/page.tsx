import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Activity, Clock, KeyRound, Search, ShieldCheck, ShieldOff, Users } from 'lucide-react'

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

type AdminEntitlement = (typeof adminEntitlements)[number]

interface AdminSearchParams {
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
  entitlements: SiteEntitlementRow[]
  usage: UserUsageSummary
}

const roleLabels: Map<string, string> = new Map(
  professionalRoleOptions.map((option) => [option.value, option.label]),
)

const entitlementLabels: Record<AdminEntitlement, string> = {
  ip_registry: 'IP Registry',
  socal_ebus_course: 'SoCal EBUS Course',
  site_admin: 'Site Admin',
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

function getDisplayName(profile: SiteProfileRow | null, user: User | null) {
  const profileName = [profile?.first_name, profile?.last_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  if (profileName) {
    return profileName
  }

  const metadataName =
    typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''

  return metadataName || user?.email?.split('@')[0] || profile?.email || 'Unknown user'
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

function buildRedirectUrl(status: string, query: string) {
  const params = new URLSearchParams({ status })
  if (query) {
    params.set('q', query)
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
  const query = String(formData.get('q') ?? '').trim()
  const targetUserId = String(formData.get('userId') ?? '').trim()
  const requestedEntitlement = formData.get('entitlement')
  const requestedAction = String(formData.get('action') ?? '').trim()

  if (!targetUserId || !isAdminEntitlement(requestedEntitlement)) {
    redirect(buildRedirectUrl('missing_target', query))
  }

  if (!supabaseAdmin) {
    redirect(buildRedirectUrl('missing_admin_client', query))
  }

  if (
    requestedAction === 'revoke' &&
    requestedEntitlement === 'site_admin' &&
    targetUserId === currentUser.id
  ) {
    redirect(buildRedirectUrl('self_admin_revoke_blocked', query))
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
    redirect(buildRedirectUrl('update_failed', query))
  }

  revalidatePath('/admin')
  redirect(
    buildRedirectUrl(
      requestedAction === 'revoke' ? 'entitlement_revoked' : 'entitlement_granted',
      query,
    ),
  )
}

async function loadAdminDashboardData(searchQuery: string) {
  if (!supabaseAdmin) {
    return {
      error: 'Supabase service-role client is not configured.',
      users: [] as AdminUserRow[],
      summary: {
        activeAdminCount: 0,
        activeRegistryCount: 0,
        totalHours: 0,
        totalUsers: 0,
      },
    }
  }

  const [authUsersResult, profilesResult, entitlementsResult, progressResult, sessionsResult] =
    await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      supabaseAdmin
        .from('site_profiles')
        .select(
          'id,email,first_name,last_name,professional_role,institution,country,agreement_accepted_at,agreement_version,performance_research_consent,onboarding_completed_at,created_at',
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('site_entitlements')
        .select('user_id,entitlement,status,granted_at,expires_at,notes')
        .order('granted_at', { ascending: false }),
      supabaseAdmin
        .from('site_module_progress')
        .select(
          'user_id,module_id,percent_complete,total_time_seconds,completed_at,last_visited_at',
        )
        .limit(5000),
      supabaseAdmin
        .from('site_module_sessions')
        .select('user_id,duration_seconds,started_at,last_heartbeat_at')
        .limit(5000),
    ])

  if (authUsersResult.error) {
    return {
      error: authUsersResult.error.message,
      users: [] as AdminUserRow[],
      summary: {
        activeAdminCount: 0,
        activeRegistryCount: 0,
        totalHours: 0,
        totalUsers: 0,
      },
    }
  }

  const authUsers = authUsersResult.data.users
  const profiles = ((profilesResult.data ?? []) as SiteProfileRow[]).filter(Boolean)
  const entitlements = ((entitlementsResult.data ?? []) as SiteEntitlementRow[]).filter(Boolean)
  const progressRows = ((progressResult.data ?? []) as SiteModuleProgressRow[]).filter(Boolean)
  const sessionRows = ((sessionsResult.data ?? []) as SiteModuleSessionRow[]).filter(Boolean)

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
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
  ])

  const users = Array.from(allUserIds)
    .map((userId): AdminUserRow => {
      const user = usersById.get(userId) ?? null
      const profile = profilesById.get(userId) ?? null
      const email = user?.email ?? profile?.email ?? ''

      return {
        id: userId,
        email,
        displayName: getDisplayName(profile, user),
        roleLabel: getRoleLabel(profile?.professional_role),
        institution: profile?.institution?.trim() || 'Not recorded',
        country: profile?.country?.trim() || 'Not recorded',
        createdAt: user?.created_at ?? profile?.created_at ?? null,
        lastSignInAt: user?.last_sign_in_at ?? null,
        emailConfirmedAt: user?.email_confirmed_at ?? null,
        profile,
        entitlements: entitlementsByUser.get(userId) ?? [],
        usage: usageByUser.get(userId) ?? {
          completedModules: 0,
          lastActivityAt: null,
          moduleCount: 0,
          totalSeconds: 0,
        },
      }
    })
    .filter((user) => {
      if (!searchQuery) {
        return true
      }

      const haystack = [
        user.displayName,
        user.email,
        user.roleLabel,
        user.institution,
        user.country,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchQuery)
    })
    .sort((a, b) => {
      const aActivity = a.usage.lastActivityAt ?? a.lastSignInAt ?? a.createdAt ?? ''
      const bActivity = b.usage.lastActivityAt ?? b.lastSignInAt ?? b.createdAt ?? ''
      return bActivity.localeCompare(aActivity)
    })

  const activeRegistryCount = users.filter((user) =>
    user.entitlements.some(
      (entitlement) =>
        entitlement.entitlement === 'ip_registry' && entitlementIsActive(entitlement),
    ),
  ).length
  const activeAdminCount = users.filter((user) =>
    user.entitlements.some(
      (entitlement) => entitlement.entitlement === 'site_admin' && entitlementIsActive(entitlement),
    ),
  ).length
  const totalSeconds = users.reduce((total, user) => total + user.usage.totalSeconds, 0)

  return {
    error: [
      profilesResult.error,
      entitlementsResult.error,
      progressResult.error,
      sessionsResult.error,
    ]
      .filter(Boolean)
      .map((error) => error?.message)
      .join(' '),
    users,
    summary: {
      activeAdminCount,
      activeRegistryCount,
      totalHours: Math.round(totalSeconds / 3600),
      totalUsers: users.length,
    },
  }
}

function EntitlementBadge({
  entitlement,
  entitlements,
}: {
  entitlement: AdminEntitlement
  entitlements: SiteEntitlementRow[]
}) {
  const record = entitlements.find((row) => row.entitlement === entitlement)
  const active = record ? entitlementIsActive(record) : false

  return (
    <Badge variant={active ? 'success' : 'outline'} className="normal-case tracking-normal">
      {entitlementLabels[entitlement]}
      {active ? '' : ' off'}
    </Badge>
  )
}

function EntitlementAction({
  action,
  entitlement,
  isCurrentUser,
  q,
  userId,
}: {
  action: 'grant' | 'revoke'
  entitlement: AdminEntitlement
  isCurrentUser: boolean
  q: string
  userId: string
}) {
  const isSelfAdminRevoke = action === 'revoke' && entitlement === 'site_admin' && isCurrentUser

  return (
    <form action={updateSiteEntitlementAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="entitlement" value={entitlement} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="q" value={q} />
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
  const q = normalizeQuery(params?.q)
  const status = params?.status
  const { error, summary, users } = await loadAdminDashboardData(q)

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <form action="/admin" className="flex w-full gap-2 lg:max-w-md">
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search users"
              leadingIcon={<Search className="h-4 w-4" aria-hidden />}
              aria-label="Search users"
            />
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
          </form>
        </div>

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

                          return (
                            <EntitlementAction
                              key={entitlement}
                              action={active ? 'revoke' : 'grant'}
                              entitlement={entitlement}
                              isCurrentUser={isCurrentUser}
                              q={q}
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
