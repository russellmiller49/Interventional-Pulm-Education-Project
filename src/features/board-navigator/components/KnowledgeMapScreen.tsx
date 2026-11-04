'use client'

import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'

import { BLUEPRINT_DOMAINS, BLUEPRINT_VERSION, topicsInDomain } from '../content/blueprint'
import { CONCEPT_TAG_LABELS } from '../content/concepts'
import { findObjective, OBJECTIVES, objectivesInTopic } from '../content/objectives'
import { labHref, mapHref } from '../content/routes'
import type { LearningObjective } from '../content/types'
import { evidenceFor, type Evidence, type NavigatorRecord } from '../engine/record'
import { recommendationFor } from '../engine/recommend'
import {
  OBJECTIVE_STATUSES,
  objectiveStatus,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  type ObjectiveStatus,
} from '../engine/status'
import { StatusBadge, statusTone } from './StatusBadge'
import { useNavigatorRecord, useNow } from './useNavigatorRecord'

/**
 * Screen B. Two blueprint domains, their topics, and one tile per objective with a status that
 * separates "not yet assessed" from "needs focus". A tile opens a panel that answers: what am I
 * supposed to know, what evidence supports this status, what should I do next.
 */
export function KnowledgeMapScreen() {
  const { record, hydrated } = useNavigatorRecord()
  const searchParams = useSearchParams()
  const router = useRouter()
  const selectedId = searchParams.get('objective')
  const selected = findObjective(selectedId)
  const now = useNow(record)

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Knowledge map</h1>
        <p className="max-w-3xl text-muted-foreground">
          {BLUEPRINT_VERSION.label}: two domains, their topics, and the pilot objectives inside
          them. A blank tile means no evidence yet, not a low mark.
        </p>
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Status legend">
          {OBJECTIVE_STATUSES.map((status) => (
            <li
              key={status}
              className={cn('rounded-full border px-2.5 py-0.5', statusTone[status])}
            >
              <span className="font-semibold">{STATUS_LABELS[status]}</span>
              <span className="sr-only">: {STATUS_DESCRIPTIONS[status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <div
        className={cn(
          'grid gap-8',
          selected ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : '',
        )}
      >
        <div className="grid gap-8">
          {BLUEPRINT_DOMAINS.map((domain) => (
            <section key={domain.id} aria-labelledby={`domain-${domain.id}`} className="grid gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`domain-${domain.id}`} className="text-xl font-bold">
                  {domain.title}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {domain.weightPercent}% of the blueprint
                </span>
              </div>
              <div className="grid gap-4">
                {topicsInDomain(domain.id).map((topic) => {
                  const objectives = objectivesInTopic(topic.id).filter(
                    (objective) => objective.topicId === topic.id,
                  )
                  return (
                    <div key={topic.id} className="grid gap-2 rounded-2xl border bg-card p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold">{topic.title}</h3>
                        {!topic.pilot ? (
                          <span className="text-xs text-muted-foreground">
                            No pilot objectives yet
                          </span>
                        ) : null}
                      </div>
                      {objectives.length > 0 ? (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {objectives.map((objective) => {
                            const status = hydrated
                              ? objectiveStatus(record, objective.id, now).status
                              : 'not-assessed'
                            const active = selected?.id === objective.id
                            return (
                              <li key={objective.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.replace(mapHref(objective.id), { scroll: false })
                                  }
                                  aria-pressed={active}
                                  data-objective-tile={objective.id}
                                  data-status={status}
                                  className={cn(
                                    'grid w-full gap-1 rounded-xl border p-3 text-left text-sm transition hover:border-primary',
                                    statusTone[status],
                                    active ? 'ring-2 ring-primary' : '',
                                  )}
                                >
                                  <span className="font-semibold text-foreground">
                                    {objective.title}
                                  </span>
                                  <span className="text-xs">{STATUS_LABELS[status]}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        {selected ? (
          <ObjectiveDetail
            key={selected.id}
            objective={selected}
            record={record}
            now={now}
            onClose={() => router.replace(mapHref(), { scroll: false })}
          />
        ) : null}
      </div>
    </div>
  )
}

const OUTCOME_LABELS = {
  independent: 'Independent success',
  'with-hint': 'Success with a hint',
  missed: 'Missed',
} as const

const PHASE_LABELS = {
  diagnose: 'Diagnose',
  manipulate: 'Manipulate',
  verify: 'New case',
  review: 'Retention check',
} as const

function describeEvidence(objective: LearningObjective, entry: Evidence): string {
  const misconception = entry.misconceptionId
    ? objective.misconceptions.find((item) => item.id === entry.misconceptionId)?.label
    : null
  return `${PHASE_LABELS[entry.phase]} (${entry.taskKind}): ${OUTCOME_LABELS[entry.outcome]}${
    misconception ? ` — matched the wrong model "${misconception}"` : ''
  }`
}

export function ObjectiveDetail({
  objective,
  record,
  now,
  onClose,
}: {
  readonly objective: LearningObjective
  readonly record: NavigatorRecord
  readonly now: string
  readonly onClose?: () => void
}) {
  const summary = objectiveStatus(record, objective.id, now)
  const evidence = evidenceFor(record, objective.id)
  const recommendation = recommendationFor(record, objective.id, now)
  const prerequisites = objective.prerequisites
    .map((id) => OBJECTIVES.find((entry) => entry.id === id))
    .filter((entry): entry is LearningObjective => Boolean(entry))

  return (
    <aside
      aria-labelledby="objective-detail-heading"
      className="grid h-fit gap-5 rounded-3xl border bg-card p-6 lg:sticky lg:top-24"
      data-testid="objective-detail"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2">
          <StatusBadge status={summary.status} />
          <h2 id="objective-detail-heading" className="text-xl font-bold">
            {objective.title}
          </h2>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border/70 px-3 py-1 text-xs hover:bg-muted/40"
          >
            Close
          </button>
        ) : null}
      </div>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What you should be able to do
        </h3>
        <p className="text-sm leading-6">{objective.competency}</p>
        <ul className="grid gap-1.5 text-sm leading-6">
          {objective.whatToKnow.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {objective.concepts.map((tag) => (
            <li key={tag} className="rounded-full border border-border/70 px-2 py-0.5">
              {CONCEPT_TAG_LABELS[tag]}
            </li>
          ))}
          {objective.safetyCritical ? (
            <li className="rounded-full border border-amber-500/50 px-2 py-0.5 text-amber-800 dark:text-amber-300">
              Safety-critical
            </li>
          ) : null}
        </ul>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence behind this status
        </h3>
        <p className="text-sm text-muted-foreground">{STATUS_DESCRIPTIONS[summary.status]}</p>
        {evidence.length === 0 ? (
          <p className="text-sm">No observations yet.</p>
        ) : (
          <ol className="grid gap-1 text-sm" data-testid="evidence-list">
            {evidence
              .slice(-6)
              .reverse()
              .map((entry) => (
                <li key={`${entry.taskId}-${entry.at}`} className="flex gap-2">
                  <time dateTime={entry.at} className="shrink-0 text-muted-foreground">
                    {new Date(entry.at).toLocaleDateString()}
                  </time>
                  <span>{describeEvidence(objective, entry)}</span>
                </li>
              ))}
          </ol>
        )}
        {evidence.length > 0 && objective.misconceptions.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Wrong models this objective watches for
            </summary>
            <ul className="mt-2 grid gap-1">
              {objective.misconceptions.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">“{item.label}”</span>{' '}
                  <span className="text-muted-foreground">{item.repair}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What to do next
        </h3>
        <p className="text-sm leading-6">{recommendation.rationale}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={labHref(objective.id, recommendation.mode) as Route}>
              {recommendation.mode === 'review' ? 'Run the retention check' : 'Open the repair lab'}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
        {prerequisites.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Builds on:{' '}
            {prerequisites.map((entry, index) => (
              <span key={entry.id}>
                <Link
                  href={mapHref(entry.id) as Route}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {entry.title}
                </Link>
                {index < prerequisites.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        ) : null}
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Learn it in full
        </h3>
        <ul className="grid gap-1.5 text-sm">
          {objective.resources.map((resource) => (
            <li key={resource.href}>
              <Link
                href={resource.href as Route}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                {resource.label}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
              {resource.note ? (
                <span className="text-muted-foreground"> · {resource.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

export type { ObjectiveStatus }
