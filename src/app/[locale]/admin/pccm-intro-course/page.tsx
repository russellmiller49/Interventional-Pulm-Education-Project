import type { Metadata } from 'next'
import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  PlayCircle,
  Unlock,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPccmQuestionMap, normalizePccmAnswers } from '@/features/pccm-intro-course/assessment'
import { getPccmVideosForInstitution } from '@/features/pccm-intro-course/content/videos'
import {
  loadPccmIntroCourseAdminScope,
  type PccmIntroCourseAdminScope,
  userCanAdministerPccmInstitution,
} from '@/features/pccm-intro-course/server'
import {
  formatPccmInstitution,
  type PccmAssessmentKind,
  type PccmInstitution,
  pccmInstitutions,
} from '@/features/pccm-intro-course/types'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

const handoffMetadata: Metadata = {
  title: 'PCCM Intro Course Admin | Interventional Pulmonology Education',
  robots: {
    follow: false,
    index: false,
  },
}

interface PccmIntroCourseAdminPageProps {
  searchParams?: Promise<{
    cohort?: string
    confirm?: string
    status?: string
  }>
}

interface PccmEnrollmentRow {
  id: string
  user_id: string
  institution: PccmInstitution
  status: string
  enrolled_at: string | null
}

interface PccmAttemptRow {
  answers: unknown
  attempt_kind: PccmAssessmentKind
  score: number | null
  submitted_at: string | null
  total: number | null
  updated_at: string | null
  user_id: string
}

interface PccmVideoProgressAdminRow {
  completed_at: string | null
  last_activity_at: string | null
  max_percent_complete: number | null
  user_id: string
  video_id: string
}

interface SiteModuleProgressAdminRow {
  completed_at: string | null
  last_visited_at: string | null
  module_id: string
  percent_complete: number | null
  user_id: string
}

interface PccmCohortSettingAdminRow {
  institution: PccmInstitution
  posttests_released_at: string | null
}

interface PccmAdminLearnerRow {
  bothPosttestsComplete: boolean
  bothPretestsComplete: boolean
  bronchDelta: number | null
  bronchoscopyPost: PccmAttemptRow | null
  bronchoscopyPre: PccmAttemptRow | null
  displayName: string
  email: string
  enrolledAt: string | null
  institution: PccmInstitution
  lastActivityAt: string | null
  moduleProgressPercent: number
  pleuralDelta: number | null
  pleuralPost: PccmAttemptRow | null
  pleuralPre: PccmAttemptRow | null
  userId: string
  videoCompletedCount: number
  videoTotalCount: number
}

interface CohortSummary {
  bothPosttestsComplete: number
  bothPretestsComplete: number
  enrolled: number
  institution: PccmInstitution
  moduleAveragePercent: number
  posttestsReleasedAt: string | null
  videoCompleted: number
  videoTotal: number
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function PccmIntroCourseAdminPage({
  searchParams,
}: PccmIntroCourseAdminPageProps) {
  const { scope } = await requirePccmAdminUser()
  const query = await searchParams
  const requestedInstitution = parsePccmAdminCohortParam(query?.cohort)
  const allowedInstitutions = scope.canAccessAll ? [...pccmInstitutions] : scope.institutions
  const visibleInstitutions = resolveVisibleInstitutions(allowedInstitutions, requestedInstitution)
  const { cohortSummaries, error, learners } = await loadPccmAdminDashboardData(visibleInstitutions)
  const pageDescription = getPageDescription({
    allowedInstitutions,
    requestedInstitution,
    scope,
    visibleInstitutions,
  })

  return (
    <HandoffContent>
      {
        <main className="container space-y-8 py-10">
          <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="info">{scope.canAccessAll ? 'Admin' : 'Course Admin'}</Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                PCCM intro course dashboard
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">{pageDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowedInstitutions.length > 1 ? (
                <Button asChild variant={requestedInstitution ? 'outline' : 'default'}>
                  <Link href={'/admin/pccm-intro-course' as Route}>All cohorts</Link>
                </Button>
              ) : null}
              {allowedInstitutions.map((institution) => (
                <Button
                  asChild
                  key={institution}
                  variant={requestedInstitution === institution ? 'default' : 'outline'}
                >
                  <Link href={getPccmCohortDashboardHref(institution) as Route}>
                    {formatPccmInstitution(institution)}
                  </Link>
                </Button>
              ))}
              <Button asChild variant="outline">
                <Link href={(scope.canAccessAll ? '/admin' : '/dashboard') as Route}>
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  {scope.canAccessAll ? 'Back to admin' : 'Back to dashboard'}
                </Link>
              </Button>
            </div>
          </header>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {query?.status === 'posttests_released' ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-100">
              Loma Linda posttests are now open to enrolled learners.
            </div>
          ) : null}

          {query?.status === 'posttest_release_failed' ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              The Loma Linda posttests could not be released. Please try again.
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            {cohortSummaries.map((cohort) => (
              <article className="rounded-lg border bg-card p-4" key={cohort.institution}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {formatPccmInstitution(cohort.institution)}
                    </h2>
                    <p className="text-sm text-muted-foreground">{cohort.enrolled} enrolled</p>
                  </div>
                  <Badge variant="outline">{cohort.institution}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Metric
                    icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
                    label="Pretests complete"
                    value={`${cohort.bothPretestsComplete}/${cohort.enrolled}`}
                  />
                  <Metric
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    label="Posttests complete"
                    value={`${cohort.bothPosttestsComplete}/${cohort.enrolled}`}
                  />
                  <Metric
                    icon={<PlayCircle className="h-4 w-4" aria-hidden />}
                    label="Videos complete"
                    value={`${cohort.videoCompleted}/${cohort.videoTotal}`}
                  />
                  <Metric
                    icon={<Activity className="h-4 w-4" aria-hidden />}
                    label="Module progress"
                    value={`${cohort.moduleAveragePercent}% avg`}
                  />
                </div>
                {cohort.institution === 'loma_linda' ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {cohort.posttestsReleasedAt ? (
                          <Unlock className="h-4 w-4" aria-hidden />
                        ) : (
                          <Lock className="h-4 w-4" aria-hidden />
                        )}
                        Loma Linda posttest release
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cohort.posttestsReleasedAt
                          ? `Released ${formatDate(cohort.posttestsReleasedAt)}`
                          : 'Locked for every learner until a course admin releases it after course completion.'}
                      </p>
                    </div>
                    {cohort.posttestsReleasedAt ? (
                      <Badge variant="success">Released</Badge>
                    ) : query?.confirm === 'posttests' ? (
                      <div className="flex flex-col gap-2">
                        <p className="max-w-xs text-xs font-medium">
                          Confirm release of both posttests for every Loma Linda learner.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <form action={releaseLomaLindaPosttestsAction}>
                            <input type="hidden" name="institution" value="loma_linda" />
                            <Button type="submit" size="sm">
                              <Unlock className="h-4 w-4" aria-hidden />
                              Confirm release
                            </Button>
                          </form>
                          <Button asChild size="sm" variant="outline">
                            <Link href={'/admin/pccm-intro-course?cohort=loma_linda' as Route}>
                              Cancel
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button asChild size="sm">
                        <Link
                          href={
                            '/admin/pccm-intro-course?cohort=loma_linda&confirm=posttests' as Route
                          }
                        >
                          <Unlock className="h-4 w-4" aria-hidden />
                          Release posttests
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Learners</h2>
              <p className="text-sm text-muted-foreground">
                {learners.length} active PCCM intro course enrollments
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Learner</th>
                    <th className="px-4 py-3 font-medium">Institution</th>
                    <th className="px-4 py-3 font-medium">Pretests</th>
                    <th className="px-4 py-3 font-medium">Posttests</th>
                    <th className="px-4 py-3 font-medium">Score deltas</th>
                    <th className="px-4 py-3 font-medium">Videos</th>
                    <th className="px-4 py-3 font-medium">Shared modules</th>
                    <th className="px-4 py-3 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner) => (
                    <tr className="border-b last:border-b-0" key={learner.userId}>
                      <td className="max-w-xs px-4 py-4 align-top">
                        <p className="font-medium">{learner.displayName}</p>
                        <p className="break-all text-xs text-muted-foreground">{learner.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Enrolled {formatDate(learner.enrolledAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant="outline">
                          {formatPccmInstitution(learner.institution)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <AssessmentMiniSummary
                          bronchoscopy={learner.bronchoscopyPre}
                          complete={learner.bothPretestsComplete}
                          pleural={learner.pleuralPre}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <AssessmentMiniSummary
                          bronchoscopy={learner.bronchoscopyPost}
                          complete={learner.bothPosttestsComplete}
                          pleural={learner.pleuralPost}
                        />
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                        <p>Bronch: {formatDelta(learner.bronchDelta)}</p>
                        <p>Pleural: {formatDelta(learner.pleuralDelta)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <ProgressBadge
                          complete={learner.videoCompletedCount >= learner.videoTotalCount}
                          label={`${learner.videoCompletedCount}/${learner.videoTotalCount}`}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <ProgressBadge
                          complete={learner.moduleProgressPercent >= 95}
                          label={`${learner.moduleProgressPercent}%`}
                        />
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                        {formatDate(learner.lastActivityAt)}
                      </td>
                    </tr>
                  ))}
                  {learners.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-sm text-muted-foreground" colSpan={8}>
                        No active PCCM intro course enrollments found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      }
    </HandoffContent>
  )
}

function parsePccmAdminCohortParam(value: string | undefined): PccmInstitution | null {
  if (value === 'ucsd') {
    return 'ucsd'
  }

  if (value === 'loma_linda' || value === 'loma-linda') {
    return 'loma_linda'
  }

  return null
}

function resolveVisibleInstitutions(
  allowedInstitutions: readonly PccmInstitution[],
  requestedInstitution: PccmInstitution | null,
) {
  if (!requestedInstitution) {
    return allowedInstitutions
  }

  if (!allowedInstitutions.includes(requestedInstitution)) {
    redirect('/dashboard?required=site_admin' as Route)
  }

  return [requestedInstitution]
}

function getPageDescription({
  allowedInstitutions,
  requestedInstitution,
  scope,
  visibleInstitutions,
}: {
  allowedInstitutions: readonly PccmInstitution[]
  requestedInstitution: PccmInstitution | null
  scope: PccmIntroCourseAdminScope
  visibleInstitutions: readonly PccmInstitution[]
}) {
  if (requestedInstitution) {
    return `${formatPccmInstitution(requestedInstitution)} PCCM intro course dashboard for learner progress, pretests, posttests, videos, and shared module activity.`
  }

  if (scope.canAccessAll && allowedInstitutions.length > 1) {
    return 'UCSD and Loma Linda cohorts are tracked separately while sharing the same bronchoscopy and pleural course materials.'
  }

  return `Showing ${formatInstitutionList(visibleInstitutions)} learner data for scoped course admins.`
}

function getPccmCohortDashboardHref(institution: PccmInstitution) {
  return `/admin/pccm-intro-course/${institution === 'loma_linda' ? 'loma-linda' : 'ucsd'}`
}

async function requirePccmAdminUser(): Promise<{
  scope: PccmIntroCourseAdminScope
  user: User
}> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/pccm-intro-course' as Route)
  }

  const scope = await loadPccmIntroCourseAdminScope(supabase, user.id)

  if (!scope.canAccessAll && scope.institutions.length === 0) {
    redirect('/dashboard?required=site_admin' as Route)
  }

  return { scope, user }
}

async function releaseLomaLindaPosttestsAction(formData: FormData) {
  'use server'

  const { scope, user } = await requirePccmAdminUser()
  const institution = String(formData.get('institution') ?? '').trim()

  if (institution !== 'loma_linda' || !userCanAdministerPccmInstitution(scope, 'loma_linda')) {
    redirect('/dashboard?required=site_admin' as Route)
  }

  if (!supabaseAdmin) {
    redirect('/admin/pccm-intro-course?cohort=loma_linda&status=posttest_release_failed' as Route)
  }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('pccm_intro_course_cohort_settings')
    .update({
      posttests_released_at: now,
      posttests_released_by: user.id,
      updated_at: now,
    })
    .eq('institution', 'loma_linda')
    .is('posttests_released_at', null)

  if (error) {
    redirect('/admin/pccm-intro-course?cohort=loma_linda&status=posttest_release_failed' as Route)
  }

  revalidatePath('/admin/pccm-intro-course')
  redirect('/admin/pccm-intro-course?cohort=loma_linda&status=posttests_released' as Route)
}

async function loadPccmAdminDashboardData(allowedInstitutions: readonly PccmInstitution[]) {
  if (!supabaseAdmin) {
    return {
      cohortSummaries: emptyCohortSummaries(allowedInstitutions),
      error: 'Supabase service-role client is not configured.',
      learners: [] as PccmAdminLearnerRow[],
    }
  }

  const [
    authUsersResult,
    profilesResult,
    enrollmentsResult,
    attemptsResult,
    cohortSettingsResult,
    videoProgressResult,
    moduleProgressResult,
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin.from('site_profiles').select('id,email,first_name,last_name,institution'),
    supabaseAdmin
      .from('pccm_intro_course_enrollments')
      .select('id,user_id,institution,status,enrolled_at')
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false }),
    supabaseAdmin
      .from('pccm_intro_course_assessment_attempts')
      .select('user_id,attempt_kind,answers,score,total,submitted_at,updated_at'),
    supabaseAdmin
      .from('pccm_intro_course_cohort_settings')
      .select('institution,posttests_released_at'),
    supabaseAdmin
      .from('pccm_intro_course_video_progress')
      .select('user_id,video_id,max_percent_complete,completed_at,last_activity_at'),
    supabaseAdmin
      .from('site_module_progress')
      .select('user_id,module_id,percent_complete,completed_at,last_visited_at')
      .limit(5000),
  ])

  const error = [
    authUsersResult.error,
    profilesResult.error,
    enrollmentsResult.error,
    attemptsResult.error,
    cohortSettingsResult.error,
    videoProgressResult.error,
    moduleProgressResult.error,
  ]
    .filter(Boolean)
    .map((queryError) => queryError?.message)
    .join(' ')

  const authUsers = authUsersResult.data?.users ?? []
  const usersById = new Map(authUsers.map((user) => [user.id, user]))
  const profilesById = new Map(
    (
      (profilesResult.data ?? []) as Array<{
        email: string | null
        first_name: string | null
        id: string
        institution: string | null
        last_name: string | null
      }>
    ).map((profile) => [profile.id, profile]),
  )
  const attemptsByUserAndKind = groupAttempts((attemptsResult.data ?? []) as PccmAttemptRow[])
  const videosByUser = groupRowsByUser(
    (videoProgressResult.data ?? []) as PccmVideoProgressAdminRow[],
  )
  const sharedModulesByUser = groupRowsByUser(
    ((moduleProgressResult.data ?? []) as SiteModuleProgressAdminRow[]).filter((row) =>
      isSharedPccmModuleProgress(row.module_id),
    ),
  )

  const allowedInstitutionSet = new Set(allowedInstitutions)
  const learners = ((enrollmentsResult.data ?? []) as PccmEnrollmentRow[])
    .filter((enrollment) => allowedInstitutionSet.has(enrollment.institution))
    .map((enrollment) =>
      buildLearnerRow({
        attemptsByKind: attemptsByUserAndKind.get(enrollment.user_id) ?? new Map(),
        enrollment,
        moduleProgress: sharedModulesByUser.get(enrollment.user_id) ?? [],
        profile: profilesById.get(enrollment.user_id) ?? null,
        user: usersById.get(enrollment.user_id) ?? null,
        videoProgress: videosByUser.get(enrollment.user_id) ?? [],
      }),
    )
    .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))

  return {
    cohortSummaries: buildCohortSummaries(
      learners,
      allowedInstitutions,
      (cohortSettingsResult.data ?? []) as PccmCohortSettingAdminRow[],
    ),
    error,
    learners,
  }
}

function buildLearnerRow({
  attemptsByKind,
  enrollment,
  moduleProgress,
  profile,
  user,
  videoProgress,
}: {
  attemptsByKind: Map<PccmAssessmentKind, PccmAttemptRow>
  enrollment: PccmEnrollmentRow
  moduleProgress: SiteModuleProgressAdminRow[]
  profile: { email: string | null; first_name: string | null; last_name: string | null } | null
  user: User | null
  videoProgress: PccmVideoProgressAdminRow[]
}): PccmAdminLearnerRow {
  const bronchoscopyPre = attemptsByKind.get('bronchoscopy_pre') ?? null
  const bronchoscopyPost = attemptsByKind.get('bronchoscopy_post') ?? null
  const pleuralPre = attemptsByKind.get('pleural_pre') ?? null
  const pleuralPost = attemptsByKind.get('pleural_post') ?? null
  const videoTotalCount = getPccmVideosForInstitution(enrollment.institution).length
  const videoCompletedCount = videoProgress.filter(
    (progress) => progress.completed_at || (progress.max_percent_complete ?? 0) >= 95,
  ).length
  const moduleProgressPercent =
    moduleProgress.length > 0
      ? Math.round(
          moduleProgress.reduce((total, progress) => total + (progress.percent_complete ?? 0), 0) /
            moduleProgress.length,
        )
      : 0

  const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  const email = user?.email ?? profile?.email ?? ''

  return {
    bothPosttestsComplete: Boolean(bronchoscopyPost?.submitted_at && pleuralPost?.submitted_at),
    bothPretestsComplete: Boolean(bronchoscopyPre?.submitted_at && pleuralPre?.submitted_at),
    bronchDelta: calculateDelta(bronchoscopyPre, bronchoscopyPost),
    bronchoscopyPost,
    bronchoscopyPre,
    displayName: profileName || user?.user_metadata?.full_name || email.split('@')[0] || 'Learner',
    email,
    enrolledAt: enrollment.enrolled_at,
    institution: enrollment.institution,
    lastActivityAt: [
      enrollment.enrolled_at,
      ...Array.from(attemptsByKind.values()).map(
        (attempt) => attempt.submitted_at ?? attempt.updated_at,
      ),
      ...videoProgress.map((progress) => progress.last_activity_at),
      ...moduleProgress.map((progress) => progress.last_visited_at ?? progress.completed_at),
    ].reduce<string | null>((latest, candidate) => latestDate(latest, candidate), null),
    moduleProgressPercent,
    pleuralDelta: calculateDelta(pleuralPre, pleuralPost),
    pleuralPost,
    pleuralPre,
    userId: enrollment.user_id,
    videoCompletedCount,
    videoTotalCount,
  }
}

function buildCohortSummaries(
  learners: PccmAdminLearnerRow[],
  institutions: readonly PccmInstitution[],
  settings: readonly PccmCohortSettingAdminRow[],
): CohortSummary[] {
  const settingsByInstitution = new Map(settings.map((setting) => [setting.institution, setting]))

  return institutions.map((institution) => {
    const cohortLearners = learners.filter((learner) => learner.institution === institution)
    const videoTotal = cohortLearners.reduce((total, learner) => total + learner.videoTotalCount, 0)

    return {
      bothPosttestsComplete: cohortLearners.filter((learner) => learner.bothPosttestsComplete)
        .length,
      bothPretestsComplete: cohortLearners.filter((learner) => learner.bothPretestsComplete).length,
      enrolled: cohortLearners.length,
      institution,
      moduleAveragePercent:
        cohortLearners.length > 0
          ? Math.round(
              cohortLearners.reduce((total, learner) => total + learner.moduleProgressPercent, 0) /
                cohortLearners.length,
            )
          : 0,
      posttestsReleasedAt:
        institution === 'ucsd'
          ? null
          : (settingsByInstitution.get(institution)?.posttests_released_at ?? null),
      videoCompleted: cohortLearners.reduce(
        (total, learner) => total + learner.videoCompletedCount,
        0,
      ),
      videoTotal,
    }
  })
}

function emptyCohortSummaries(institutions: readonly PccmInstitution[]) {
  return buildCohortSummaries([], institutions, [])
}

function formatInstitutionList(institutions: readonly PccmInstitution[]) {
  return institutions.map(formatPccmInstitution).join(' and ')
}

function groupAttempts(rows: PccmAttemptRow[]) {
  const grouped = new Map<string, Map<PccmAssessmentKind, PccmAttemptRow>>()

  for (const row of rows) {
    const attemptsByKind = grouped.get(row.user_id) ?? new Map<PccmAssessmentKind, PccmAttemptRow>()
    attemptsByKind.set(row.attempt_kind, row)
    grouped.set(row.user_id, attemptsByKind)
  }

  return grouped
}

function groupRowsByUser<T extends { user_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const current = grouped.get(row.user_id) ?? []
    current.push(row)
    grouped.set(row.user_id, current)
  }

  return grouped
}

function isSharedPccmModuleProgress(moduleId: string) {
  return (
    moduleId === 'intro-bronchoscopy' ||
    moduleId.startsWith('intro-bronchoscopy:') ||
    moduleId === 'pleural-procedures' ||
    moduleId.startsWith('pleural-procedures:')
  )
}

function calculateDelta(pre: PccmAttemptRow | null, post: PccmAttemptRow | null) {
  if (
    typeof pre?.score !== 'number' ||
    typeof post?.score !== 'number' ||
    !pre.submitted_at ||
    !post.submitted_at
  ) {
    return null
  }

  return post.score - pre.score
}

function latestDate(current: string | null, candidate: string | null | undefined) {
  if (!candidate) {
    return current
  }

  if (!current || new Date(candidate).getTime() > new Date(current).getTime()) {
    return candidate
  }

  return current
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded'
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDelta(value: number | null) {
  if (value === null) {
    return 'Pending'
  }

  return value > 0 ? `+${value}` : String(value)
}

function formatScore(attempt: PccmAttemptRow | null) {
  if (!attempt?.submitted_at) {
    return 'Not submitted'
  }

  return `${attempt.score ?? 0}/${attempt.total ?? 15}`
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function AssessmentMiniSummary({
  bronchoscopy,
  complete,
  pleural,
}: {
  bronchoscopy: PccmAttemptRow | null
  complete: boolean
  pleural: PccmAttemptRow | null
}) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <ProgressBadge complete={complete} label={complete ? 'Complete' : 'Incomplete'} />
      <p>Bronch: {formatScore(bronchoscopy)}</p>
      <p>Pleural: {formatScore(pleural)}</p>
      <AssessmentAttemptDetails
        attempt={bronchoscopy}
        label="Bronch answers"
        kind={bronchoscopy?.attempt_kind}
      />
      <AssessmentAttemptDetails
        attempt={pleural}
        label="Pleural answers"
        kind={pleural?.attempt_kind}
      />
    </div>
  )
}

function AssessmentAttemptDetails({
  attempt,
  kind,
  label,
}: {
  attempt: PccmAttemptRow | null
  kind: PccmAssessmentKind | undefined
  label: string
}) {
  if (!attempt?.submitted_at || !kind) {
    return null
  }

  const answers = normalizePccmAnswers(attempt.answers)
  const questionMap = getPccmQuestionMap(kind)
  const answeredQuestions = Object.entries(answers)
    .map(([questionId, selectedOptionId]) => {
      const question = questionMap.get(questionId)
      const selectedOption = question?.options.find((option) => option.id === selectedOptionId)
      const correctOption = question?.options.find((option) => option.id === question.correctId)

      return question && selectedOption
        ? {
            correctLabel: correctOption?.text ?? question.correctId,
            isCorrect: selectedOptionId === question.correctId,
            questionStem: question.stem,
            selectedLabel: selectedOption.text,
          }
        : null
    })
    .filter(
      (
        answer,
      ): answer is {
        correctLabel: string
        isCorrect: boolean
        questionStem: string
        selectedLabel: string
      } => Boolean(answer),
    )

  if (answeredQuestions.length === 0) {
    return null
  }

  return (
    <details className="mt-2 rounded-md border bg-muted/20 p-2">
      <summary className="cursor-pointer font-medium text-foreground">{label}</summary>
      <div className="mt-2 space-y-2">
        {answeredQuestions.map((answer, index) => (
          <div className="rounded-md border bg-background p-2" key={`${label}-${index}`}>
            <p className="font-medium text-foreground">Q{index + 1}</p>
            <p className="mt-1 line-clamp-3">{answer.questionStem}</p>
            <p className="mt-1">
              Selected: <span className="text-foreground">{answer.selectedLabel}</span>
            </p>
            <p>
              Correct: <span className="text-foreground">{answer.correctLabel}</span>
            </p>
            <Badge variant={answer.isCorrect ? 'success' : 'outline'} className="mt-1">
              {answer.isCorrect ? 'Correct' : 'Incorrect'}
            </Badge>
          </div>
        ))}
      </div>
    </details>
  )
}

function ProgressBadge({ complete, label }: { complete: boolean; label: string }) {
  return (
    <Badge variant={complete ? 'success' : 'outline'} className="normal-case tracking-normal">
      {complete ? <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden /> : null}
      {label}
    </Badge>
  )
}
