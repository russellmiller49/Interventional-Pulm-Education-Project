'use client'

import type { Route } from 'next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Clock3,
  Droplets,
  HeartPulse,
  History,
  Library,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

import {
  recordCriticalCareDashboardEvent,
  type CriticalCareDashboardQualification,
} from '../publicAnalytics'
import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'
import {
  derivePublicCriticalCareDashboard,
  publicCriticalCareActivityHref,
  publicCriticalCareModuleTitle,
  type CriticalCareDashboardModel,
  type CriticalCareDashboardProgressState,
} from '../publicDashboard'
import type { CriticalCareProgressReadResult } from '../progress/types'
import { CriticalCareResourceSearch } from './CriticalCareResourceSearch'

const moduleIcons: Record<string, LucideIcon> = {
  hemodynamics: Activity,
  ventilation: Wind,
  'circulatory-support': HeartPulse,
  ecmo: Waves,
  crrt: Droplets,
}

const progressLabels: Readonly<Record<CriticalCareDashboardProgressState, string>> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Worked through',
  mastered: 'Worked through',
}

interface HydratedDashboard {
  readonly model: CriticalCareDashboardModel
  readonly readResult: CriticalCareProgressReadResult
}

function useCriticalCareDashboard(catalog: CriticalCarePublicClientCatalog): {
  readonly dashboard: HydratedDashboard | null
  readonly loadFailed: boolean
} {
  const [dashboard, setDashboard] = useState<HydratedDashboard | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    void import('../progress/publicClient')
      .then(({ readPublicCriticalCareProgress }) => {
        if (!active) return
        const readResult = readPublicCriticalCareProgress(catalog.activities)
        setDashboard({
          model: derivePublicCriticalCareDashboard(catalog, readResult),
          readResult,
        })
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [catalog])

  return { dashboard, loadFailed }
}

function useCriticalCareDashboardAnalytics() {
  const qualifiedRef = useRef(false)
  const viewedRef = useRef(false)

  const qualify = useCallback((qualification: CriticalCareDashboardQualification) => {
    if (qualifiedRef.current) return
    qualifiedRef.current = true
    recordCriticalCareDashboardEvent({
      interaction: 'critical_care_qualified_start',
      qualification,
    })
  }, [])

  useEffect(() => {
    if (!viewedRef.current) {
      viewedRef.current = true
      recordCriticalCareDashboardEvent({ interaction: 'critical_care_dashboard_viewed' })
    }

    let remainingVisibleMs = 30_000
    let visibleStartedAt: number | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const pause = () => {
      if (visibleStartedAt !== null) {
        remainingVisibleMs = Math.max(
          0,
          remainingVisibleMs - (performance.now() - visibleStartedAt),
        )
        visibleStartedAt = null
      }
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const start = () => {
      if (
        qualifiedRef.current ||
        visibleStartedAt !== null ||
        document.visibilityState !== 'visible'
      ) {
        return
      }
      visibleStartedAt = performance.now()
      timer = setTimeout(() => {
        timer = null
        visibleStartedAt = null
        qualify('30-visible-seconds')
      }, remainingVisibleMs)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else pause()
    }

    start()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      pause()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [qualify])

  return useCallback(
    (
      interaction:
        | 'critical_care_resume_selected'
        | 'critical_care_recommendation_selected'
        | 'critical_care_pathway_selected'
        | 'critical_care_quick_practice_selected'
        | 'critical_care_lab_selected',
      targetType: 'activity' | 'lab' | 'pathway',
      targetId: string,
    ) => {
      qualify('meaningful-interaction')
      recordCriticalCareDashboardEvent({ interaction, targetId, targetType })
    },
    [qualify],
  )
}

function statusBadge(state: CriticalCareDashboardProgressState) {
  return (
    <Badge variant={state === 'not-started' ? 'outline' : 'secondary'} className="rounded-full">
      {state === 'completed' || state === 'mastered' ? (
        <Check aria-hidden="true" className="mr-1 size-3" />
      ) : null}
      {progressLabels[state]}
    </Badge>
  )
}

function formatPhase(phase: string) {
  return `${phase.charAt(0).toUpperCase()}${phase.slice(1)}`
}

const deviceLabels: Readonly<Record<string, string>> = {
  iabp: 'intra-aortic balloon pump',
  impella: 'Impella CP-family support',
  lvad: 'durable continuous-flow LVAD',
  'hamilton-c6': 'Hamilton C6 ventilator',
  'drager-evita-v800-v600': 'Dräger Evita V800/V600 ventilator',
  'puritan-bennett-980': 'Puritan Bennett 980 ventilator',
  'carefusion-avea': 'CareFusion AVEA ventilator',
  'prismax-aw8035-2xx': 'Baxter PrisMax CRRT platform',
}

function humanDeviceLabel(deviceId: string): string {
  return (
    deviceLabels[deviceId] ??
    deviceId
      .split('-')
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  )
}

export function CriticalCareHub({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const { dashboard, loadFailed } = useCriticalCareDashboard(catalog)
  const recordSelection = useCriticalCareDashboardAnalytics()
  const model = dashboard?.model
  const quickPractice = useMemo(
    () =>
      catalog.activities
        .filter((activity) => activity.kind === 'practice-case')
        .filter(
          (activity, index, activities) =>
            activities.findIndex((candidate) => candidate.moduleId === activity.moduleId) === index,
        ),
    [catalog.activities],
  )
  const publicReferences = useMemo(
    () => catalog.referenceItems.filter((item) => item.kind === 'reference'),
    [catalog.referenceItems],
  )
  return (
    <main className="relative overflow-hidden py-12 md:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-gradient-to-b from-sky-500/10 via-cyan-500/5 to-transparent"
      />

      <div className="container space-y-14">
        <header className="max-w-4xl space-y-5">
          <Badge
            variant="info"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          >
            Critical care education
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Critical Care Learning Center
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Return to a safe checkpoint, follow a clinical pathway, or open a focused learning
              lab. Your established module progress remains local and is reflected here without
              changing the original stores.
            </p>
          </div>
          <div className="flex max-w-3xl items-start gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 text-sm leading-6 text-muted-foreground shadow-sm backdrop-blur">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              For clinician education and simulation only. Apply institutional protocols,
              manufacturer instructions, patient-specific evaluation, and clinical judgment in real
              care.
            </p>
          </div>
        </header>

        <CriticalCareResourceSearch catalog={catalog} />

        <section aria-labelledby="return-path" className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Your return path
            </p>
            <h2 id="return-path" className="mt-1 text-2xl font-semibold tracking-tight">
              Continue and recommended next
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-primary/25 bg-primary/[0.03]">
              <CardHeader className="gap-3 border-b-0 pb-2">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <History aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    Continue learning
                  </p>
                  <CardTitle className="mt-2">
                    {!model
                      ? 'Checking saved progress…'
                      : model.resume
                        ? model.resume.activity.title
                        : model.audienceState === 'new'
                          ? 'Your first activity starts here'
                          : model.audienceState === 'incompatible'
                            ? 'Start from a safe catalog entry'
                            : 'Choose your next focused lab'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {!model ? (
                  <p className="text-sm leading-6 text-muted-foreground" role="status">
                    Reading compatible local progress. No saved key will be changed.
                  </p>
                ) : model.resume ? (
                  <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                    <p>{model.resume.activity.description}</p>
                    <p className="rounded-xl bg-muted/70 px-3 py-2 text-xs">
                      Safe checkpoint · {formatPhase(model.resume.pointer.phase)} phase
                      {model.resume.pointer.scenarioId
                        ? ` · Case ${model.resume.pointer.scenarioId}`
                        : ''}
                      {model.resume.pointer.deviceId
                        ? ` · Device ${humanDeviceLabel(model.resume.pointer.deviceId)}`
                        : ''}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {model.audienceState === 'new'
                      ? 'Start with one guided signal-validation activity, or directly open any lab if you already know where you want to practice.'
                      : model.audienceState === 'incompatible'
                        ? 'A saved source could not be safely interpreted. It was not overwritten, and you can continue from any current activity.'
                        : 'Your existing completion is shown below. This source did not preserve one exact safe checkpoint.'}
                  </p>
                )}
              </CardContent>
              {model?.resume ? (
                <CardFooter>
                  <Link
                    href={model.resume.href as Route}
                    onClick={() =>
                      recordSelection(
                        'critical_care_resume_selected',
                        'activity',
                        model.resume!.activity.id,
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Resume activity
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </CardFooter>
              ) : null}
            </Card>

            <Card>
              <CardHeader className="gap-3 border-b-0 pb-2">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <Sparkles aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                    Recommended next
                  </p>
                  <CardTitle className="mt-2">
                    {model?.recommendation?.activity.title ?? 'PAC signal validation'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-sm leading-6 text-muted-foreground">
                  {model?.recommendation?.activity.description ??
                    'A guided foundation for validating a monitoring signal before interpretation or treatment.'}
                </p>
                {model?.recommendation ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">
                      <Clock3 aria-hidden="true" className="mr-1 size-3" />
                      {model.recommendation.activity.estimatedMinutes} min
                    </Badge>
                    <Badge variant="outline" className="rounded-full capitalize">
                      {model.recommendation.activity.difficulty}
                    </Badge>
                    {model.recommendation.activity.reviewStatus === 'released' ? null : (
                      <Badge variant="outline" className="rounded-full">
                        Preview · clinical review
                      </Badge>
                    )}
                  </div>
                ) : null}
              </CardContent>
              {model?.recommendation ? (
                <CardFooter>
                  <Link
                    href={model.recommendation.href as Route}
                    onClick={() =>
                      recordSelection(
                        'critical_care_recommendation_selected',
                        'activity',
                        model.recommendation!.activity.id,
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {model.audienceState === 'new' ? 'Start here' : 'Open recommendation'}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </CardFooter>
              ) : null}
            </Card>
          </div>

          {loadFailed ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
            >
              <p className="font-medium">Saved progress is temporarily unavailable.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You can still open every lab directly. No local progress was changed.
              </p>
            </div>
          ) : null}

          {dashboard && dashboard.readResult.notices.length > 0 ? (
            <details className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <summary className="cursor-pointer font-medium">
                Saved-progress diagnostics · {dashboard.readResult.notices.length}{' '}
                {dashboard.readResult.notices.length === 1 ? 'source' : 'sources'} need attention
              </summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Compatible progress is still shown. Unreadable or version-mismatched data was
                ignored and never overwritten.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {dashboard.readResult.notices.map((notice, index) => (
                  <li
                    key={`${notice.moduleId}-${notice.storageKey}-${index}`}
                    className="flex gap-2"
                  >
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-amber-600"
                    />
                    <span>
                      {publicCriticalCareModuleTitle(catalog, notice.moduleId)} · {notice.status}
                      {notice.issue ? ` · ${notice.issue.replaceAll('-', ' ')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section aria-labelledby="clinical-pathways" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Clinical pathways
              </p>
              <h2 id="clinical-pathways" className="mt-1 text-2xl font-semibold tracking-tight">
                Learn across support systems
              </h2>
            </div>
            <Link
              href={'/critical-care/pathways' as Route}
              onClick={() => recordSelection('critical_care_pathway_selected', 'pathway', 'all')}
              className="inline-flex min-h-10 items-center gap-2 self-start rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              View all pathways
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {catalog.pathways.map((pathway) => {
              const summary = model?.pathways.find((item) => item.pathway.id === pathway.id)
              const preview = pathway.stage === 'preview'
              return (
                <Card key={pathway.id} className="h-full">
                  <CardHeader className="gap-3 border-b-0 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <RouteIcon aria-hidden="true" className="size-5" />
                      </span>
                      {preview ? (
                        <Badge variant="outline" className="rounded-full">
                          Preview
                        </Badge>
                      ) : null}
                    </div>
                    <CardTitle>{pathway.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-sm leading-6 text-muted-foreground">{pathway.description}</p>
                    {summary ? (
                      <p className="text-xs text-muted-foreground">
                        {summary.completedActivities > 0
                          ? 'You have touched activities on this pathway.'
                          : 'Open at any point that matches your question.'}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Checking pathway milestones…</p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={`/critical-care/pathways/${pathway.id}` as Route}
                      onClick={() =>
                        recordSelection('critical_care_pathway_selected', 'pathway', pathway.id)
                      }
                      aria-label={`Explore ${pathway.title}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      Explore pathway
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="quick-practice" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Quick practice
              </p>
              <h2 id="quick-practice" className="mt-1 text-2xl font-semibold tracking-tight">
                Open a focused case
              </h2>
            </div>
            <Link
              href={'/critical-care/cases' as Route}
              onClick={() =>
                recordSelection('critical_care_quick_practice_selected', 'activity', 'all')
              }
              className="inline-flex min-h-10 items-center gap-2 self-start rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Browse all cases <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickPractice.map((activity) => (
              <Card key={activity.id} className="h-full">
                <CardHeader className="border-b-0 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {publicCriticalCareModuleTitle(catalog, activity.moduleId)}
                  </p>
                  <CardTitle className="text-lg">{activity.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    {activity.estimatedMinutes} min · coached case
                  </p>
                </CardContent>
                <CardFooter>
                  <Link
                    href={publicCriticalCareActivityHref(activity) as Route}
                    onClick={() =>
                      recordSelection(
                        'critical_care_quick_practice_selected',
                        'activity',
                        activity.id,
                      )
                    }
                    aria-label={`Practice ${activity.title}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Practice case
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="critical-care-modules" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Lab library · Skills and device labs
              </p>
              <h2 id="critical-care-modules" className="mt-1 text-2xl font-semibold tracking-tight">
                Quick launch a lab
              </h2>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <p className="text-sm text-muted-foreground">
                Focused modules available inside this unlisted learning center
              </p>
              <Link
                href={'/critical-care/labs' as Route}
                onClick={() => recordSelection('critical_care_lab_selected', 'lab', 'all')}
                className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Browse lab library <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {catalog.launcherModules.map((module) => {
              const Icon = moduleIcons[module.icon] ?? Activity
              const summary = model?.modules.find((item) => item.module.id === module.slug)

              return (
                <Card key={module.slug} className="h-full hover:border-primary/40">
                  <CardHeader className="gap-4 border-b-0 pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      {summary ? statusBadge(summary.state) : null}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        {module.eyebrow}
                      </p>
                      <CardTitle>{module.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pt-2">
                    <p className="text-sm leading-6 text-muted-foreground">{module.description}</p>
                    {summary ? (
                      <p className="text-xs text-muted-foreground">
                        {summary.state === 'not-started'
                          ? 'Start anywhere in this module.'
                          : summary.state === 'in-progress'
                            ? 'You have an activity in progress.'
                            : 'You have worked through activities here.'}
                      </p>
                    ) : null}
                    <ul className="flex flex-wrap gap-2" aria-label={`${module.title} topics`}>
                      {module.topics.map((topic) => (
                        <li
                          key={topic}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={module.href as Route}
                      onClick={() =>
                        recordSelection('critical_care_lab_selected', 'lab', module.slug)
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={`Open full lab: ${module.title}`}
                    >
                      Open full lab
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="critical-care-reference" className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Reference
              </p>
              <h2
                id="critical-care-reference"
                className="mt-1 text-2xl font-semibold tracking-tight"
              >
                Concepts at a glance
              </h2>
            </div>
            <Card>
              <CardHeader className="gap-3 border-b-0 pb-2">
                <Library aria-hidden="true" className="size-6 text-primary" />
                <CardTitle>{publicReferences.length} shared reference topics</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <ul className="divide-y divide-border/70 text-sm">
                  {publicReferences.slice(0, 4).map((reference) => (
                    <li key={reference.id} className="py-3 first:pt-0">
                      <p className="font-medium">{reference.title}</p>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {reference.category.replaceAll('-', ' ')}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-4">
                  <Link
                    href={'/critical-care/reference' as Route}
                    className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                  >
                    Search reference <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                  <Link
                    href={'/critical-care/notebook' as Route}
                    className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                  >
                    Open notebook <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="critical-care-progress" className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Progress
              </p>
              <h2
                id="critical-care-progress"
                className="mt-1 text-2xl font-semibold tracking-tight"
              >
                Activity history
              </h2>
            </div>
            <Card>
              <CardHeader className="gap-3 border-b-0 pb-2">
                <BookOpen aria-hidden="true" className="size-6 text-primary" />
                <CardTitle>{model ? 'Your local activity history' : 'Loading history'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {model?.integratedCaseOutcomes ? (
                  <div
                    className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3"
                    role="status"
                    aria-label="Integrated case outcomes"
                  >
                    <p className="text-sm font-medium">Integrated scenario history is available</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Coarse completion only; case identity, patient state, commands, and replay
                      remain inside the simulator.
                      {model.integratedCaseOutcomes.latestCompletedAt
                        ? ` Latest recorded ${new Intl.DateTimeFormat(undefined, {
                            day: 'numeric',
                            month: 'short',
                          }).format(new Date(model.integratedCaseOutcomes.latestCompletedAt))}.`
                        : ''}
                    </p>
                  </div>
                ) : null}
                {model?.recent.length ? (
                  <ol className="divide-y divide-border/70">
                    {model.recent.map(({ activity, href, progress }) => (
                      <li
                        key={activity.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {progress ? progressLabels[progress.status] : ''}
                            {progress ? ' · ' : ''}
                            {progress ? (
                              <time dateTime={progress.updatedAt}>
                                {new Intl.DateTimeFormat(undefined, {
                                  day: 'numeric',
                                  month: 'short',
                                }).format(new Date(progress.updatedAt))}
                              </time>
                            ) : null}
                          </p>
                        </div>
                        <Link
                          href={href as Route}
                          aria-label={`Open recent activity ${activity.title}`}
                          className="rounded-full p-2 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {model?.audienceState === 'returning'
                      ? 'Established progress is reflected in the lab cards. Older module stores did not record reliable dates, so no recent timestamp was invented.'
                      : 'Completed and in-progress rebuilt activities will appear here with their real saved dates.'}
                  </p>
                )}
                <Link
                  href={'/critical-care/progress' as Route}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                >
                  Open full progress <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  )
}
