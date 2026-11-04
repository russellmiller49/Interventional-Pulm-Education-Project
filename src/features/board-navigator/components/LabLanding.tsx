'use client'

import type { Route } from 'next'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

import { OBJECTIVES } from '../content/objectives'
import { labHref, BOARD_NAVIGATOR_MAP_HREF, BOARD_NAVIGATOR_NAV_BASE } from '../content/routes'
import { buildRecommendations } from '../engine/recommend'
import { objectiveStatus } from '../engine/status'
import { StatusBadge } from './StatusBadge'
import { useNavigatorRecord, useNow } from './useNavigatorRecord'

/** The lab without an objective: the recommendation first, then every lab, so nothing is locked. */
export function LabLanding({ unknownObjective }: { readonly unknownObjective?: string }) {
  const { record, hydrated } = useNavigatorRecord()
  const now = useNow(record)
  const first = useMemo(() => buildRecommendations(record, now)[0], [record, now])

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Repair lab</h1>
        {unknownObjective ? (
          <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
            No objective is called “{unknownObjective}”. Choose one below.
          </p>
        ) : null}
        <p className="max-w-3xl text-muted-foreground">
          Each lab takes one objective through five stages: diagnose where the gap is, read the
          governing principle, change one variable and predict the effect, apply the idea to a new
          case, and close the loop with a scheduled review.
        </p>
        {hydrated && first ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={labHref(first.objective.id, first.mode) as Route}>
                Start the recommended lab: {first.objective.title}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={BOARD_NAVIGATOR_NAV_BASE as Route}>Why this one?</Link>
            </Button>
          </div>
        ) : null}
      </section>
      <section aria-labelledby="all-labs-heading" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="all-labs-heading" className="text-xl font-bold">
            Every lab
          </h2>
          <Link href={BOARD_NAVIGATOR_MAP_HREF as Route} className="text-sm text-primary">
            See them on the map
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {OBJECTIVES.map((objective) => (
            <li key={objective.id}>
              <Link
                href={labHref(objective.id) as Route}
                className="grid gap-1 rounded-xl border bg-card p-3 text-sm transition hover:border-primary"
              >
                <span className="font-semibold">{objective.title}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {objective.estimatedMinutes} min
                  {hydrated ? (
                    <StatusBadge status={objectiveStatus(record, objective.id, now).status} />
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
