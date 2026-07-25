'use client'

import type { Route } from 'next'
import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'

const conceptGroupLabels: Readonly<Record<string, string>> = {
  measurement: 'Measurement and interpretation',
  flow: 'Pressure, flow, and perfusion',
  perfusion: 'Pressure, flow, and perfusion',
  ventilation: 'Ventilation',
  device: 'Device and circuit behavior',
  membrane: 'Extracorporeal transport',
  circuit: 'Extracorporeal transport',
  troubleshooting: 'Troubleshooting',
}

function conceptGroup(conceptId: string): string {
  return conceptGroupLabels[conceptId.split('.')[1] ?? ''] ?? 'Shared concepts'
}

export function CriticalCareConceptIndex({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase()
  const results = useMemo(
    () =>
      catalog.concepts.filter((concept) => {
        if (!normalized) return true
        return `${concept.id} ${concept.title} ${concept.shortExplanation}`
          .toLocaleLowerCase()
          .includes(normalized)
      }),
    [catalog.concepts, normalized],
  )
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof results>()
    for (const item of results) {
      const label = conceptGroup(item.id)
      groups.set(label, [...(groups.get(label) ?? []), item])
    }
    return [...groups.entries()]
  }, [results])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Concept index</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Start with the question you have</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        Each concept connects a short explanation to every activity that uses it across the
        critical-care resource. Open any activity directly; the ordering is only a suggestion.
      </p>

      <label className="relative mt-7 block max-w-2xl">
        <span className="sr-only">Search concepts</span>
        <Search
          className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try wedge pressure, recirculation, flow, or signal validity"
          className="min-h-11 w-full rounded-xl border bg-background py-2 pl-10 pr-3 text-sm"
        />
      </label>
      <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">
        {results.length} {results.length === 1 ? 'concept' : 'concepts'}
      </p>

      <div className="mt-8 space-y-10">
        {grouped.map(([group, concepts]) => (
          <section key={group} aria-labelledby={`concept-group-${group.replaceAll(' ', '-')}`}>
            <h2
              id={`concept-group-${group.replaceAll(' ', '-')}`}
              className="text-xl font-semibold tracking-tight"
            >
              {group}
            </h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {concepts.map((concept) => (
                <li key={concept.id} className="rounded-2xl border bg-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {concept.id}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{concept.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {concept.shortExplanation}
                  </p>
                  <Link
                    href={`/critical-care/concepts/${concept.id}` as Route}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                  >
                    See where it appears <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
