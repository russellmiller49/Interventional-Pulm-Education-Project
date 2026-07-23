'use client'

import type { Route } from 'next'
import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { criticalCareCatalogActivityHref } from '../content/activityRoutes'
import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'

export function CriticalCareCasesLibrary({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const [query, setQuery] = useState('')
  const [moduleId, setModuleId] = useState('all')
  const [kind, setKind] = useState('all')
  const caseActivities = useMemo(
    () =>
      catalog.activities.filter(
        (activity) => activity.kind === 'practice-case' || activity.kind === 'assessment',
      ),
    [catalog.activities],
  )
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return caseActivities.filter((activity) => {
      return (
        (moduleId === 'all' || activity.moduleId === moduleId) &&
        (kind === 'all' || activity.kind === kind) &&
        (!normalized ||
          `${activity.title} ${activity.description} ${activity.competencyIds.join(' ')}`
            .toLocaleLowerCase()
            .includes(normalized))
      )
    })
  }, [caseActivities, kind, moduleId, query])

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Case library</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Critical care cases and capstones</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        Open a stable practice or assessment deep link without navigating a full curriculum. Every
        activity retains its module engine, scoring, review status, and prerequisites.
      </p>
      <section
        className="mt-7 grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_14rem_14rem]"
        aria-label="Case filters"
      >
        <label className="relative">
          <span className="sr-only">Search cases</span>
          <Search
            className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case title, objective, or competency"
            className="min-h-11 w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Module
          <select
            value={moduleId}
            onChange={(event) => setModuleId(event.target.value)}
            className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
          >
            <option value="all">All modules</option>
            {catalog.modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Activity type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="min-h-11 rounded-xl border bg-background px-2 text-sm font-normal"
          >
            <option value="all">Practice + Assess</option>
            <option value="practice-case">Practice</option>
            <option value="assessment">Assess</option>
          </select>
        </label>
      </section>
      <p className="mt-5 text-sm text-muted-foreground" role="status">
        {results.length} activities
      </p>
      <ol className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((activity) => {
          const moduleDefinition = catalog.modules.find((item) => item.id === activity.moduleId)
          return (
            <li key={activity.id} className="flex h-full flex-col rounded-2xl border bg-card p-5">
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                {moduleDefinition?.title ?? activity.moduleId} ·{' '}
                {activity.kind === 'assessment' ? 'Assess' : 'Practice'}
              </span>
              <h2 className="mt-2 text-lg font-bold">{activity.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {activity.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {activity.estimatedMinutes} min · {activity.difficulty}
                </span>
                <span>{activity.reviewStatus.replaceAll('-', ' ')}</span>
              </div>
              <Link
                href={criticalCareCatalogActivityHref(activity) as Route}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
              >
                Open activity <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
