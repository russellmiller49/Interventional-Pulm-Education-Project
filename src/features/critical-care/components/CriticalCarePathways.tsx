'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  CircleDot,
  Route as RouteIcon,
  ShieldCheck,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'

import {
  type CriticalCarePublicClientCatalog,
  type PublicCriticalCarePathwayDefinition,
} from '../content/publicCatalogTypes'
import {
  publicCriticalCareActivityHref,
  summarizePublicCriticalCarePathways,
  type CriticalCareDashboardProgressState,
  type CriticalCarePathwayProgressSummary,
} from '../publicDashboard'
import { getCriticalCareRecommendations } from '../progress/recommendation'
import type { CriticalCareProgressReadResult } from '../progress/types'

const stateLabels: Readonly<Record<CriticalCareDashboardProgressState, string>> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Worked through',
  mastered: 'Worked through',
}

function usePathwayProgress(catalog: CriticalCarePublicClientCatalog) {
  const [readResult, setReadResult] = useState<CriticalCareProgressReadResult | null>(null)

  useEffect(() => {
    let active = true
    void import('../progress/publicClient')
      .then(({ readPublicCriticalCareProgress }) => {
        if (active) setReadResult(readPublicCriticalCareProgress(catalog.activities))
      })
      .catch(() => {
        // Pathway links remain available when browser storage cannot be inspected.
      })
    return () => {
      active = false
    }
  }, [catalog.activities])

  return readResult
}

function StateIcon({ state }: { readonly state: CriticalCareDashboardProgressState }) {
  if (state === 'completed' || state === 'mastered') {
    return <Check aria-hidden="true" className="size-4 text-emerald-600" />
  }
  if (state === 'in-progress') {
    return <CircleDot aria-hidden="true" className="size-4 text-primary" />
  }
  return <Circle aria-hidden="true" className="size-4 text-muted-foreground" />
}

function PathwayProgress({ summary }: { readonly summary?: CriticalCarePathwayProgressSummary }) {
  if (!summary) {
    return <p className="text-xs text-muted-foreground">Checking saved milestones…</p>
  }
  return (
    <p className="text-xs text-muted-foreground">
      {summary.completedActivities > 0
        ? 'You have touched activities on this pathway.'
        : 'Start with any activity that fits your current question.'}
    </p>
  )
}

function EducationBoundary() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/80 p-4 text-sm leading-6 text-muted-foreground">
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <p>
        For clinician education and simulation only. These pathways organize synthetic learning
        activities; they are not patient-specific treatment protocols.
      </p>
    </div>
  )
}

function isPathwayPreview(pathway: PublicCriticalCarePathwayDefinition): boolean {
  return pathway.stage === 'preview'
}

export function CriticalCarePathwaysIndex({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const readResult = usePathwayProgress(catalog)
  const summaries = useMemo(
    () => summarizePublicCriticalCarePathways(catalog, readResult?.envelope.activities ?? []),
    [catalog, readResult],
  )

  return (
    <main className="py-12 md:py-16">
      <div className="container space-y-10">
        <header className="max-w-4xl space-y-5">
          <Link
            href={'/critical-care' as Route}
            className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Critical Care Learning Center
          </Link>
          <Badge variant="info" className="w-fit rounded-full">
            Clinical pathways
          </Badge>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Build connected critical-care skills
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Pathways connect focused labs without forcing one rigid sequence. Start where your
              experience supports you and use milestone guidance to find useful preparation.
            </p>
          </div>
          <EducationBoundary />
        </header>

        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5">
          <h2 className="font-semibold">Soft preparation, open practice</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Preparation is recommended, never required. Practice and Challenge activities remain
            directly available; suggested refreshers are there when they help.
          </p>
        </div>

        <section aria-labelledby="pathway-list" className="space-y-5">
          <h2 id="pathway-list" className="text-2xl font-semibold tracking-tight">
            Choose a pathway
          </h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {catalog.pathways.map((pathway) => {
              const summary = summaries.find((item) => item.pathway.id === pathway.id)
              const preview = isPathwayPreview(pathway)
              return (
                <Card key={pathway.id} className="h-full">
                  <CardHeader className="gap-3 border-b-0 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <RouteIcon aria-hidden="true" className="size-6 text-primary" />
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
                    <PathwayProgress summary={readResult ? summary : undefined} />
                    <p className="text-xs text-muted-foreground">
                      Connects relevant modules, scenarios, and concepts.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={`/critical-care/pathways/${pathway.id}` as Route}
                      aria-label={`Explore ${pathway.title}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      </div>
    </main>
  )
}

export function CriticalCarePathwayDetail({
  catalog,
  pathway,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
  readonly pathway: PublicCriticalCarePathwayDefinition
}) {
  const readResult = usePathwayProgress(catalog)
  const summary = useMemo(
    () =>
      summarizePublicCriticalCarePathways(catalog, readResult?.envelope.activities ?? []).find(
        (item) => item.pathway.id === pathway.id,
      ),
    [catalog, pathway.id, readResult],
  )
  const pathwayActivities = useMemo(
    () => catalog.activities.filter((activity) => activity.pathwayIds.includes(pathway.id)),
    [catalog.activities, pathway.id],
  )
  const recommendation = useMemo(() => {
    if (!readResult) return null
    return (
      getCriticalCareRecommendations(pathwayActivities, readResult.envelope, {
        allowedReviewStatuses: ['released', 'sme-review'],
        preferredPathwayIds: [pathway.id],
        limit: 1,
      })[0] ?? null
    )
  }, [pathway.id, pathwayActivities, readResult])
  const prerequisiteAssessments = pathwayActivities.filter(
    (activity) => activity.kind === 'assessment' && activity.prerequisiteActivityIds.length > 0,
  )
  const recommendationPresentation = recommendation
    ? {
        title: recommendation.activity.title,
        description: recommendation.activity.description,
        href: publicCriticalCareActivityHref(recommendation.activity),
      }
    : null
  const pathwayPreview = isPathwayPreview(pathway)

  return (
    <main className="py-12 md:py-16">
      <div className="container space-y-10">
        <header className="max-w-4xl space-y-5">
          <Link
            href={'/critical-care/pathways' as Route}
            className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            All clinical pathways
          </Link>
          <Badge variant="info" className="w-fit rounded-full">
            {pathwayPreview ? 'Preview pathway' : 'Clinical pathway'}
          </Badge>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{pathway.title}</h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {pathway.description}
            </p>
          </div>
          <EducationBoundary />
        </header>

        <section aria-labelledby="pathway-next" className="space-y-5">
          <h2 id="pathway-next" className="text-2xl font-semibold tracking-tight">
            Suggested next activity
          </h2>
          <Card className="max-w-3xl border-primary/25 bg-primary/[0.03]">
            <CardHeader className="border-b-0 pb-2">
              {recommendation?.activity.reviewStatus === 'released' ? null : (
                <Badge variant="outline" className="w-fit rounded-full">
                  Preview · clinical review
                </Badge>
              )}
              <CardTitle>
                {recommendationPresentation?.title ??
                  (readResult
                    ? 'No additional reviewed activity is available'
                    : 'Checking progress…')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm leading-6 text-muted-foreground">
                {recommendationPresentation?.description ??
                  'The recommendation uses only compatible local progress and the reviewed activity catalog.'}
              </p>
            </CardContent>
            {recommendation ? (
              <CardFooter>
                <Link
                  href={recommendationPresentation?.href as Route}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Open activity
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </CardFooter>
            ) : null}
          </Card>
        </section>

        <section aria-labelledby="pathway-milestones" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="pathway-milestones" className="text-2xl font-semibold tracking-tight">
              Module milestones
            </h2>
            {summary ? (
              <p className="text-sm text-muted-foreground">
                {summary.completedActivities > 0
                  ? 'Your history touches this pathway.'
                  : 'Every milestone is optional.'}
              </p>
            ) : null}
          </div>
          <ol className="grid gap-4 lg:grid-cols-2">
            {(summary?.milestones ?? []).map((milestone, index) => (
              <li key={milestone.module.id}>
                <Card className="h-full">
                  <CardHeader className="border-b-0 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="rounded-full">
                        Milestone {index + 1}
                      </Badge>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StateIcon state={milestone.state} />
                        {stateLabels[milestone.state]}
                      </span>
                    </div>
                    <CardTitle>{milestone.module.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-sm text-muted-foreground">
                      {milestone.completedActivities > 0
                        ? 'You have worked in this module.'
                        : 'Open this module whenever it is useful.'}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Link
                      href={milestone.module.href as Route}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Open full lab
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ol>
          <p className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm leading-6 text-muted-foreground">
            These milestones are guidance. Practice remains open to experienced learners even when
            earlier milestones are incomplete.
          </p>
        </section>

        <section aria-labelledby="advanced-capstones" className="space-y-5">
          <div className="space-y-2">
            <h2 id="advanced-capstones" className="text-2xl font-semibold tracking-tight">
              Advanced cross-system capstones
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Advanced longitudinal activities apply this pathway across systems. Open them
              directly, or use the suggested refreshers first when a mechanism feels unfamiliar.
            </p>
          </div>
          <Card className="max-w-3xl border-amber-500/30 bg-amber-500/5">
            <CardHeader className="border-b-0 pb-2">
              <Badge variant="outline" className="w-fit rounded-full">
                Advanced preview
              </Badge>
              <CardTitle>Additional cross-system challenges are under review</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-sm leading-6 text-muted-foreground">
                Draft activities stay inside their publication-review boundary. This is separate
                from learner preparation: once an activity is published, prerequisites remain
                advisory and never block it.
              </p>
            </CardContent>
          </Card>
        </section>

        {prerequisiteAssessments.length > 0 ? (
          <section aria-labelledby="suggested-refreshers" className="space-y-5">
            <h2 id="suggested-refreshers" className="text-2xl font-semibold tracking-tight">
              Suggested refreshers for advanced challenges
            </h2>
            <ul className="space-y-3">
              {prerequisiteAssessments.map((challenge) => (
                <li key={challenge.id} className="rounded-2xl border bg-card p-5">
                  <p className="font-medium">{challenge.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    These links describe assumed background. You can open the challenge at any time.
                  </p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {challenge.prerequisiteActivityIds.map((activityId) => {
                      const refresher = catalog.activities.find(
                        (activity) => activity.id === activityId,
                      )
                      return refresher ? (
                        <li key={activityId}>
                          <Link
                            href={publicCriticalCareActivityHref(refresher) as Route}
                            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                          >
                            {refresher.title}
                            <ArrowRight aria-hidden="true" className="size-4" />
                          </Link>
                        </li>
                      ) : null
                    })}
                  </ul>
                  <Link
                    href={publicCriticalCareActivityHref(challenge) as Route}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                  >
                    Open challenge
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  )
}
