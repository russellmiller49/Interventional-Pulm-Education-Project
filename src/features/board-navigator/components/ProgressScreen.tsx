'use client'

import type { Route } from 'next'
import { useMemo, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

import { BLUEPRINT_TOPICS } from '../content/blueprint'
import { OBJECTIVES, objectiveById, objectivesInTopic } from '../content/objectives'
import { labHref, mapHref } from '../content/routes'
import { clearRecord, type Evidence } from '../engine/record'
import { daysUntil } from '../engine/schedule'
import {
  countByStatus,
  objectiveStatus,
  STATUS_LABELS,
  type ObjectiveStatus,
} from '../engine/status'
import { StatusBadge, statusTone } from './StatusBadge'
import { useNavigatorRecord, useNow } from './useNavigatorRecord'

const PHASE_WORDS = {
  diagnose: 'diagnosed',
  manipulate: 'manipulated',
  verify: 'applied to a new case',
  review: 'checked for retention',
} as const

function describe(entry: Evidence): string {
  const objective = objectiveById(entry.objectiveId)
  const base = `${objective.title}: ${PHASE_WORDS[entry.phase]}`
  if (entry.outcome === 'missed') {
    const label = entry.misconceptionId
      ? objective.misconceptions.find((item) => item.id === entry.misconceptionId)?.label
      : null
    return label ? `${base}, missed — "${label}"` : `${base}, missed`
  }
  return entry.outcome === 'with-hint' ? `${base}, with a hint` : `${base}, on your own`
}

/**
 * Screen D. A timeline of what changed, the sampled versus unassessed curriculum, the calendar
 * of future checks, and the two privacy controls: export and delete. No psychometric claim.
 */
export function ProgressScreen() {
  const { record, hydrated } = useNavigatorRecord()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const now = useNow(record)
  const counts = useMemo(
    () =>
      countByStatus(
        record,
        OBJECTIVES.map((objective) => objective.id),
        now,
      ),
    [record, now],
  )
  const timeline = useMemo(() => [...record.evidence].reverse().slice(0, 40), [record.evidence])
  const calendar = useMemo(
    () =>
      Object.entries(record.reviews)
        .map(([objectiveId, review]) => ({ objectiveId, days: daysUntil(review, now), review }))
        .sort((a, b) => a.days - b.days),
    [record.reviews, now],
  )

  if (!hydrated) return <div className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy="true" />

  function exportRecord() {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ip-board-navigator-${now.slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Progress and retention</h1>
        <p className="max-w-3xl text-muted-foreground">
          What the Navigator has observed, what it has not yet seen, and when it will check again.
          These are counts of tasks on this device, not a prediction about an examination.
        </p>
      </section>

      <section aria-labelledby="coverage-heading" className="grid gap-4">
        <h2 id="coverage-heading" className="text-xl font-bold">
          Sampled and unassessed curriculum
        </h2>
        <ul className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(counts) as ObjectiveStatus[]).map((status) => (
            <li key={status} className={`rounded-full border px-2.5 py-0.5 ${statusTone[status]}`}>
              {counts[status]} {STATUS_LABELS[status].toLowerCase()}
            </li>
          ))}
        </ul>
        <ul className="grid gap-2 sm:grid-cols-2">
          {BLUEPRINT_TOPICS.filter((topic) => topic.pilot).map((topic) => {
            const objectives = objectivesInTopic(topic.id).filter(
              (objective) => objective.topicId === topic.id,
            )
            const topicCounts = countByStatus(
              record,
              objectives.map((objective) => objective.id),
              now,
            )
            const sampled = objectives.length - topicCounts['not-assessed']
            return (
              <li key={topic.id} className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{topic.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {sampled} of {objectives.length} sampled
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  {objectives.map((objective) => {
                    const status = objectiveStatus(record, objective.id, now).status
                    return (
                      <span
                        key={objective.id}
                        className={`flex-1 border-r border-background ${statusTone[status].split(' ').find((cls) => cls.startsWith('bg-')) ?? ''}`}
                      />
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="timeline-heading"
          className="grid gap-3 rounded-2xl border bg-card p-5"
        >
          <h2 id="timeline-heading" className="text-lg font-bold">
            Timeline
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Your first lab writes the first entry.
            </p>
          ) : (
            <ol className="grid gap-2 text-sm" data-testid="progress-timeline">
              {timeline.map((entry) => (
                <li
                  key={`${entry.taskId}-${entry.at}`}
                  className="grid gap-0.5 border-l-2 border-border/70 pl-3"
                >
                  <time dateTime={entry.at} className="text-xs text-muted-foreground">
                    {new Date(entry.at).toLocaleString()}
                  </time>
                  <Link href={mapHref(entry.objectiveId) as Route} className="hover:underline">
                    {describe(entry)}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          aria-labelledby="calendar-heading"
          className="grid gap-3 rounded-2xl border bg-card p-5"
        >
          <h2 id="calendar-heading" className="text-lg font-bold">
            Review calendar
          </h2>
          {calendar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Reviews are scheduled once an objective is demonstrated on two different tasks.
            </p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {calendar.map((entry) => {
                const objective = objectiveById(entry.objectiveId)
                return (
                  <li
                    key={entry.objectiveId}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="grid gap-0.5">
                      <span>{objective.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.days <= 0
                          ? 'Due now'
                          : `In ${entry.days} day${entry.days === 1 ? '' : 's'}`}{' '}
                        · interval stage {entry.review.stage + 1}
                      </span>
                    </span>
                    {entry.days <= 0 ? (
                      <Link
                        href={labHref(entry.objectiveId, 'review') as Route}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Check now
                      </Link>
                    ) : (
                      <StatusBadge
                        status={objectiveStatus(record, entry.objectiveId, now).status}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="data-heading" className="grid gap-3 rounded-2xl border bg-card p-5">
        <h2 id="data-heading" className="text-lg font-bold">
          Your data
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything the Navigator knows about you is in one record on this device. Nothing is sent
          to a server. Export it to keep a copy or move it; delete it to start again.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={exportRecord}>
            <Download aria-hidden="true" className="size-4" /> Export as JSON
          </Button>
          {confirmDelete ? (
            <>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  clearRecord()
                  setConfirmDelete(false)
                }}
                data-testid="confirm-delete"
              >
                Yes, delete everything on this device
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" className="size-4" /> Delete my record
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
