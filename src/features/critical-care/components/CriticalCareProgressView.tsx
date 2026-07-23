'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'
import {
  derivePublicCriticalCareDashboard,
  type CriticalCareDashboardModel,
} from '../publicDashboard'
import type { CriticalCareProgressSourceReport } from '../progress/types'

interface ProgressState {
  readonly model: CriticalCareDashboardModel
  readonly notices: readonly CriticalCareProgressSourceReport[]
}

export function CriticalCareProgressView({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    void import('../progress/publicClient')
      .then(({ readPublicCriticalCareProgress }) => {
        if (!active) return
        const result = readPublicCriticalCareProgress(catalog.activities)
        setProgress({
          model: derivePublicCriticalCareDashboard(catalog, result),
          notices: result.notices,
        })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [catalog])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Progress</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Critical care activity history</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        This view merges normalized activity status with read-only legacy adapters. It does not
        invent dates for older stores or copy detailed simulation traces into unified progress.
      </p>
      {failed ? (
        <p className="mt-8 rounded-2xl border border-destructive/50 p-5" role="alert">
          Progress could not be read. Existing module stores were not changed.
        </p>
      ) : null}
      {!progress && !failed ? (
        <p className="mt-8" role="status">
          Loading progress…
        </p>
      ) : null}
      {progress ? (
        <>
          {progress.notices.length > 0 ? (
            <section
              className="mt-7 rounded-2xl border border-amber-500/50 bg-amber-500/5 p-5"
              aria-label="Progress compatibility notices"
            >
              <h2 className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-5" aria-hidden="true" /> Compatibility notices
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {progress.notices.map((notice) => (
                  <li key={`${notice.moduleId}:${notice.storageKey}`}>
                    {notice.moduleId} · {notice.status}
                    {notice.issue ? ` · ${notice.issue.replaceAll('-', ' ')}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="mt-8" aria-labelledby="module-progress-heading">
            <h2 id="module-progress-heading" className="text-2xl font-bold">
              Modules
            </h2>
            <ol className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {progress.model.modules.map((summary) => (
                <li key={summary.module.id} className="rounded-2xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold">{summary.module.title}</h3>
                    {summary.state === 'completed' || summary.state === 'mastered' ? (
                      <CheckCircle2
                        className="size-5 text-emerald-600"
                        aria-label={summary.state}
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {summary.completedActivities} of {summary.totalActivities} complete ·{' '}
                    {summary.state.replaceAll('-', ' ')}
                  </p>
                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${summary.module.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={summary.percentComplete}
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${summary.percentComplete}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="mt-10" aria-labelledby="pathway-progress-heading">
            <h2 id="pathway-progress-heading" className="text-2xl font-bold">
              Pathway milestones
            </h2>
            <ol className="mt-4 grid gap-4 md:grid-cols-2">
              {progress.model.pathways.map((summary) => (
                <li key={summary.pathway.id} className="rounded-2xl border bg-card p-5">
                  <h3 className="font-bold">{summary.pathway.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {summary.completedMilestones} of {summary.totalMilestones} module milestones ·{' '}
                    {summary.completedActivities} of {summary.totalActivities} activities
                  </p>
                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${summary.pathway.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={summary.percentComplete}
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${summary.percentComplete}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </main>
  )
}
