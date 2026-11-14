'use client'

import type { Route } from 'next'
import { useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, Compass, Map as MapIcon, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

import { BLUEPRINT_DOMAINS } from '../content/blueprint'
import { OBJECTIVES, objectivesInDomain } from '../content/objectives'
import {
  labHref,
  mapHref,
  BOARD_NAVIGATOR_CURRICULUM_HREF,
  BOARD_NAVIGATOR_MAP_HREF,
} from '../content/routes'
import { withProfile, type LearnerProfile } from '../engine/record'
import { buildRecommendations, planSession, REASON_LABELS } from '../engine/recommend'
import { daysUntil } from '../engine/schedule'
import {
  countByStatus,
  objectiveStatus,
  STATUS_LABELS,
  type ObjectiveStatus,
} from '../engine/status'
import { GOAL_LABELS, OnboardingForm } from './OnboardingForm'
import { StatusBadge, statusTone } from './StatusBadge'
import { nowIso, useNavigatorRecord, useNow } from './useNavigatorRecord'

const STATUS_ORDER: readonly ObjectiveStatus[] = [
  'needs-focus',
  'review-due',
  'exploring',
  'demonstrated',
  'not-assessed',
]

/**
 * Screen A. Three questions, answered in order: what should I do today, why this, am I making
 * progress. The first visit asks for a goal and a session length; after that the default action is
 * the first recommendation, and the learner can take it, pick another, or browse.
 */
export function TodayScreen() {
  const { record, hydrated, update } = useNavigatorRecord()
  const [editing, setEditing] = useState(false)
  const now = useNow(record)

  const recommendations = useMemo(() => buildRecommendations(record, now), [record, now])
  const plan = useMemo(
    () => planSession(recommendations, record.profile?.sessionMinutes ?? 10),
    [recommendations, record.profile?.sessionMinutes],
  )
  const counts = useMemo(
    () =>
      countByStatus(
        record,
        OBJECTIVES.map((objective) => objective.id),
        now,
      ),
    [record, now],
  )
  const reviewsDue = useMemo(
    () => recommendations.filter((entry) => entry.reason === 'review'),
    [recommendations],
  )
  const upcoming = useMemo(
    () =>
      Object.entries(record.reviews)
        .map(([objectiveId, review]) => ({ objectiveId, days: daysUntil(review, now) }))
        .filter((entry) => entry.days > 0)
        .sort((a, b) => a.days - b.days)
        .slice(0, 3),
    [record.reviews, now],
  )

  if (!hydrated) {
    return <div className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy="true" />
  }

  function saveProfile(profile: LearnerProfile) {
    update((current) => withProfile(current, profile, nowIso()))
    setEditing(false)
  }

  if (!record.profile || editing) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-4 rounded-3xl border bg-card p-6 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            IP Board Navigator
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {record.profile
              ? 'Change your plan'
              : 'Tell it what you need, and it tells you what to work on'}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            The Navigator does not pretend to measure everything in one sitting. It samples
            objectives with short interactive tasks, shows you what it knows and what it has not yet
            seen, and picks the next five-minute exercise with a reason you can read. Each exercise
            repairs one idea and then checks that the idea carries into a new case.
          </p>
          <OnboardingForm
            initial={record.profile}
            onSave={saveProfile}
            onCancel={record.profile ? () => setEditing(false) : undefined}
          />
        </section>
      </div>
    )
  }

  const first = plan[0]
  const profile = record.profile
  const daysToExam = profile.examDate
    ? Math.ceil((new Date(profile.examDate).getTime() - new Date(now).getTime()) / 86_400_000)
    : null

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{GOAL_LABELS[profile.goal].title}</span>
          {' · '}
          {profile.sessionMinutes}-minute sessions
          {daysToExam !== null
            ? ` · ${daysToExam > 0 ? `${daysToExam} days to the board date` : 'board date passed'}`
            : ''}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 px-3 text-xs font-medium hover:bg-muted/40"
        >
          <Settings2 aria-hidden="true" className="size-3.5" /> Change plan
        </button>
      </section>

      {first ? (
        <section
          aria-labelledby="next-move-heading"
          className="grid gap-5 rounded-3xl border bg-card p-6 sm:p-9"
          data-testid="next-best-move"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Compass aria-hidden="true" className="size-4 text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Next best move
            </p>
            <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-xs text-muted-foreground">
              {REASON_LABELS[first.reason]}
            </span>
            {first.safetyCritical ? (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                Safety-critical decision
              </span>
            ) : null}
          </div>
          <h1 id="next-move-heading" className="text-2xl font-bold tracking-tight sm:text-4xl">
            {first.objective.title}
          </h1>
          <p className="max-w-3xl text-base leading-7" data-testid="next-move-rationale">
            {first.rationale}
          </p>
          <p className="text-sm text-muted-foreground">
            {first.mode === 'review' ? 'Retention check' : 'Repair lab'} · about {first.minutes}{' '}
            minutes · <StatusBadge status={first.status} />
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={labHref(first.objective.id, first.mode) as Route}>
                {first.mode === 'review' ? 'Run the check' : 'Start the lab'}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={mapHref(first.objective.id) as Route}>Why this? See the evidence</Link>
            </Button>
          </div>
          {plan.length > 1 ? (
            <div className="grid gap-2 border-t pt-4">
              <p className="text-sm font-semibold">Then, in this session</p>
              <ol className="grid gap-2 text-sm">
                {plan.slice(1).map((entry) => (
                  <li key={entry.objective.id} className="flex flex-wrap items-center gap-2">
                    <Link
                      href={labHref(entry.objective.id, entry.mode) as Route}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {entry.objective.title}
                    </Link>
                    <span className="text-muted-foreground">
                      · {REASON_LABELS[entry.reason]} · {entry.minutes} min
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="map-summary-heading" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="map-summary-heading" className="flex items-center gap-2 text-xl font-bold">
            <MapIcon aria-hidden="true" className="size-5 text-primary" /> Your knowledge map
          </h2>
          <Link href={BOARD_NAVIGATOR_MAP_HREF as Route} className="text-sm text-primary">
            Open the full map
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {BLUEPRINT_DOMAINS.map((domain) => {
            const ids = objectivesInDomain(domain.id).map((objective) => objective.id)
            const domainCounts = countByStatus(record, ids, now)
            return (
              <div key={domain.id} className="grid gap-3 rounded-2xl border bg-card p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{domain.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {domain.weightPercent}% of the blueprint
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2 text-xs">
                  {STATUS_ORDER.map((status) => (
                    <li
                      key={status}
                      className={`rounded-full border px-2.5 py-0.5 ${statusTone[status]}`}
                    >
                      {domainCounts[status]} {STATUS_LABELS[status].toLowerCase()}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {ids.length} pilot objectives in this domain.
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="review-heading"
          className="grid gap-3 rounded-2xl border bg-card p-5"
        >
          <h2 id="review-heading" className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock aria-hidden="true" className="size-5 text-primary" /> Review due
          </h2>
          {reviewsDue.length === 0 && upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing is due. Reviews are scheduled once an objective is demonstrated.
            </p>
          ) : null}
          {reviewsDue.length > 0 ? (
            <ul className="grid gap-2 text-sm">
              {reviewsDue.map((entry) => (
                <li
                  key={entry.objective.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>{entry.objective.title}</span>
                  <Link
                    href={labHref(entry.objective.id, 'review') as Route}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Check now
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {upcoming.length > 0 ? (
            <ul className="grid gap-1 text-sm text-muted-foreground">
              {upcoming.map((entry) => (
                <li key={entry.objectiveId}>
                  {OBJECTIVES.find((objective) => objective.id === entry.objectiveId)?.title} · in{' '}
                  {entry.days} day{entry.days === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section
          aria-labelledby="progress-heading"
          className="grid gap-3 rounded-2xl border bg-card p-5"
        >
          <h2 id="progress-heading" className="text-lg font-bold">
            Progress that matters
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Objectives demonstrated</dt>
              <dd className="text-2xl font-semibold">
                {counts.demonstrated + counts['review-due']}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Wrong models corrected</dt>
              <dd className="text-2xl font-semibold">{correctedCount(record, now)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Retained at review</dt>
              <dd className="text-2xl font-semibold">
                {
                  record.evidence.filter(
                    (entry) => entry.phase === 'review' && entry.outcome !== 'missed',
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Objectives sampled</dt>
              <dd className="text-2xl font-semibold">
                {OBJECTIVES.length - counts['not-assessed']} of {OBJECTIVES.length}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            No estimate of your chance on the board is shown. None has been validated.
          </p>
        </section>
      </div>

      <section aria-labelledby="mode-heading" className="grid gap-3">
        <h2 id="mode-heading" className="text-lg font-bold">
          Choose your mode
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[5, 10, 20].map((minutes) => {
            const sessionPlan = planSession(recommendations, minutes)
            const target = sessionPlan[0]
            return (
              <Link
                key={minutes}
                href={
                  (target
                    ? labHref(target.objective.id, target.mode)
                    : BOARD_NAVIGATOR_MAP_HREF) as Route
                }
                className="grid gap-1 rounded-2xl border bg-card p-4 text-sm transition hover:border-primary"
              >
                <span className="font-semibold">
                  {minutes === 5
                    ? '5-minute refresh'
                    : minutes === 10
                      ? '10-minute targeted'
                      : '20-minute deep dive'}
                </span>
                <span className="text-muted-foreground">
                  {sessionPlan.length} lab{sessionPlan.length === 1 ? '' : 's'}
                </span>
              </Link>
            )
          })}
          <Link
            href={BOARD_NAVIGATOR_CURRICULUM_HREF as Route}
            className="grid gap-1 rounded-2xl border bg-card p-4 text-sm transition hover:border-primary"
          >
            <span className="font-semibold">Browse freely</span>
            <span className="text-muted-foreground">Every topic, regardless of the plan</span>
          </Link>
        </div>
      </section>
    </div>
  )
}

/** Objectives where a documented wrong model was missed once and later succeeded on a new task. */
function correctedCount(
  record: ReturnType<typeof useNavigatorRecord>['record'],
  now: string,
): number {
  let count = 0
  for (const objective of OBJECTIVES) {
    const summary = objectiveStatus(record, objective.id, now)
    const evidence = record.evidence.filter((entry) => entry.objectiveId === objective.id)
    const hadMisconception = evidence.some((entry) => entry.misconceptionId !== null)
    if (
      hadMisconception &&
      (summary.status === 'demonstrated' || summary.status === 'review-due')
    ) {
      count += 1
    }
  }
  return count
}
