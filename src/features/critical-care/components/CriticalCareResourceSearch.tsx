'use client'

import type { Route } from 'next'
import { useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { ArrowRight, Search } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { criticalCareCatalogActivityHref } from '../content/activityRoutes'
import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'

interface SearchRecord {
  readonly id: string
  readonly kind: 'activity' | 'concept' | 'reference'
  readonly title: string
  readonly description: string
  readonly terms: string
  readonly href: string
}

export function CriticalCareResourceSearch({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const [query, setQuery] = useState('')
  const records = useMemo<readonly SearchRecord[]>(
    () => [
      ...catalog.activities.map((activity) => ({
        id: activity.id,
        kind: 'activity' as const,
        title: activity.title,
        description: activity.description,
        terms: [
          activity.id,
          activity.difficulty,
          ...activity.competencyIds,
          ...activity.teachesConceptIds,
          ...activity.assumedConceptIds,
        ].join(' '),
        href: criticalCareCatalogActivityHref(activity),
      })),
      ...catalog.concepts.map((concept) => ({
        id: concept.id,
        kind: 'concept' as const,
        title: concept.title,
        description: concept.shortExplanation,
        terms: [concept.id, ...concept.relatedConceptIds].join(' '),
        href: `/critical-care/concepts/${concept.id}`,
      })),
      ...catalog.referenceItems.map((item) => ({
        id: item.id,
        kind: 'reference' as const,
        title: item.title,
        description: item.summary,
        terms: [item.id, item.category, ...item.competencyIds].join(' '),
        href: `/critical-care/reference?item=${encodeURIComponent(item.id)}`,
      })),
    ],
    [catalog],
  )
  const fuse = useMemo(
    () =>
      new Fuse(records, {
        keys: [
          { name: 'title', weight: 0.45 },
          { name: 'terms', weight: 0.35 },
          { name: 'description', weight: 0.2 },
        ],
        threshold: 0.34,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [records],
  )
  const normalized = query.trim()
  const results = normalized ? fuse.search(normalized, { limit: 8 }).map(({ item }) => item) : []

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm"
      aria-label="Search learning resource"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Find an explanation or activity
        </p>
        <h2 className="mt-1 text-xl font-semibold">What are you trying to understand?</h2>
      </div>
      <label className="relative mt-4 block">
        <span className="sr-only">Search activities, concepts, and references</span>
        <Search
          className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try wedge pressure, recirculation, suction, or delivered dose"
          className="min-h-11 w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm"
        />
      </label>
      {normalized ? (
        <div className="mt-4" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            {results.length > 0
              ? `${results.length} useful ${results.length === 1 ? 'route' : 'routes'}`
              : 'No close matches. Try a mechanism, device, or shorter phrase.'}
          </p>
          <ol className="mt-2 divide-y">
            {results.map((result) => (
              <li key={`${result.kind}:${result.id}`} className="py-3">
                <Link
                  href={result.href as Route}
                  className="group flex min-h-11 items-start justify-between gap-4"
                >
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-primary">
                      {result.kind}
                    </span>
                    <span className="mt-1 block font-semibold">{result.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">
                      {result.description}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-3 size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Link
          href={'/critical-care/concepts' as Route}
          className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
        >
          Browse the full concept index <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}
