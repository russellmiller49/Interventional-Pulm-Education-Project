import type { Route } from 'next'
import { BookOpen, CheckCircle2, ClipboardCheck, Lock, PlayCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { HandoffContent } from '@/i18n/handoff'
import {
  getPccmVideosBySection,
  pccmCourseVideos,
} from '@/features/pccm-intro-course/content/videos'
import { PccmCourseVideoCard } from '@/features/pccm-intro-course/components/PccmCourseVideoCard'
import { PccmTechnicalProcedureVideoCard } from '@/features/pccm-intro-course/components/PccmTechnicalProcedureVideoCard'
import { pccmPleuralTechnicalProcedureVideos } from '@/features/pccm-intro-course/content/technicalProcedureVideos'
import {
  type PccmCourseSection,
  formatPccmAssessmentKind,
  formatPccmInstitution,
  type PccmAssessmentAttemptRow,
  type PccmAssessmentKind,
  type PccmEnrollment,
  type PccmInstitution,
  type PccmVideoProgressRow,
} from '@/features/pccm-intro-course/types'

interface PccmIntroCourseDashboardProps {
  adminMode?: boolean
  attempts: PccmAssessmentAttemptRow[]
  enrollment: PccmEnrollment
  gateMessage?: string
  posttestsUnlocked: boolean
  previewLabel?: string
  videosUnlocked: boolean
  videoProgress: PccmVideoProgressRow[]
  videoScope?: PccmInstitution | 'all'
}

const assessmentKinds: PccmAssessmentKind[] = [
  'bronchoscopy_pre',
  'pleural_pre',
  'bronchoscopy_post',
  'pleural_post',
]

const moduleLinks = [
  {
    description: 'Airway anatomy, bronchoscopy technique, and core diagnostic skills.',
    href: '/intro-bronchoscopy',
    title: 'Intro to Bronchoscopy',
  },
  {
    description:
      'Pleural procedure decision-making, ultrasound, thoracentesis, and disease review.',
    href: '/pleural-procedures',
    title: 'Intro to Pleural Disease',
  },
] as const

export function PccmIntroCourseDashboard({
  adminMode = false,
  attempts,
  enrollment,
  gateMessage,
  posttestsUnlocked,
  previewLabel,
  videosUnlocked,
  videoProgress,
  videoScope,
}: PccmIntroCourseDashboardProps) {
  const attemptsByKind = new Map(attempts.map((attempt) => [attempt.attempt_kind, attempt]))
  const effectiveVideoScope = videoScope ?? enrollment.institution
  const bronchoscopyVideos = getScopedVideosBySection(effectiveVideoScope, 'bronchoscopy')
  const pleuralVideos = getScopedVideosBySection(effectiveVideoScope, 'pleural')
  const visibleVideoIds = new Set(
    [...bronchoscopyVideos, ...pleuralVideos].map((video) => video.id),
  )
  const progressByVideoId = new Map(
    videoProgress
      .filter((progress) => visibleVideoIds.has(progress.video_id))
      .map((progress) => [progress.video_id, progress]),
  )
  const completedVideos = videoProgress.filter(
    (progress) =>
      visibleVideoIds.has(progress.video_id) &&
      (progress.completed_at || progress.max_percent_complete >= 95),
  ).length

  return (
    <HandoffContent>
      {
        <main className="container space-y-8 py-10">
          <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="info">PCCM Intro Course</Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Bronchoscopy and Pleural Disease
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {adminMode
                  ? `Admin preview: ${previewLabel ?? formatPccmInstitution(enrollment.institution)}. Videos and shared modules are available without participant pretest locks.`
                  : `Cohort: ${formatPccmInstitution(enrollment.institution)}. Progress is tracked on this dashboard for your pretests, posttests, videos, and shared course modules.`}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={'/dashboard' as Route}>Back to dashboard</Link>
            </Button>
          </header>

          {gateMessage ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
              {gateMessage}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardCheck className="h-4 w-4" aria-hidden />
                Assessments
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {adminMode
                  ? 'Admin'
                  : `${attempts.filter((attempt) => attempt.submitted_at).length}/4`}
              </p>
              <p className="text-xs text-muted-foreground">
                {adminMode ? 'Course preview mode' : 'Submitted pretests and posttests'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PlayCircle className="h-4 w-4" aria-hidden />
                Videos
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {completedVideos}/{bronchoscopyVideos.length + pleuralVideos.length}
              </p>
              <p className="text-xs text-muted-foreground">Completed course videos</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {videosUnlocked ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
                Access status
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {adminMode ? 'Admin preview' : videosUnlocked ? 'Unlocked' : 'Pretest gate'}
              </p>
              <p className="text-xs text-muted-foreground">
                {adminMode
                  ? 'Modules and videos are unlocked for this admin account'
                  : enrollment.institution === 'loma_linda'
                    ? 'Loma Linda unlocks after both pretests are submitted'
                    : 'UCSD content is available immediately'}
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Tests</h2>
              <p className="text-sm text-muted-foreground">
                {adminMode
                  ? 'Open pretests and posttests in preview mode without changing learner records.'
                  : 'Pretests record baseline knowledge without revealing answers. Posttest answers are final after selection and reveal correctness immediately.'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {assessmentKinds.map((kind) => {
                const attempt = adminMode ? undefined : attemptsByKind.get(kind)
                const submitted = Boolean(attempt?.submitted_at)
                const answered = Object.keys(attempt?.answers ?? {}).length
                const total = attempt?.total ?? 15
                const locked = !adminMode && kind.endsWith('_post') && !posttestsUnlocked

                return (
                  <article className="rounded-lg border bg-card p-4" key={kind}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{formatPccmAssessmentKind(kind)}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {adminMode
                            ? 'Preview module'
                            : locked
                              ? 'Awaiting course admin release'
                              : submitted
                                ? `Score: ${attempt?.score ?? 0}/${total}`
                                : `${answered}/${total} answered`}
                        </p>
                      </div>
                      <Badge variant={adminMode ? 'info' : submitted ? 'success' : 'outline'}>
                        {adminMode
                          ? 'Preview'
                          : submitted
                            ? 'Submitted'
                            : locked
                              ? 'Locked'
                              : 'Open'}
                      </Badge>
                    </div>
                    <Button
                      asChild={!locked}
                      className="mt-4 w-full"
                      disabled={locked}
                      variant="outline"
                    >
                      {locked ? (
                        <span>
                          <Lock className="h-4 w-4" aria-hidden />
                          Locked
                        </span>
                      ) : (
                        <Link href={`/pccm-intro-course/assessments/${kind}` as Route}>
                          {adminMode ? 'Preview' : submitted ? 'Review' : 'Start'}
                        </Link>
                      )}
                    </Button>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Shared Modules</h2>
              <p className="text-sm text-muted-foreground">
                Both cohorts use the same bronchoscopy and pleural disease module pages.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {moduleLinks.map((module) => (
                <article className="rounded-lg border bg-card p-4" key={module.href}>
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{module.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                      <Button
                        asChild={videosUnlocked}
                        className="mt-4"
                        disabled={!videosUnlocked}
                        variant="outline"
                      >
                        {videosUnlocked ? (
                          <Link href={module.href as Route}>Open module</Link>
                        ) : (
                          <span>
                            <Lock className="h-4 w-4" aria-hidden />
                            Locked
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Bronchoscopy Videos</h2>
              <p className="text-sm text-muted-foreground">
                Bronchoscopy lecture videos are cohort-specific.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {bronchoscopyVideos.map((video) => (
                <PccmCourseVideoCard
                  key={video.id}
                  locked={!videosUnlocked}
                  progress={progressByVideoId.get(video.id)}
                  video={video}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Pleural Disease Videos</h2>
              <p className="text-sm text-muted-foreground">
                Pleural disease lecture videos are shared by both cohorts.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {pleuralVideos.map((video) => (
                <PccmCourseVideoCard
                  key={video.id}
                  locked={!videosUnlocked}
                  progress={progressByVideoId.get(video.id)}
                  video={video}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Technical Procedure Videos</h2>
              <p className="text-sm text-muted-foreground">
                Supplemental pleural procedure demonstrations shared by both cohorts. These videos
                are not included in course-completion totals.
              </p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
              For clinician education only. Procedure videos supplement supervised training; follow
              local protocols, equipment instructions, and patient-specific clinical judgment.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {pccmPleuralTechnicalProcedureVideos.map((video) => (
                <PccmTechnicalProcedureVideoCard
                  key={video.id}
                  locked={!videosUnlocked}
                  video={video}
                />
              ))}
            </div>
          </section>
        </main>
      }
    </HandoffContent>
  )
}

function getScopedVideosBySection(scope: PccmInstitution | 'all', section: PccmCourseSection) {
  return scope === 'all'
    ? pccmCourseVideos.filter((video) => video.courseSection === section)
    : getPccmVideosBySection(scope, section)
}
