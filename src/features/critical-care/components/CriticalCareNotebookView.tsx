'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookmarkX } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'
import {
  criticalCareNotebookItemKey,
  createEmptyCriticalCareNotebook,
  readCriticalCareNotebook,
  toggleCriticalCareNotebookItem,
  writeCriticalCareNotebook,
  type CriticalCareNotebook,
  type CriticalCareNotebookItem,
} from '../notebook'

export function CriticalCareNotebookView({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const knownItemKeys = useMemo(
    () => new Set(catalog.referenceItems.map(criticalCareNotebookItemKey)),
    [catalog.referenceItems],
  )
  const [notebook, setNotebook] = useState<CriticalCareNotebook>(createEmptyCriticalCareNotebook)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setNotebook(readCriticalCareNotebook(window.localStorage, knownItemKeys)),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [knownItemKeys])

  function remove(item: CriticalCareNotebookItem) {
    const updated = toggleCriticalCareNotebookItem(notebook, item, knownItemKeys)
    setNotebook(updated)
    writeCriticalCareNotebook(window.localStorage, updated)
  }

  const visibleItems = notebook.items.flatMap((item) => {
    const resolved = catalog.referenceItems.find(
      (record) => record.id === item.id && record.kind === item.kind,
    )
    return resolved ? [{ item, resolved }] : []
  })

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={'/critical-care/reference' as Route}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Reference library
      </Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        Local notebook
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Saved critical care records</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        Saved catalog records remain on this device. The notebook stores stable record IDs and
        timestamps only—no patient data, free text, or simulation traces.
      </p>

      {visibleItems.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed p-8 text-center">
          <h2 className="text-lg font-bold">No saved records yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Save a waveform, formula, troubleshooting sequence, or asset from the reference library.
          </p>
        </section>
      ) : (
        <ol className="mt-8 grid gap-4">
          {visibleItems.map(({ item, resolved }) => {
            return (
              <li
                key={`${item.kind}:${item.id}`}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-5"
              >
                <div className="max-w-3xl">
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">
                    {item.kind}
                  </span>
                  <h2 className="mt-1 text-lg font-bold">{resolved.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{resolved.summary}</p>
                  <Link
                    href={`/critical-care/reference?item=${encodeURIComponent(item.id)}` as Route}
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
                  >
                    Open record
                  </Link>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold"
                  onClick={() => remove(item)}
                >
                  <BookmarkX className="size-4" aria-hidden="true" /> Remove
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}
