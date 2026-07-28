'use client'

import type { Route } from 'next'
import { ArrowRight, FlaskConical } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'

export function CriticalCareLabsLibrary({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Lab library</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Focused critical-care labs</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        Experienced learners can enter any focused laboratory available in this unlisted learning
        center while preserving each module&apos;s established progress and feedback behavior.
      </p>
      <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalog.modules.map((module) => (
          <li key={module.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
            <FlaskConical className="size-6 text-primary" aria-hidden="true" />
            <span className="mt-4 text-xs font-bold uppercase tracking-wide text-primary">
              Focused module
            </span>
            <h2 className="mt-2 text-xl font-bold">{module.title}</h2>
            {'subtitle' in module && module.subtitle ? (
              <p className="mt-1 text-sm font-medium">{module.subtitle}</p>
            ) : null}
            <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
              Sections:{' '}
              {module.sections
                .map((section) => section.charAt(0).toUpperCase() + section.slice(1))
                .join(' · ')}
            </p>
            <Link
              href={module.href as Route}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              Open full lab <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-muted-foreground">
        These laboratories retain their existing draft or preview release gates and are not promoted
        into general site navigation, search, or the sitemap.
      </p>
    </main>
  )
}
